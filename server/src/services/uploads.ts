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

/** Persist an uploaded buffer to the volume, generating a thumbnail for images. */
export async function storeUpload(
  originalName: string,
  mime: string,
  buffer: Buffer,
): Promise<StoredFile> {
  const ext = path.extname(originalName) || "";
  const id = nanoid(16);
  const storagePath = `${id}${ext}`;
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
