import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const magic = Buffer.from('PCAGPRJ1');

export function readWorkspaceArchive(bytes: Buffer): any {
  if (!bytes.subarray(0, 8).equals(magic)) throw new Error('Wrong project signature.');
  const payload = bytes.subarray(40);
  const digest = createHash('sha256').update(payload).digest();
  if (!bytes.subarray(8, 40).equals(digest)) throw new Error('Wrong project hash.');
  return JSON.parse(gunzipSync(payload).toString('utf8'));
}

export function writeWorkspaceArchive(workspace: unknown): Buffer {
  const payload = gzipSync(Buffer.from(JSON.stringify(workspace)));
  return Buffer.concat([magic, createHash('sha256').update(payload).digest(), payload]);
}
