import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSample, sampleAssets } from '../../../../examples/reference-adventure/sample';
import { validateProject } from '../../../../packages/project-format/src/index';
import type { Diagnostic, Project } from '../../../../packages/project-format/src/index';
import { allowedMime, assetUrls, parentOf, parseWorkspace, rootOf, sampleWorkspace, validSegment } from '../../../../packages/editor-workspace/src/index';
import type { Workspace } from '../../../../packages/editor-workspace/src/index';
import { exportPlayer, exportWorkspace } from '../../../../packages/project-io/src/browser';
import { decodeWorkspace } from '../../../../packages/project-io/src/workspace-archive';
import { starterWorkspace } from '../../../../packages/editor-workspace/src/starter';
import { forgetRecentProject, openRecentProject, readLocalProject, requireEmptyFolder, useProjectFolder, writeLocalProject } from '../data/browserProjectStore';
import { desktopRoot } from '../data/desktopFileHandles';

export type EditorView = 'Project' | 'Assets' | 'Scenes';
export interface PreviewSession { project: Project; urls: ReadonlyMap<string, string>; run: number }

export function useEditorWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [directory, setDirectory] = useState<string | null>(null);
  const folderHandle = useRef<FileSystemDirectoryHandle | null>(null);
  const [loading, setLoading] = useState(true);
  const [choosingProject, setChoosingProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [past, setPast] = useState<Workspace[]>([]);
  const [future, setFuture] = useState<Workspace[]>([]);
  const [view, setView] = useState<EditorView>('Project');
  const [selectedPath, setSelectedPath] = useState('backgrounds');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [messageEvent, setMessageEvent] = useState<{ text: string; id: number } | null>(null);
  const nextMessageId = useRef(0);
  const message = messageEvent?.text ?? null;
  const setMessage = (text: string | null) => setMessageEvent(text === null ? null : { text, id: ++nextMessageId.current });
  const [loadDiagnostics, setLoadDiagnostics] = useState<Diagnostic[]>([]);
  const [exportBusy, setExportBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewSession | null>(null);
  const run = useRef(0);
  const trustedSvgData = useRef<ReadonlySet<string>>(new Set());
  const writes = useRef<Promise<void>>(Promise.resolve());
  const pendingWrite = useRef<{ timer: number; handle: FileSystemDirectoryHandle; workspace: Workspace } | null>(null);
  const skipPersist = useRef(false);
  const lastWritten = useRef<Workspace | null>(null);
  const workspaceRef = useRef<Workspace | null>(null);
  const revision = useRef(0);

  const loadTrustedSample = async (): Promise<Workspace> => {
    const result = await loadSample();
    if (!result.ok) { setLoadDiagnostics(result.diagnostics); throw new Error('The reference artwork is unavailable.'); }
    const sample = await sampleWorkspace(result.project, sampleAssets);
    trustedSvgData.current = new Set(sample.files.filter(file => file.mime === 'image/svg+xml').map(file => file.dataUrl));
    return sample;
  };

  useEffect(() => {
    let active = true;
    (async () => {
      if (new URLSearchParams(location.search).has('sample')) {
        let initial: Workspace;
        try { initial = await loadTrustedSample(); }
        catch { return; }
        if (!active) return;
        setWorkspace(initial); setSelectedSceneId(initial.project.startRoomId); return;
      }
      if (new URLSearchParams(location.search).has('fresh')) return;
      const current = await openRecentProject();
      if (!active || !current) return;
      await writeLocalProject(current.handle, current.workspace, current.workspace);
      skipPersist.current = true;
      folderHandle.current = current.handle;
      lastWritten.current = current.workspace; workspaceRef.current = current.workspace;
      setWorkspace(current.workspace); setDirectory(current.handle.name); setSelectedSceneId(current.workspace.project.startRoomId);
    })().catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to open the local project.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!folderHandle.current || !workspace) return;
    if (skipPersist.current) { skipPersist.current = false; return; }
    const handle = folderHandle.current;
    setSaving(true);
    if (pendingWrite.current) window.clearTimeout(pendingWrite.current.timer);
    const timer = window.setTimeout(() => {
      pendingWrite.current = null;
      queueWrite(handle, workspace);
    }, 150);
    pendingWrite.current = { timer, handle, workspace };
  }, [workspace, directory]);

  const queueWrite = (handle: FileSystemDirectoryHandle, snapshot: Workspace) => {
    writes.current = writes.current.catch(() => {}).then(async () => {
      await writeLocalProject(handle, snapshot, lastWritten.current ?? undefined);
      lastWritten.current = snapshot;
    });
    void writes.current.then(() => setSaving(false)).catch((error: unknown) => {
      setSaving(false); setMessage(`${error instanceof Error ? error.message : 'Could not write project files.'} Changes are not saved on disk.`);
    });
  };
  const flushWrites = async () => {
    if (pendingWrite.current) {
      const pending = pendingWrite.current;
      window.clearTimeout(pending.timer);
      pendingWrite.current = null;
      queueWrite(pending.handle, pending.workspace);
    }
    await writes.current;
  };

  const refreshLocalProject = async () => {
    const handle = folderHandle.current;
    if (!handle) return;
    await flushWrites();
    const before = workspaceRef.current;
    const atRevision = revision.current;
    const fresh = await readLocalProject(handle, before ?? undefined);
    if (folderHandle.current !== handle || revision.current !== atRevision) return;
    lastWritten.current = fresh;
    if (JSON.stringify(before) !== JSON.stringify(fresh)) {
      skipPersist.current = true;
      workspaceRef.current = fresh;
      setWorkspace(fresh); setPast([]); setFuture([]);
    }
  };

  const chooseSceneBackground = async () => {
    const handle = folderHandle.current;
    const selectedRoom = room;
    if (!handle || !selectedRoom || !window.pcagDesktop) return;
    try {
      const path = await window.pcagDesktop.invoke<string | null>('pick-background', desktopRoot(handle));
      if (!path) return;
      if (rootOf(path) !== 'backgrounds' || !path.split('/').every(validSegment) || !allowedMime(path)?.startsWith('image/')) throw new Error('Choose an image inside this project’s backgrounds folder.');
      await flushWrites();
      const before = workspaceRef.current;
      if (!before) throw new Error('No project is open.');
      const fresh = await readLocalProject(handle, before);
      const asset = fresh.project.assets.find(item => item.path === path);
      if (!asset || !fresh.files.some(file => file.path === path)) throw new Error('The selected background is not a project image.');
      const next = structuredClone(fresh);
      const target = next.project.rooms.find(scene => scene.id === selectedRoom.id);
      if (!target) throw new Error('The selected scene no longer exists.');
      target.backgroundAssetId = asset.id;
      await writeLocalProject(handle, next, fresh);
      lastWritten.current = next; workspaceRef.current = next; revision.current++;
      skipPersist.current = true;
      setPast(current => [...current, fresh]); setFuture([]);
      setWorkspace(next); setMessage(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not select a background.'); }
  };

  useEffect(() => {
    if (!folderHandle.current || (view !== 'Assets' && view !== 'Scenes')) return;
    const refresh = () => { void refreshLocalProject().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not scan the project folder.')); };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [view, directory]);

  useEffect(() => {
    if (!workspace) return;
    if (!workspace.folders.includes(selectedPath) && !workspace.files.some(file => file.path === selectedPath)) setSelectedPath(workspace.folders.includes(parentOf(selectedPath)) ? parentOf(selectedPath) : 'backgrounds');
    if (!workspace.project.rooms.some(scene => scene.id === selectedSceneId)) setSelectedSceneId(workspace.project.startRoomId);
  }, [workspace, selectedPath, selectedSceneId]);

  const projectResult = workspace ? validateProject(workspace.project) : null;
  const filesPresent = workspace?.project.assets.every(asset => workspace.files.some(file => file.path === asset.path)) ?? false;
  const resolutionValid = !!workspace && Number.isSafeInteger(workspace.targetWidth) && Number.isSafeInteger(workspace.targetHeight) && workspace.targetWidth > 0 && workspace.targetHeight > 0 && workspace.targetWidth <= 8192 && workspace.targetHeight <= 8192;
  const ready = !!projectResult?.ok && filesPresent && resolutionValid;
  const room = workspace?.project.rooms.find(scene => scene.id === selectedSceneId) ?? workspace?.project.rooms[0];
  const urls = useMemo(() => workspace ? assetUrls(workspace) : new Map<string, string>(), [workspace]);

  const edit = (change: (next: Workspace) => void) => {
    if (!workspace) return;
    const next = structuredClone(workspace);
    change(next);
    setPast(current => [...current, workspace]);
    setFuture([]);
    workspaceRef.current = next; revision.current++;
    setWorkspace(next);
    setMessage(null);
  };
  const undo = () => {
    if (!workspace || !past.length) return;
    setFuture(current => [workspace, ...current]);
    workspaceRef.current = past[past.length - 1]!; revision.current++;
    setWorkspace(past[past.length - 1]!);
    setPast(past.slice(0, -1));
  };
  const redo = () => {
    if (!workspace || !future.length) return;
    setPast(current => [...current, workspace]);
    workspaceRef.current = future[0]!; revision.current++;
    setWorkspace(future[0]!);
    setFuture(future.slice(1));
  };
  const exportSnapshot = async (): Promise<Workspace> => {
    await flushWrites();
    const fresh = folderHandle.current ? await readLocalProject(folderHandle.current, workspaceRef.current ?? undefined) : workspace;
    if (!fresh) throw new Error('No project is open.');
    const folders: string[] = [];
    for (const path of [...fresh.folders].sort((a, b) => a.length - b.length)) {
      if (path.split('/').every(validSegment) && (!parentOf(path) || folders.includes(parentOf(path)))) folders.push(path);
    }
    const files = fresh.files.filter(file => allowedMime(file.path) === file.mime && folders.includes(parentOf(file.path)));
    const packaged = { ...fresh, folders, files };
    const parsed = parseWorkspace(JSON.stringify(packaged), trustedSvgData.current);
    if (!parsed.ok) throw new Error(parsed.message);
    return parsed.workspace;
  };
  const exportProject = async () => {
    if (!ready || !workspace) return;
    setExportBusy(true); setMessage(null);
    try { await exportWorkspace(await exportSnapshot()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to export project.'); }
    finally { setExportBusy(false); }
  };
  const activate = (next: Workspace, handle: FileSystemDirectoryHandle) => {
    skipPersist.current = true;
    folderHandle.current = handle;
    lastWritten.current = next; workspaceRef.current = next; revision.current++;
    setWorkspace(next); setDirectory(handle.name); setPast([]); setFuture([]); setPreview(null);
    setSelectedSceneId(next.project.startRoomId); setSelectedPath('backgrounds'); setView('Project'); setChoosingProject(false); setMessage(null);
  };
  const create = async (name: string, handle: FileSystemDirectoryHandle) => {
    try {
      await flushWrites();
      await requireEmptyFolder(handle);
      const next = starterWorkspace(name.trim());
      await writeLocalProject(handle, next);
      await useProjectFolder(handle);
      activate(next, handle);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create the project.'); }
  };
  const openDirectory = async (handle: FileSystemDirectoryHandle) => {
    try {
      await flushWrites();
      const workspace = await readLocalProject(handle);
      await writeLocalProject(handle, workspace, workspace);
      await useProjectFolder(handle);
      activate(workspace, handle);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open the project folder.'); }
  };
  const open = async (file: File | undefined, handle: FileSystemDirectoryHandle) => {
    if (!file) return;
    try {
      const text = await decodeWorkspace(new Uint8Array(await file.arrayBuffer()));
      if (text.includes('image/svg+xml')) await loadTrustedSample();
      const parsed = parseWorkspace(text, trustedSvgData.current);
      if (!parsed.ok) { setMessage(parsed.message); return; }
      await flushWrites();
      await requireEmptyFolder(handle);
      await writeLocalProject(handle, parsed.workspace);
      await useProjectFolder(handle);
      activate(parsed.workspace, handle);
    } catch (error) { setMessage(`${error instanceof Error ? error.message : 'Unable to read project file.'} Current project was kept.`); }
  };
  const showWelcome = async () => {
    try { await flushWrites(); setChoosingProject(true); setPreview(null); setMessage(null); }
    catch (error) { setMessage(`${error instanceof Error ? error.message : 'Could not write project files.'} Stay in this project to resolve the write error.`); }
  };
  const closeProject = async () => {
    try {
      await flushWrites();
      if (folderHandle.current) await forgetRecentProject();
      folderHandle.current = null;
      lastWritten.current = null; workspaceRef.current = null; revision.current++;
      setWorkspace(null); setDirectory(null); setPast([]); setFuture([]); setPreview(null);
      setSelectedSceneId(null); setSelectedPath('backgrounds'); setView('Project'); setChoosingProject(false); setMessage(null); setLoadDiagnostics([]);
    } catch (error) { setMessage(`${error instanceof Error ? error.message : 'Could not close the project.'} The project is still open.`); }
  };
  const returnToProject = () => { setChoosingProject(false); setMessage(null); };
  const exportCurrent = async () => {
    if (!ready || !workspace) return;
    setExportBusy(true); setMessage(null);
    try { const fresh = await exportSnapshot(); await exportPlayer(fresh.project, assetUrls(fresh)); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to export player.'); }
    finally { setExportBusy(false); }
  };
  const startPreview = () => {
    if (!ready || !workspace || !room) return;
    const copy = structuredClone(workspace.project);
    copy.startRoomId = room.id;
    setPreview({ project: copy, urls, run: ++run.current });
  };

  return { workspace, directory, loading, choosingProject, saving, create, openDirectory, showWelcome, closeProject, returnToProject, view, setView, selectedPath, setSelectedPath, selectedSceneId, setSelectedSceneId,
    message, messageId: messageEvent?.id, setMessage, loadDiagnostics, exportBusy, preview, setPreview, past, future,
    projectResult, filesPresent, resolutionValid, ready, room, urls,
    edit, undo, redo, refreshLocalProject, chooseSceneBackground, exportProject, open, exportCurrent, startPreview };
}

export type EditorController = ReturnType<typeof useEditorWorkspace>;
