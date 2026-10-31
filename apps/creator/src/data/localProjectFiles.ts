import { allowedMime, basename, parentOf, ROOT_FOLDERS, rootOf, validSegment } from '../../../../packages/editor-workspace/src/index';
import type { Workspace, WorkspaceFile } from '../../../../packages/editor-workspace/src/index';
import { validateProject } from '../../../../packages/project-format/src/index';
import type { Character, Project, Room } from '../../../../packages/project-format/src/index';
import { desktopRoot } from './desktopFileHandles';

const manifestName = 'workspace.json';
type LocalRoom = Omit<Room, 'backgroundAssetId'> & { backgroundPath: string };
type LocalCharacter = Omit<Character, 'referenceAssetId'> & { referencePath: string };
interface LocalManifest {
  format: 'pcag-local-project'; version: 2; targetWidth: number; targetHeight: number;
  project: Omit<Project, 'assets' | 'rooms' | 'characters'> & { rooms: LocalRoom[]; characters?: LocalCharacter[] };
}
type LegacyManifest = Omit<Workspace, 'files'> & { files: unknown[] };
type DirectoryEntries = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

function parts(path: string): string[] {
  if (!rootOf(path) || !path.split('/').every(name => !!name && name !== '.' && name !== '..' && !name.includes('\\') && !name.includes('\0'))) throw new Error(`Invalid project path: ${path}`);
  return path.split('/');
}

async function folderAt(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  let folder = root;
  for (const name of parts(path)) folder = await folder.getDirectoryHandle(name, { create });
  return folder;
}

async function fileAt(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemFileHandle> {
  const names = parts(path);
  const name = names.pop()!;
  const parent = names.length ? await folderAt(root, names.join('/'), create) : root;
  return parent.getFileHandle(name, { create });
}

function bytesOf(file: WorkspaceFile): Uint8Array {
  if (!file.dataUrl.startsWith(`data:${file.mime};base64,`)) throw new Error(`Invalid file data: ${file.path}`);
  return Uint8Array.from(atob(file.dataUrl.slice(file.dataUrl.indexOf(',') + 1)), character => character.charCodeAt(0));
}

function dataUrl(mime: string, bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

async function idForPath(path: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path)));
  return `asset_${Array.from(digest.subarray(0, 20), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function localManifest(workspace: Workspace): LocalManifest {
  return {
    format: 'pcag-local-project', version: 2,
    targetWidth: workspace.targetWidth, targetHeight: workspace.targetHeight,
    project: {
      schemaVersion: 1, id: workspace.project.id, name: workspace.project.name, startRoomId: workspace.project.startRoomId, gameState: workspace.project.gameState,
      characters: (workspace.project.characters ?? []).map(character => {
        const referencePath = workspace.project.assets.find(asset => asset.id === character.referenceAssetId)?.path;
        if (!referencePath) throw new Error(`Character reference is missing: ${character.name}`);
        const { referenceAssetId: _id, ...rest } = character;
        return { ...rest, referencePath };
      }),
      rooms: workspace.project.rooms.map(room => {
        const backgroundPath = workspace.project.assets.find(asset => asset.id === room.backgroundAssetId)?.path;
        if (!backgroundPath) throw new Error(`Scene background is missing: ${room.name}`);
        const { backgroundAssetId: _id, ...rest } = room;
        return { ...rest, backgroundPath };
      }),
    },
  };
}

async function readManifest(handle: FileSystemDirectoryHandle): Promise<LocalManifest | LegacyManifest> {
  const file = await handle.getFileHandle(manifestName);
  const value: unknown = JSON.parse(await (await file.getFile()).text());
  if (!value || typeof value !== 'object' || !('format' in value) || !('version' in value)) throw new Error('This folder has no supported PCAG workspace.');
  if (value.format === 'pcag-local-project' && value.version === 2) return value as LocalManifest;
  if (value.format === 'pcag-workspace' && value.version === 1) return value as LegacyManifest;
  throw new Error('This folder has no supported PCAG workspace.');
}

export async function readLocalProject(handle: FileSystemDirectoryHandle, previous?: Workspace): Promise<Workspace> {
  const manifest = await readManifest(handle);
  const folders: string[] = [];
  const files: WorkspaceFile[] = [];
  const legacy = manifest.format === 'pcag-workspace' ? manifest : null;
  const previousFiles = new Map(previous?.files.map(file => [file.path, file]));
  const legacyAssets = new Map(legacy?.project.assets.map(asset => [asset.path, asset]));
  const scan = async (directory: FileSystemDirectoryHandle, folder: string) => {
    folders.push(folder);
    for await (const entry of (directory as DirectoryEntries).values()) {
      const path = `${folder}/${entry.name}`;
      if (entry.kind === 'directory') {
        if ((rootOf(folder) === 'animation' || rootOf(folder) === 'video') && entry.name.startsWith('_')) {
          try { await (entry as FileSystemDirectoryHandle).getFileHandle('source.json'); continue; }
          catch { /* A regular user folder is still an asset folder. */ }
        }
        await scan(entry as FileSystemDirectoryHandle, path);
      }
      else {
        const file = await (entry as FileSystemFileHandle).getFile();
        if (rootOf(path) === 'images' && entry.name.endsWith('_atlas.json') && file.size < 1_000_000) {
          try { if (JSON.parse(await file.text()).format === 'pcag-animation-atlas') continue; }
          catch { /* Other JSON files remain visible for normal validation. */ }
        }
        const mime = allowedMime(path) ?? 'application/octet-stream';
        const bytes = new Uint8Array(await file.arrayBuffer());
        files.push({ id: previousFiles.get(path)?.id ?? legacyAssets.get(path)?.id ?? await idForPath(path), path, mime, dataUrl: dataUrl(mime, bytes) });
      }
    }
  };
  for (const root of ROOT_FOLDERS) await scan(await handle.getDirectoryHandle(root, { create: true }), root);
  folders.sort(); files.sort((a, b) => a.path.localeCompare(b.path));
  const assets: Project['assets'] = files.filter(file => (rootOf(file.path) === 'backgrounds' || rootOf(file.path) === 'images') && file.mime.startsWith('image/') && file.path.split('/').every(validSegment))
    .map(file => ({ id: file.id, name: previous?.project.assets.find(asset => asset.path === file.path)?.name ?? legacyAssets.get(file.path)?.name ?? basename(file.path), kind: 'image', path: file.path }));
  const source = manifest.project;
  if (!source || !Array.isArray(source.rooms)) throw new Error('Project scenes are invalid.');
  const rooms = await Promise.all(source.rooms.map(async room => {
    const backgroundPath = 'backgroundPath' in room ? room.backgroundPath : legacy?.project.assets.find(asset => asset.id === room.backgroundAssetId)?.path;
    if (typeof backgroundPath !== 'string' || rootOf(backgroundPath) !== 'backgrounds') throw new Error(`Scene background is invalid: ${room.name}`);
    let asset = assets.find(item => item.path === backgroundPath);
    if (!asset) {
      asset = { id: previous?.project.assets.find(item => item.path === backgroundPath)?.id ?? legacyAssets.get(backgroundPath)?.id ?? await idForPath(backgroundPath), name: basename(backgroundPath), kind: 'image', path: backgroundPath };
      assets.push(asset);
    }
    const { backgroundPath: _path, backgroundAssetId: _id, ...rest } = room as LocalRoom & Room;
    return { ...rest, backgroundAssetId: asset.id, sceneState: rest.sceneState ?? {} };
  }));
  const characters = (source.characters ?? []).map(character => {
    const referencePath = 'referencePath' in character ? character.referencePath : legacy?.project.assets.find(asset => asset.id === character.referenceAssetId)?.path;
    const asset = assets.find(item => item.path === referencePath);
    if (!asset) throw new Error(`Character reference is missing: ${character.name}`);
    const { referencePath: _path, referenceAssetId: _id, ...rest } = character as LocalCharacter & Character;
    return { ...rest, referenceAssetId: asset.id, animations: rest.animations.map(animation => {
      const previous = animation as typeof animation & { width?: number };
      const { width: _width, ...current } = previous;
      return { ...current, height: current.height ?? _width ?? 160, mirrorX: current.mirrorX ?? false };
    }) };
  });
  const project: Project = { schemaVersion: 1, id: source.id, name: source.name, startRoomId: source.startRoomId, gameState: source.gameState ?? {}, assets, rooms, characters };
  const checked = validateProject(project);
  return { format: 'pcag-workspace', version: 1, targetWidth: manifest.targetWidth, targetHeight: manifest.targetHeight, project: checked.ok ? checked.project : project, folders, files };
}

async function assertUnchanged(handle: FileSystemDirectoryHandle, file: WorkspaceFile): Promise<void> {
  let current: Uint8Array;
  try { current = new Uint8Array(await (await (await fileAt(handle, file.path, false)).getFile()).arrayBuffer()); }
  catch (error) { if (error instanceof DOMException && error.name === 'NotFoundError') throw new Error(`File changed outside the editor: ${file.path}. Refresh Assets before editing it.`); throw error; }
  const old = bytesOf(file);
  if (current.length !== old.length || current.some((byte, index) => byte !== old[index])) throw new Error(`File changed outside the editor: ${file.path}. Refresh Assets before editing it.`);
}

export async function writeLocalProject(handle: FileSystemDirectoryHandle, workspace: Workspace, previous?: Workspace): Promise<void> {
  const folders = new Set(workspace.folders);
  if (!ROOT_FOLDERS.every(root => folders.has(root))) throw new Error('Project folders are invalid.');
  const beforeFolders = new Set(previous?.folders ?? []);
  const beforeFiles = new Map(previous?.files.map(file => [file.path, file]));
  for (const folder of [...workspace.folders].sort((a, b) => a.length - b.length)) if (!beforeFolders.has(folder)) await folderAt(handle, folder, true);
  for (const file of workspace.files) {
    const old = beforeFiles.get(file.path);
    if (old?.dataUrl === file.dataUrl && old.mime === file.mime) continue;
    if (old) await assertUnchanged(handle, old);
    else {
      try { await fileAt(handle, file.path, false); throw new Error(`File already exists on disk: ${file.path}. Refresh Assets before editing it.`); }
      catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
    }
    const writable = await (await fileAt(handle, file.path, true)).createWritable();
    await writable.write(bytesOf(file).slice().buffer);
    await writable.close();
  }
  if (window.pcagDesktop && previous) {
    const byId = new Map(workspace.files.map(file => [file.id, file]));
    for (const old of previous.files) {
      const next = byId.get(old.id);
      if (next && next.path !== old.path && (rootOf(old.path) === 'animation' || rootOf(old.path) === 'video') && (rootOf(next.path) === 'animation' || rootOf(next.path) === 'video') && /\.(mp4|webm|mov|gif)$/i.test(old.path)) {
        await assertUnchanged(handle, old);
        await window.pcagDesktop.invoke('animation-transfer-work', desktopRoot(handle), old.path, next.path);
      }
    }
  }
  const currentPaths = new Set(workspace.files.map(file => file.path));
  for (const file of previous?.files ?? []) if (!currentPaths.has(file.path)) {
    await assertUnchanged(handle, file);
    const name = basename(file.path);
    const parent = await (parentOf(file.path) ? folderAt(handle, parentOf(file.path), false) : Promise.resolve(handle));
    await parent.removeEntry(name);
    if ((rootOf(file.path) === 'animation' || rootOf(file.path) === 'video') && /\.(mp4|webm|mov|gif)$/i.test(name)) {
      const helperName = `_${name.slice(0, name.lastIndexOf('.'))}`;
      try {
        const helper = await parent.getDirectoryHandle(helperName);
        const metadata = JSON.parse(await (await helper.getFileHandle('source.json')).getFile().then(source => source.text())) as { file?: string };
        if (metadata.file === name) await parent.removeEntry(helperName, { recursive: true });
      } catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
    }
  }
  for (const folder of [...(previous?.folders ?? [])].sort((a, b) => b.length - a.length)) if (!folders.has(folder) && !ROOT_FOLDERS.includes(folder as typeof ROOT_FOLDERS[number])) {
    await folderAt(handle, parentOf(folder), false).then(parent => parent.removeEntry(basename(folder)));
  }
  const writable = await (await handle.getFileHandle(manifestName, { create: true })).createWritable();
  await writable.write(JSON.stringify(localManifest(workspace), null, 2) + '\n');
  await writable.close();
}

export async function requireEmptyFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  for await (const _entry of (handle as DirectoryEntries).values()) throw new Error('Choose an empty project folder.');
}
