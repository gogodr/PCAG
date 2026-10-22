import { strToU8, zipSync } from 'fflate';
import { MAX_IMAGE_BYTES, MAX_PROJECT_BYTES, requireProject, requirePlayableProject, type Project } from '../../project-format/src/index';

export const STORAGE_KEY = 'pcag.project.v2';
export const LEGACY_STORAGE_KEY = 'pcag.project.v1';
export interface ProjectStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

export function serializeProject(project: Project): string {
  return JSON.stringify(requireProject(project));
}

export function parseProject(text: string): Project {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('This project is larger than the 24 MB foundation limit.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('This is not a readable project file. Choose a .pcag.json backup.'); }
  return requireProject(value);
}

export function saveProject(storage: ProjectStorage, project: Project) {
  // A single localStorage setItem is atomic: quota failure leaves the prior value intact.
  storage.setItem(STORAGE_KEY, serializeProject(project));
}

export function loadProject(storage: ProjectStorage): Project | null {
  const data = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
  return data === null ? null : parseProject(data);
}

export async function readProjectFile(file: File): Promise<Project> {
  if (file.size > MAX_PROJECT_BYTES) throw new Error('This project is larger than 24 MB. The current project has not been replaced.');
  const project = parseProject(await file.text());
  await validateProjectMedia(project);
  return project;
}

export async function validateProjectMedia(project: Project): Promise<void> {
  const dimensions = new Map<string, { width: number; height: number }>();
  for (const asset of project.assets) {
    try { dimensions.set(asset.id, await checkImage(asset.dataUrl)); }
    catch { throw new Error(`The image “${asset.name}” could not be opened or is larger than 4096 × 4096 pixels. The current project has not been replaced.`); }
  }
  if (project.protagonist) for (const mode of ['idle', 'walk', 'talk'] as const) {
    const mapping = project.protagonist.animations[mode], size = dimensions.get(mapping.assetId);
    const count = size ? Math.floor(size.width / mapping.frameWidth) * Math.floor(size.height / mapping.frameHeight) : 0;
    if (count > 256) throw new Error(`The ${mode} sprite sheet creates more than 256 frames. Increase its frame width or height.`);
    if (!count || mapping.frames.some(frame => frame >= count)) throw new Error(`The ${mode} animation includes frames outside its sprite sheet. Check its frame size, first frame, and frame count.`);
  }
}

async function checkImage(url: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => image.width <= 4096 && image.height <= 4096
      ? resolve({ width: image.width, height: image.height }) : reject(new Error('Use an image no larger than 4096 × 4096 pixels.'));
    image.onerror = () => reject(new Error('This image could not be decoded. Try another image.'));
    image.src = url;
  });
}

export async function readImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image smaller than 8 MB.');
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
  await checkImage(url);
  return url;
}

export interface PlayerTemplate { html: string; script: Uint8Array; style: Uint8Array }

export function buildPlayableArchive(project: Project, template: PlayerTemplate): Uint8Array {
  requirePlayableProject(project);
  return zipSync({
    'index.html': strToU8(template.html),
    'player.js': template.script,
    'player.css': template.style,
    'project.json': strToU8(serializeProject(project)),
    'README.txt': strToU8('Serve this folder using static HTTP hosting and open index.html. No editor, account, CDN, or build service is required. Opening index.html directly from disk is not supported.\n'),
  });
}

export async function fetchPlayerTemplate(base: string): Promise<PlayerTemplate> {
  const responses = await Promise.all(['index.html', 'player.js', 'player.css'].map(async file => {
    const response = await fetch(`${base}${file}`);
    if (!response.ok) throw new Error('The game export files are unavailable. Ask the maintainer to rebuild the creator.');
    return response;
  }));
  return { html: await responses[0].text(), script: new Uint8Array(await responses[1].arrayBuffer()), style: new Uint8Array(await responses[2].arrayBuffer()) };
}

export function downloadFile(filename: string, contents: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
