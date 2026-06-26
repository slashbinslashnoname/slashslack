import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import sharp from "sharp";
import { UPLOAD_DIR } from "../db/index.js";

export interface StoredFile {
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  storagePath: string;
  thumbPath: string | null;
}

const IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|avif)$/i;

// allowlist of safe-ish content types; rejects executables, html, svg (XSS), etc.
const ALLOWED_MIME =
  /^(image\/(png|jpe?g|gif|webp|avif)|application\/pdf|text\/plain|text\/csv|application\/json|application\/zip|application\/vnd\.openxmlformats-officedocument\.|application\/msword|audio\/|video\/)/i;

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.test(mime);
}

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/json": "json",
  "application/zip": "zip",
  "application/msword": "doc",
};

/**
 * Choose a safe on-disk extension from the validated MIME type (never from the
 * user-supplied filename), so a file can't be stored as .html/.svg/.js and then
 * served with an executable content-type.
 */
function safeExtForMime(mime: string): string {
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  const sub = mime.split("/")[1]?.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return sub ? sub : "bin";
}

/** Persist an uploaded buffer to the volume, generating a thumbnail for images. */
export async function storeUpload(
  originalName: string,
  mime: string,
  buffer: Buffer,
): Promise<StoredFile> {
  const id = nanoid(16);
  const storagePath = `${id}.${safeExtForMime(mime)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storagePath), buffer);

  let width: number | null = null;
  let height: number | null = null;
  let thumbPath: string | null = null;

  if (IMAGE_MIME.test(mime)) {
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
      const thumbName = `thumbs/${id}.webp`;
      await sharp(buffer)
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(UPLOAD_DIR, thumbName));
      thumbPath = thumbName;
    } catch {
      // non-fatal: keep original without thumbnail
    }
  }

  return {
    filename: originalName,
    mime,
    size: buffer.length,
    width,
    height,
    storagePath,
    thumbPath,
  };
}
