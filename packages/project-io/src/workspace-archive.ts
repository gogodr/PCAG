import type { Workspace } from '../../editor-workspace/src/index';

const magic = new TextEncoder().encode('PCAGPRJ1');
const headerLength = magic.length + 32;
const maxArchiveBytes = 150_000_000;
const maxExpandedBytes = 250_000_000;

async function collect(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error('The project file is too large.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

function byteStream(bytes: Uint8Array): ReadableStream<BufferSource> {
  return new Blob([bytes.slice().buffer]).stream();
}

export async function encodeWorkspace(workspace: Workspace): Promise<Uint8Array> {
  const source = new TextEncoder().encode(JSON.stringify(workspace));
  if (source.byteLength > maxExpandedBytes) throw new Error('The project is too large to export.');
  const payload = await collect(byteStream(source).pipeThrough(new CompressionStream('gzip')), maxArchiveBytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload.slice().buffer));
  const archive = new Uint8Array(headerLength + payload.byteLength);
  archive.set(magic);
  archive.set(digest, magic.length);
  archive.set(payload, headerLength);
  return archive;
}

export async function decodeWorkspace(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength <= headerLength || bytes.byteLength > maxArchiveBytes + headerLength || !magic.every((byte, index) => bytes[index] === byte)) {
    throw new Error('This is not a supported PCAG project file. The current project was kept.');
  }
  const payload = bytes.subarray(headerLength);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', payload.slice().buffer));
  if (!digest.every((byte, index) => bytes[magic.length + index] === byte)) {
    throw new Error('Project file integrity check failed. The current project was kept.');
  }
  try {
    const expanded = await collect(byteStream(payload).pipeThrough(new DecompressionStream('gzip')), maxExpandedBytes);
    return new TextDecoder('utf-8', { fatal: true }).decode(expanded);
  } catch {
    throw new Error('The PCAG project could not be decompressed. The current project was kept.');
  }
}
