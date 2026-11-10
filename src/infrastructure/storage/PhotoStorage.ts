import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { BACKEND_ROOT } from '../backendRoot';

// backend/uploads — the same place whether running from src/ (ts-node) or dist/src/.
export const UPLOAD_ROOT = path.join(BACKEND_ROOT, 'uploads');
export const UPLOAD_URL_PREFIX = '/uploads';

const PHOTO_SIZE = 400;
const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/**
 * Re-encodes an uploaded image as a square 400×400 WebP and stores it under a
 * random, unguessable name. Decoding with sharp also rejects files that only
 * pretend to be images, and re-encoding strips EXIF (GPS location etc.).
 */
export async function savePhoto(buffer: Buffer, folder: string): Promise<string> {
  let output: Buffer;
  try {
    output = await sharp(buffer)
      .rotate() // honour the phone camera's orientation before EXIF is dropped
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw httpError('The file is not a valid image', 400);
  }

  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(dir, fileName), output);
  return `${UPLOAD_URL_PREFIX}/${folder}/${fileName}`;
}

/**
 * Saves an image that must stay readable (a transfer slip, a payment QR): resized
 * to at most 1200px wide and never cropped. Strips EXIF and re-encodes to WebP.
 */
async function saveReadableImage(buffer: Buffer, folder: string): Promise<string> {
  let output: Buffer;
  try {
    output = await sharp(buffer)
      .rotate()
      .resize(1200, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw httpError('The file is not a valid image', 400);
  }

  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(dir, fileName), output);
  return `${UPLOAD_URL_PREFIX}/${folder}/${fileName}`;
}

export const saveSlip = (buffer: Buffer) => saveReadableImage(buffer, 'slips');
export const savePaymentQr = (buffer: Buffer) => saveReadableImage(buffer, 'payment');

/**
 * Saves an uploaded assignment submission (PDF or image).
 * If PDF, saves directly; if image, converts to optimized readable WebP.
 */
export async function saveAssignmentFile(buffer: Buffer, originalName: string): Promise<{ url: string; fileName: string; fileSize: number }> {
  const dir = path.join(UPLOAD_ROOT, 'assignments');
  await fs.mkdir(dir, { recursive: true });
  const isPdf = originalName.toLowerCase().endsWith('.pdf') || buffer.slice(0, 4).toString() === '%PDF';
  const ext = isPdf ? 'pdf' : 'webp';
  const fileName = `${randomUUID()}.${ext}`;
  const filePath = path.join(dir, fileName);

  if (isPdf) {
    await fs.writeFile(filePath, buffer);
  } else {
    let output: Buffer;
    try {
      output = await sharp(buffer)
        .rotate()
        .resize(1600, undefined, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      output = buffer;
    }
    await fs.writeFile(filePath, output);
  }

  const stat = await fs.stat(filePath);
  return {
    url: `${UPLOAD_URL_PREFIX}/assignments/${fileName}`,
    fileName: originalName,
    fileSize: stat.size,
  };
}

/** Deletes a file previously returned by savePhoto; ignores anything else. */
export async function removePhoto(url: string | null | undefined) {
  if (!url?.startsWith(`${UPLOAD_URL_PREFIX}/`)) return;
  const filePath = path.resolve(UPLOAD_ROOT, url.slice(UPLOAD_URL_PREFIX.length + 1));
  if (!filePath.startsWith(UPLOAD_ROOT + path.sep)) return; // never leave the uploads folder
  await fs.rm(filePath, { force: true });
}
