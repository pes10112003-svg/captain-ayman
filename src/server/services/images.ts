import sharp, { type Metadata, type OutputInfo } from "sharp";
import { ValidationError } from "../errors";
import { env } from "../env";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"]);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic", "image/heif", "image/gif", "image/tiff", ""]);

/**
 * Validates an uploaded image by *decoding* it (not by trusting the extension / MIME type),
 * auto-rotates it, strips all metadata (EXIF GPS etc.) and re-encodes to WebP.
 */
export async function processUpload(file: File, opts: { maxSide: number; thumbSide?: number; square?: boolean }) {
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose an image to upload.");
  if (file.size > maxBytes) throw new ValidationError(`Images must be ${env().MAX_UPLOAD_MB} MB or smaller.`);
  if (!ALLOWED_MIME.has(file.type)) throw new ValidationError("Only JPEG, PNG, WebP, AVIF or HEIC images are allowed.");

  const input = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(input, { failOn: "error", limitInputPixels: 64_000_000 }).metadata();
  } catch {
    throw new ValidationError("That file isn't a valid image.");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new ValidationError("Unsupported image format.");

  const base = () => sharp(input, { failOn: "error", limitInputPixels: 64_000_000 }).rotate();
  const resize = (side: number) =>
    opts.square
      ? { width: side, height: side, fit: "cover" as const, position: "attention" as const }
      : { width: side, height: side, fit: "inside" as const, withoutEnlargement: true };

  let main: { data: Buffer; info: OutputInfo };
  try {
    main = await base().resize(resize(opts.maxSide)).webp({ quality: 84 }).toBuffer({ resolveWithObject: true });
  } catch {
    throw new ValidationError("We couldn't process that image. Try a JPEG or PNG.");
  }
  const thumb = opts.thumbSide
    ? await base().resize(resize(opts.thumbSide)).webp({ quality: 78 }).toBuffer()
    : null;

  return { main: main.data, width: main.info.width, height: main.info.height, thumb, mimeType: "image/webp" as const };
}
