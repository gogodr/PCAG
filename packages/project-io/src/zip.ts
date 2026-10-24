/** Minimal ZIP store writer for the F05 static player spike. No compression or ZIP64. */
export interface ZipEntry { path: string; data: Uint8Array }

const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  return crc >>> 0;
});
function checksum(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff]!;
  return (crc ^ 0xffffffff) >>> 0;
}
function header(size: number): { bytes: Uint8Array; view: DataView } {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

export function createZip(entries: ZipEntry[]): Blob {
  if (entries.length > 65535) throw new Error('Too many export files.');
  const names = new Set<string>();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    if (!entry.path || entry.path.startsWith('/') || entry.path.includes('\\') || entry.path.split('/').some(part => !part || part === '.' || part === '..') || names.has(entry.path)) throw new Error(`Unsafe or duplicate export path: ${entry.path}`);
    names.add(entry.path);
    const name = encoder.encode(entry.path);
    if (name.length > 65535 || entry.data.length > 0xffffffff) throw new Error('Export file is too large.');
    const crc = checksum(entry.data);
    const file = header(30 + name.length);
    file.view.setUint32(0, 0x04034b50, true);
    file.view.setUint16(4, 20, true);
    file.view.setUint16(6, 0x0800, true);
    file.view.setUint32(14, crc, true);
    file.view.setUint32(18, entry.data.length, true);
    file.view.setUint32(22, entry.data.length, true);
    file.view.setUint16(26, name.length, true);
    file.bytes.set(name, 30);
    local.push(file.bytes, entry.data);

    const directory = header(46 + name.length);
    directory.view.setUint32(0, 0x02014b50, true);
    directory.view.setUint16(4, 20, true);
    directory.view.setUint16(6, 20, true);
    directory.view.setUint16(8, 0x0800, true);
    directory.view.setUint32(16, crc, true);
    directory.view.setUint32(20, entry.data.length, true);
    directory.view.setUint32(24, entry.data.length, true);
    directory.view.setUint16(28, name.length, true);
    directory.view.setUint32(42, offset, true);
    directory.bytes.set(name, 46);
    central.push(directory.bytes);
    offset += file.bytes.length + entry.data.length;
    if (offset > 0xffffffff) throw new Error('Export is too large for ZIP32.');
  }
  const directorySize = central.reduce((total, bytes) => total + bytes.length, 0);
  if (offset + directorySize > 0xffffffff) throw new Error('Export is too large for ZIP32.');
  const end = header(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(8, entries.length, true);
  end.view.setUint16(10, entries.length, true);
  end.view.setUint32(12, directorySize, true);
  end.view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end.bytes] as BlobPart[], { type: 'application/zip' });
}
