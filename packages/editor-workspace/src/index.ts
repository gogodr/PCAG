import { createId, validateProject } from '../../project-format/src/index.ts';
import type { Project } from '../../project-format/src/index.ts';
import { safeSvg } from './svg.ts';

export const ROOT_FOLDERS = ['backgrounds', 'images', 'sounds', 'music'] as const;
export type RootFolder = typeof ROOT_FOLDERS[number];
export interface WorkspaceFile { id: string; path: string; mime: string; dataUrl: string }
export interface Workspace {
  format: 'pcag-workspace';
  version: 1;
  targetWidth: number;
  targetHeight: number;
  project: Project;
  folders: string[];
  files: WorkspaceFile[];
}

const segmentPattern = /^[A-Za-z0-9_-](?:[A-Za-z0-9_. ()-]*[A-Za-z0-9_.()-])?$/;
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const rootOf = (path: string): RootFolder | null => ROOT_FOLDERS.find(root => path === root || path.startsWith(`${root}/`)) ?? null;
export const parentOf = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
export const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1);
export function validSegment(name: string): boolean { return segmentPattern.test(name) && name !== '.' && name !== '..'; }
export function allowedMime(path: string): string | null {
  const root = rootOf(path);
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const images: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp' };
  const audio: Record<string, string> = { mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav' };
  return root === 'backgrounds' || root === 'images' ? images[ext] ?? null : root === 'sounds' || root === 'music' ? audio[ext] ?? null : null;
}
export function matchesFileSignature(mime: string, bytes: Uint8Array): boolean {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (mime === 'image/svg+xml') return safeSvg(bytes);
  if (mime === 'image/png') return bytes.length >= 8 && ascii(1, 3) === 'PNG' && bytes[0] === 137;
  if (mime === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/webp') return bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP';
  if (mime === 'audio/wav') return bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE';
  if (mime === 'audio/ogg') return bytes.length >= 4 && ascii(0, 4) === 'OggS';
  if (mime === 'audio/mpeg') return bytes.length >= 3 && (ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0));
  return false;
}
export function assetUrls(workspace: Workspace): ReadonlyMap<string, string> {
  return new Map(workspace.files.map(file => [file.path, file.dataUrl]));
}

export async function sampleWorkspace(project: Project, sampleUrls: ReadonlyMap<string, string>): Promise<Workspace> {
  const copy = structuredClone(project);
  const files: WorkspaceFile[] = [];
  for (const asset of copy.assets) {
    const url = sampleUrls.get(asset.path);
    if (!url) throw new Error(`Sample image ${asset.path} is unavailable.`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load sample image ${asset.path}.`);
    const path = rootOf(asset.path) ? asset.path : `backgrounds/${basename(asset.path)}`;
    const mime = asset.path.endsWith('.svg') ? 'image/svg+xml' : allowedMime(path);
    if (!mime) throw new Error(`Unsupported sample image ${asset.path}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    files.push({ id: asset.id, path, mime, dataUrl: `data:${mime};base64,${btoa(binary)}` });
    asset.path = path;
  }
  const room = copy.rooms.find(item => item.id === copy.startRoomId)!;
  const folders = new Set<string>(ROOT_FOLDERS);
  for (const file of files) {
    const parts = file.path.split('/');
    for (let count = 2; count < parts.length; count++) folders.add(parts.slice(0, count).join('/'));
  }
  return { format: 'pcag-workspace', version: 1, targetWidth: room.width, targetHeight: room.height, project: copy, folders: [...folders], files };
}

export function parseWorkspace(text: string, trustedSvgData: ReadonlySet<string>): { ok: true; workspace: Workspace } | { ok: false; message: string } {
  let input: unknown;
  try { input = JSON.parse(text); } catch { return { ok: false, message: 'This workspace is not valid JSON. The current project was kept.' }; }
  if (!isRecord(input) || input.format !== 'pcag-workspace' || input.version !== 1 || !Array.isArray(input.folders) || !Array.isArray(input.files)) return { ok: false, message: 'This is not a supported PCAG workspace. The current project was kept.' };
  const result = validateProject(input.project);
  if (!result.ok) return { ok: false, message: `${result.diagnostics[0]?.message ?? 'Project data is invalid.'} (${result.diagnostics[0]?.path ?? '/'}) The current project was kept.` };
  if (typeof input.targetWidth !== 'number' || typeof input.targetHeight !== 'number' || !Number.isSafeInteger(input.targetWidth) || !Number.isSafeInteger(input.targetHeight) || input.targetWidth < 1 || input.targetHeight < 1 || input.targetWidth > 8192 || input.targetHeight > 8192) return { ok: false, message: 'Target resolution must be between 1 and 8192 pixels. The current project was kept.' };
  const folders = input.folders;
  if (!folders.every((path: unknown) => typeof path === 'string' && rootOf(path) && path.split('/').every(validSegment)) || new Set(folders).size !== folders.length || !ROOT_FOLDERS.every(root => folders.includes(root)) || folders.some((path: string) => path.includes('/') && !folders.includes(parentOf(path)))) return { ok: false, message: 'Workspace folders are invalid. The current project was kept.' };
  const filePaths = new Set<string>();
  const fileIds = new Set<string>();
  for (const file of input.files) {
    if (!isRecord(file) || typeof file.id !== 'string' || typeof file.path !== 'string' || typeof file.mime !== 'string' || typeof file.dataUrl !== 'string' || !rootOf(file.path) || !file.path.split('/').every(validSegment) || !folders.includes(parentOf(file.path)) || folders.includes(file.path) || filePaths.has(file.path) || fileIds.has(file.id)) return { ok: false, message: 'Workspace files have invalid or duplicate paths. The current project was kept.' };
    const expected = allowedMime(file.path);
    const bundledSvg = file.mime === 'image/svg+xml' && trustedSvgData.has(file.dataUrl);
    if ((!expected || file.mime !== expected) && !bundledSvg) return { ok: false, message: `Unsupported file type at ${file.path}. The current project was kept.` };
    if (!file.dataUrl.startsWith(`data:${file.mime};base64,`) || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.dataUrl.slice(file.dataUrl.indexOf(',') + 1)) || file.dataUrl.length > 14_000_000) return { ok: false, message: `File data is invalid at ${file.path}. The current project was kept.` };
    if (!bundledSvg) {
      try {
        const binary = atob(file.dataUrl.slice(file.dataUrl.indexOf(',') + 1));
        if (!matchesFileSignature(file.mime, Uint8Array.from(binary, character => character.charCodeAt(0)))) throw new Error('Invalid signature');
      } catch { return { ok: false, message: `File contents do not match the type at ${file.path}. The current project was kept.` }; }
    }
    filePaths.add(file.path);
    fileIds.add(file.id);
  }
  if (result.project.assets.some(asset => !filePaths.has(asset.path))) return { ok: false, message: 'A project image is missing from the workspace files. The current project was kept.' };
  if (result.project.rooms.some(room => room.width !== input.targetWidth || room.height !== input.targetHeight)) return { ok: false, message: 'Scene sizes differ from the target resolution. The current project was kept.' };
  if (result.project.rooms.some(room => !result.project.assets.some(asset => asset.id === room.backgroundAssetId && asset.path.startsWith('backgrounds/')))) return { ok: false, message: 'A scene background must come from the backgrounds folder. The current project was kept.' };
  return { ok: true, workspace: { format: 'pcag-workspace', version: 1, targetWidth: input.targetWidth, targetHeight: input.targetHeight, project: result.project, folders: [...folders], files: input.files.map((file: WorkspaceFile) => ({ ...file })) } };
}

export function newScene(workspace: Workspace): Project['rooms'][number] {
  const background = workspace.project.assets.find(asset => asset.path.startsWith('backgrounds/'));
  if (!background) throw new Error('Add a background image before creating a scene.');
  return { id: createId(), name: `Scene ${workspace.project.rooms.length + 1}`, width: workspace.targetWidth, height: workspace.targetHeight, backgroundAssetId: background.id, hotspots: [] };
}
