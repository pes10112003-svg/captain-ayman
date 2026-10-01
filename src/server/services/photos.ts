import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { clients, progressPhotos } from "../db/schema";
import { authorizeClient } from "../authz";
import { logActivity, touchClient } from "../activity";
import { emit } from "../events";
import { ForbiddenError, NotFoundError } from "../errors";
import { storage } from "../storage";
import type { Actor } from "../auth/types";
import { processUpload } from "./images";
import type { PhotoAngle, PhotoPhase } from "@/lib/constants";
import { isUuid } from "@/lib/utils";

export async function uploadProgressPhoto(
  actor: Actor,
  clientId: string,
  file: File,
  meta: {
    phase: PhotoPhase;
    angle: PhotoAngle;
    takenOn: string;
    note?: string | null;
  },
) {
  const { client } = await authorizeClient(actor, clientId, "uploadPhotos");
  const img = await processUpload(file, {
    maxSide: meta.angle === "inbody" ? 2600 : 1800,
    thumbSide: 480,
  });

  const id = randomUUID();
  const storageKey = `clients/${client.id}/photos/${id}.webp`;
  const thumbKey = `clients/${client.id}/photos/${id}_thumb.webp`;
  await storage().put(storageKey, img.main, img.mimeType);
  await storage().put(thumbKey, img.thumb!, img.mimeType);

  try {
    await db.insert(progressPhotos).values({
      id,
      clientId: client.id,
      storageKey,
      thumbKey,
      mimeType: img.mimeType,
      width: img.width,
      height: img.height,
      sizeBytes: img.main.length,
      phase: meta.phase,
      angle: meta.angle,
      takenOn: meta.takenOn,
      note: meta.note ?? null,
      uploadedById: actor.userId,
    });
  } catch (err) {
    await Promise.allSettled([storage().delete(storageKey), storage().delete(thumbKey)]);
    throw err;
  }

  await logActivity({
    actorId: actor.userId,
    clientId: client.id,
    coachId: client.coachId,
    action: actor.role === "coach" ? "coach.photo.uploaded" : "client.photo.uploaded",
    entityType: "progress_photo",
    entityId: id,
    metadata: { phase: meta.phase, angle: meta.angle, takenOn: meta.takenOn },
  });
  if (actor.role === "client") {
    await touchClient(client.id);
    await emit({
      type: "photo.uploaded_by_client",
      coachId: client.coachId,
      clientId: client.id,
      clientName: client.fullName,
      photoId: id,
    });
  }
  return { id };
}

export async function listPhotos(actor: Actor, clientId: string) {
  const { client } = await authorizeClient(actor, clientId, ["viewProgress", "viewPhotos"]);
  return db
    .select({
      id: progressPhotos.id,
      phase: progressPhotos.phase,
      angle: progressPhotos.angle,
      takenOn: progressPhotos.takenOn,
      note: progressPhotos.note,
      width: progressPhotos.width,
      height: progressPhotos.height,
      createdAt: progressPhotos.createdAt,
    })
    .from(progressPhotos)
    .where(eq(progressPhotos.clientId, client.id))
    .orderBy(desc(progressPhotos.takenOn), desc(progressPhotos.createdAt));
}
export type PhotoListItem = Awaited<ReturnType<typeof listPhotos>>[number];

/** Streams a private photo after re-checking authorization for this exact photo. */
export async function readPhoto(actor: Actor, photoId: string, size: "full" | "thumb") {
  if (!isUuid(photoId)) throw new NotFoundError("Photo not found.");
  const [photo] = await db.select().from(progressPhotos).where(eq(progressPhotos.id, photoId)).limit(1);
  if (!photo) throw new NotFoundError("Photo not found.");
  // Throws NotFound for other clients' photos, Forbidden if the permission is off.
  await authorizeClient(actor, photo.clientId, ["viewProgress", "viewPhotos"]);
  const body = await storage().get(size === "thumb" ? photo.thumbKey : photo.storageKey);
  if (!body) throw new NotFoundError("Photo not found.");
  return { body, mimeType: photo.mimeType };
}

export async function deletePhoto(actor: Actor, clientId: string, photoId: string) {
  if (actor.role !== "coach") throw new ForbiddenError();
  const { client } = await authorizeClient(actor, clientId);
  if (!isUuid(photoId)) throw new NotFoundError("Photo not found.");
  const [photo] = await db
    .delete(progressPhotos)
    .where(and(eq(progressPhotos.id, photoId), eq(progressPhotos.clientId, client.id)))
    .returning();
  if (!photo) throw new NotFoundError("Photo not found.");
  await Promise.allSettled([storage().delete(photo.storageKey), storage().delete(photo.thumbKey)]);
  await logActivity({
    actorId: actor.userId,
    clientId: client.id,
    coachId: actor.userId,
    action: "coach.photo.deleted",
    entityType: "progress_photo",
    entityId: photo.id,
    metadata: {
      phase: photo.phase,
      angle: photo.angle,
      takenOn: photo.takenOn,
    },
  });
}

/* ── profile photo ─────────────────────────────────────────────── */

export async function uploadAvatar(actor: Actor, clientId: string, file: File) {
  const { client } = await authorizeClient(actor, clientId, "editPersonalInfo");
  const img = await processUpload(file, { maxSide: 400, square: true });
  const key = `clients/${client.id}/avatar-${randomUUID().slice(0, 8)}.webp`;
  await storage().put(key, img.main, img.mimeType);
  await db.update(clients).set({ avatarKey: key }).where(eq(clients.id, client.id));
  if (client.avatarKey)
    await storage()
      .delete(client.avatarKey)
      .catch(() => undefined);
  return { key };
}

export async function removeAvatar(actor: Actor, clientId: string) {
  const { client } = await authorizeClient(actor, clientId, "editPersonalInfo");
  if (!client.avatarKey) return;
  await db.update(clients).set({ avatarKey: null }).where(eq(clients.id, client.id));
  await storage()
    .delete(client.avatarKey)
    .catch(() => undefined);
}

export async function readAvatar(actor: Actor, clientId: string) {
  const { client } = await authorizeClient(actor, clientId);
  if (!client.avatarKey) throw new NotFoundError();
  const body = await storage().get(client.avatarKey);
  if (!body) throw new NotFoundError();
  return {
    body,
    mimeType: "image/webp",
    etag: client.avatarKey.split("avatar-")[1] ?? "",
  };
}
