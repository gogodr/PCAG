import { useEffect, useRef, useState } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { basename, parentOf, ROOT_FOLDERS } from '../../../../packages/editor-workspace/src/index';
import type { EditorController } from '../app/useEditorWorkspace';
import { useAssetActions } from '../features/assets/useAssetActions';

type Menu = { x: number; y: number; path: string | null; folder: string };
type Editing = { path: string; folder: string; value: string };
const dragType = 'application/x-pcag-asset-path';

function FileIcon({ kind }: { kind: 'folder' | 'image' | 'audio' | 'file' }) {
  return <img className="asset-icon" src={`${import.meta.env.BASE_URL}icons/${kind}.png`} alt="" aria-hidden="true" />;
}

export function AssetsView({ editor }: { editor: EditorController }) {
  const input = useRef<HTMLInputElement>(null);
  const importTarget = useRef<string | null>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [browseRoot, setBrowseRoot] = useState(false);
  const [stayingFolder, setStayingFolder] = useState<string | null>(null);
  const { workspace, selectedPath, setSelectedPath } = editor;
  const actions = useAssetActions(editor);
  const currentFolder = browseRoot ? '' : editing?.folder ?? stayingFolder ?? (workspace?.folders.includes(selectedPath) ? selectedPath : parentOf(selectedPath));
  useEffect(() => {
    if (!editing || !workspace) return;
    renameInput.current?.focus();
    const dot = editing.value.lastIndexOf('.');
    const isFile = workspace.files.some(file => file.path === editing.path);
    renameInput.current?.setSelectionRange(0, isFile && dot > 0 ? dot : editing.value.length);
  }, [editing?.path, workspace]);
  if (!workspace) return null;
  const folders = browseRoot ? [...ROOT_FOLDERS] : workspace.folders.filter(path => parentOf(path) === currentFolder).sort();
  const files = workspace.files.filter(file => parentOf(file.path) === currentFolder).sort((a, b) => a.path.localeCompare(b.path));
  const crumbs = currentFolder ? currentFolder.split('/') : [];
  const navigate = (path: string) => { setBrowseRoot(false); setStayingFolder(null); setEditing(null); setSelectedPath(path); setMenu(null); };
  const finishRename = () => {
    if (!editing) return;
    if (actions.rename(editing.path, editing.value)) { setStayingFolder(editing.folder); setEditing(null); }
    else window.setTimeout(() => renameInput.current?.focus(), 0);
  };
  const openMenu = (event: MouseEvent, path: string | null, folder = currentFolder) => {
    event.preventDefault(); event.stopPropagation();
    if (path && workspace.folders.includes(path)) setStayingFolder(currentFolder);
    if (path) setSelectedPath(path);
    setMenu({ x: event.clientX, y: event.clientY, path, folder });
  };
  const receiveDrop = (event: DragEvent, folder: string) => {
    event.preventDefault(); event.stopPropagation(); setDragOver(null);
    const source = event.dataTransfer.getData(dragType);
    if (source) actions.move(source, folder);
    else if (event.dataTransfer.files.length) void actions.addFiles(Array.from(event.dataTransfer.files), folder);
  };
  const dragProps = (folder: string) => ({
    onDragOver: (event: DragEvent) => { if (event.dataTransfer.types.includes(dragType) || event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragOver(folder); } },
    onDragLeave: () => setDragOver(null),
    onDrop: (event: DragEvent) => receiveDrop(event, folder),
  });
  const beginRename = (path: string) => { setBrowseRoot(false); setStayingFolder(parentOf(path)); setEditing({ path, folder: parentOf(path), value: basename(path) }); setMenu(null); };
  const menuAction = (action: 'copy' | 'cut' | 'rename' | 'delete' | 'paste' | 'import' | 'newFolder') => {
    if (!menu) return;
    if (action === 'copy' || action === 'cut') actions.setClipboard({ path: menu.path!, cut: action === 'cut' });
    if (action === 'rename') beginRename(menu.path!);
    if (action === 'delete') actions.remove();
    if (action === 'paste') actions.paste(menu.folder);
    if (action === 'import') { importTarget.current = menu.folder; input.current?.click(); }
    if (action === 'newFolder') { const path = actions.addFolder(menu.folder); if (path) { setStayingFolder(menu.folder); setEditing({ path, folder: menu.folder, value: basename(path) }); } }
    setMenu(null);
  };
  const fileKind = (path: string) => workspace.folders.includes(path) ? 'folder' : workspace.files.find(file => file.path === path)?.mime.startsWith('image/') ? 'image' : workspace.files.find(file => file.path === path)?.mime.startsWith('audio/') ? 'audio' : 'file';
  const row = (path: string) => editing?.path === path ? <div key={path} className="asset-row selected"><FileIcon kind={fileKind(path)} /><input ref={renameInput} className="asset-inline-name" aria-label="File or folder name" value={editing.value} onChange={event => setEditing({ ...editing, value: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setEditing(null); }} /><small>{workspace.folders.includes(path) ? 'Folder' : 'File'}</small></div> : <button key={path} type="button" className={`asset-row ${selectedPath === path ? 'selected' : ''} ${actions.clipboard?.cut && actions.clipboard.path === path ? 'cut' : ''} ${dragOver === path ? 'drop-target' : ''}`}
    draggable={!actions.isRoot(path)} onDragStart={event => { event.dataTransfer.setData(dragType, path); event.dataTransfer.effectAllowed = 'move'; }}
    onClick={() => navigate(path)} onDoubleClick={() => { if (workspace.folders.includes(path)) navigate(path); }}
    onContextMenu={event => openMenu(event, path, workspace.folders.includes(path) ? path : currentFolder)}
    {...(workspace.folders.includes(path) ? dragProps(path) : {})}>
    <FileIcon kind={fileKind(path)} /><span>{basename(path)}</span><small>{workspace.folders.includes(path) ? 'Folder' : workspace.files.find(file => file.path === path)?.mime.startsWith('image/') ? 'Image' : workspace.files.find(file => file.path === path)?.mime.startsWith('audio/') ? 'Audio' : 'File'}</small>
  </button>;

  return <div className="asset-explorer" onClick={() => menu && setMenu(null)}>
    <div className="asset-toolbar"><nav aria-label="Asset path" className="asset-breadcrumb"><button type="button" onClick={() => setBrowseRoot(true)}>project</button>{crumbs.map((part, index) => <span key={index}><span className="crumb-separator">›</span><button type="button" onClick={() => navigate(crumbs.slice(0, index + 1).join('/'))}>{part}</button></span>)}</nav><button type="button" onClick={() => { void editor.refreshLocalProject().catch((error: unknown) => editor.setMessage(error instanceof Error ? error.message : 'Could not scan the project folder.')); }}>Refresh</button></div>
    <div className="asset-explorer-body">
      <aside className="panel asset-places" aria-label="Asset folders"><h2>Project files</h2>{ROOT_FOLDERS.map(folder => <button type="button" key={folder} className={`asset-place ${currentFolder === folder || currentFolder.startsWith(`${folder}/`) ? 'active' : ''} ${dragOver === folder ? 'drop-target' : ''}`} onClick={() => navigate(folder)} onContextMenu={event => openMenu(event, folder, folder)} {...dragProps(folder)}><FileIcon kind="folder" />{folder}</button>)}</aside>
      <section className={`panel asset-list ${dragOver === currentFolder ? 'drop-target' : ''}`} aria-label="Folder contents" onContextMenu={event => openMenu(event, null)} {...(currentFolder ? dragProps(currentFolder) : {})}>
        <div className="asset-list-header"><h2>{currentFolder ? basename(currentFolder) : 'Project'}</h2><span>{folders.length + files.length} items</span></div>
        {currentFolder.includes('/') && <button type="button" className="asset-row up" onClick={() => navigate(parentOf(currentFolder))}><FileIcon kind="folder" /><span>..</span><small>Parent folder</small></button>}
        {folders.map(row)}{files.map(file => row(file.path))}
        {!folders.length && !files.length && <p className="asset-empty">This folder is empty. Drop files here or import them.</p>}
      </section>
      <aside className="panel asset-detail" aria-label="Asset preview"><h2>Preview</h2><div className="asset-preview-media">{actions.selectedFile?.mime.startsWith('image/') ? <img src={actions.selectedFile.dataUrl} alt={basename(selectedPath)} /> : actions.selectedFile?.mime.startsWith('audio/') ? <audio controls src={actions.selectedFile.dataUrl} /> : <FileIcon kind={actions.selectedFile ? 'file' : 'folder'} />}</div><p>{actions.selectedFile ? `${actions.selectedFile.mime} · ${Math.round(actions.selectedFile.dataUrl.length * .75 / 1024)} KB` : 'Folder'}</p>
        <input ref={input} className="file-input" type="file" multiple aria-label="Asset files" onChange={event => { void actions.addFiles(event.target.files, importTarget.current ?? currentFolder); importTarget.current = null; event.target.value = ''; }} />
      </aside>
    </div>
    {menu && <div className="asset-context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>{menu.path && !actions.isRoot(menu.path) ? <>{(['copy', 'cut', 'rename', 'delete'] as const).map(action => <button role="menuitem" type="button" key={action} onClick={() => menuAction(action)}>{action[0]!.toUpperCase() + action.slice(1)}</button>)}</> : <><button role="menuitem" type="button" disabled={!actions.clipboard || !menu.folder} onClick={() => menuAction('paste')}>Paste</button><button role="menuitem" type="button" disabled={!menu.folder} onClick={() => menuAction('import')}>Import files</button><button role="menuitem" type="button" disabled={!menu.folder} onClick={() => menuAction('newFolder')}>New folder</button></>}</div>}
  </div>;
}
