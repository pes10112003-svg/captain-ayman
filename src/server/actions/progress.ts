"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "../auth/guards";
import { addMeasurements, createMeasurementType, deleteMeasurement } from "../services/progress";
import { deletePhoto, uploadProgressPhoto } from "../services/photos";
import { ValidationError } from "../errors";
import { measurementEntrySchema, measurementTypeSchema, photoMetaSchema } from "@/lib/validation";
import { parseInput, runAction } from "./helpers";

export async function addMeasurementsAction(clientId: string, input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const result = await addMeasurements(actor, clientId, parseInput(measurementEntrySchema, input));
    revalidatePath("/coach", "layout");
    return result;
  });
}

export async function deleteMeasurementAction(clientId: string, measurementId: string) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await deleteMeasurement(actor, clientId, measurementId);
    revalidatePath("/coach", "layout");
    return null;
  });
}

export async function createMeasurementTypeAction(input: unknown) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    const row = await createMeasurementType(actor, parseInput(measurementTypeSchema, input));
    revalidatePath("/coach", "layout");
    return { id: row.id, name: row.name, kind: row.kind, unit: row.unit };
  });
}

/** Used by both coach and (when permitted) the client — authorization happens in the service. */
export async function uploadPhotoAction(clientId: string, formData: FormData) {
  return runAction(async () => {
    const actor = await requireActor();
    const file = formData.get("photo");
    if (!(file instanceof File)) throw new ValidationError("Choose an image to upload.");
    const meta = parseInput(photoMetaSchema, {
      phase: formData.get("phase"),
      angle: formData.get("angle"),
      takenOn: formData.get("takenOn"),
      note: formData.get("note"),
    });
    const result = await uploadProgressPhoto(actor, clientId, file, meta);
    revalidatePath("/", "layout");
    return result;
  });
}

export async function deletePhotoAction(clientId: string, photoId: string) {
  return runAction(async () => {
    const actor = await requireActor("coach");
    await deletePhoto(actor, clientId, photoId);
    revalidatePath("/coach", "layout");
    return null;
  });
}
