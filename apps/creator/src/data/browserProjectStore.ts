import { readLocalProject } from './localProjectFiles';
import type { Workspace } from '../../../../packages/editor-workspace/src/index';
import { desktopHandle, desktopRoot } from './desktopFileHandles';

export { readLocalProject, requireEmptyFolder, writeLocalProject } from './localProjectFiles';

const databaseName = 'pcag-editor';
type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
};

function browserPicker(): (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle> {
  const picker = (window as Window & { showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
  if (!picker) throw new Error('Folder access requires a browser that supports showDirectoryPicker.');
  return picker.bind(window);
}

export async function pickProjectFolder(): Promise<FileSystemDirectoryHandle> {
  if (window.pcagDesktop) {
    const selected = await window.pcagDesktop.invoke<{ root: string; name: string } | null>('pick-folder');
    if (!selected) throw new DOMException('Folder selection cancelled.', 'AbortError');
    return desktopHandle(selected);
  }
  return browserPicker()({ mode: 'readwrite' });
}

async function ensurePermission(handle: FileSystemDirectoryHandle, prompt: boolean): Promise<boolean> {
  const folder = handle as PermissionHandle;
  if (typeof folder.queryPermission !== 'function') return true;
  if (await folder.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
  return prompt && await folder.requestPermission({ mode: 'readwrite' }) === 'granted';
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('settings'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('settings', 'readonly').objectStore('settings').get('recentFolder');
      request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function remember(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      transaction.objectStore('settings').put(handle, 'recentFolder');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function forgetRecentProject(): Promise<void> {
  if (window.pcagDesktop) { await window.pcagDesktop.invoke('forget-folder'); return; }
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      transaction.objectStore('settings').delete('recentFolder');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

export async function openRecentProject(): Promise<{ handle: FileSystemDirectoryHandle; workspace: Workspace } | null> {
  if (window.pcagDesktop) {
    const selected = await window.pcagDesktop.invoke<{ root: string; name: string } | null>('recent-folder');
    if (!selected) return null;
    const handle = desktopHandle(selected);
    return { handle, workspace: await readLocalProject(handle) };
  }
  const handle = await storedHandle();
  if (!handle || !await ensurePermission(handle, false)) return null;
  return { handle, workspace: await readLocalProject(handle) };
}

export async function useProjectFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  if (window.pcagDesktop) { await window.pcagDesktop.invoke('remember-folder', desktopRoot(handle)); return; }
  if (!await ensurePermission(handle, true)) throw new Error('Read and write access to the project folder is required.');
  await remember(handle);
}
