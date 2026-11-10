import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { BACKEND_ROOT } from '../backendRoot';

// backend/storage/private — never served statically; files are streamed by the
// API after an auth + permission check (contracts hold salary and personal data).
export const PRIVATE_ROOT = path.join(BACKEND_ROOT, 'storage', 'private');

const STORED_NAME = /^[0-9a-f-]{36}\.pdf$/;
const httpError = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

/** A real PDF starts with "%PDF-"; the browser-sent MIME type alone can be faked. */
export const isPdf = (buffer: Buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-';

export async function savePdf(buffer: Buffer, folder: string): Promise<string> {
  if (!isPdf(buffer)) throw httpError('The file is not a valid PDF', 400);
  const dir = path.join(PRIVATE_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  const storedName = `${randomUUID()}.pdf`;
  await fs.writeFile(path.join(dir, storedName), buffer);
  return storedName;
}

/** Absolute path of a stored file; refuses anything that isn't one of our generated names. */
export function privateFilePath(folder: string, storedName: string) {
  if (!STORED_NAME.test(storedName)) throw httpError('File not found', 404);
  return path.join(PRIVATE_ROOT, folder, storedName);
}

export async function removePrivateFile(folder: string, storedName: string | null | undefined) {
  if (!storedName || !STORED_NAME.test(storedName)) return;
  await fs.rm(privateFilePath(folder, storedName), { force: true });
}
