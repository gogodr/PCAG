import { useState } from 'react';
import { createId } from '../../../../../packages/project-format/src/index';
import { allowedMime, basename, matchesFileSignature, parentOf, ROOT_FOLDERS, rootOf, validSegment } from '../../../../../packages/editor-workspace/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

export function useAssetActions(editor: EditorController) {
  const [clipboard, setClipboard] = useState<{ path: string; cut: boolean } | null>(null);
  const { workspace, selectedPath, setSelectedPath, setMessage, edit } = editor;
  const selectedFile = workspace?.files.find(file => file.path === selectedPath);
  const selectedFolder = workspace?.folders.includes(selectedPath) ?? false;
  const parentFolder = selectedFolder ? selectedPath : parentOf(selectedPath);
  const exists = (path: string) => !!workspace && (workspace.folders.includes(path) || workspace.files.some(file => file.path === path));
  const isRoot = (path: string) => ROOT_FOLDERS.includes(path as typeof ROOT_FOLDERS[number]);
  const supports = (path: string, mime: string) => allowedMime(path) === mime || (mime === 'application/octet-stream' && !allowedMime(path));
  const replacement = (source: string, target: string) => (path: string) => path === source ? target : path.startsWith(`${source}/`) ? `${target}${path.slice(source.length)}` : path;

  const addFolder = (folder: string): string | null => {
    if (!workspace || !workspace.folders.includes(folder)) return null;
    let name = 'New Folder';
    for (let number = 2; exists(`${folder}/${name}`); number++) name = `New Folder ${number}`;
    const path = `${folder}/${name}`;
    edit(next => { next.folders.push(path); }); setSelectedPath(path);
    return path;
  };
  const move = (source: string, destination: string, copy = false, renameOnConflict = false) => {
    if (!workspace || !exists(source) || !workspace.folders.includes(destination) || isRoot(source)) return false;
    if (source === destination || destination.startsWith(`${source}/`)) { setMessage('A folder cannot be moved into itself.'); return false; }
    const sourceFile = workspace.files.find(file => file.path === source);
    let target = `${destination}/${basename(source)}`;
    if (source === target && !copy) return true;
    if (exists(target)) {
      if (!renameOnConflict || !sourceFile) { setMessage('That name is already used in the destination folder.'); return false; }
      const name = basename(source);
      const dot = name.lastIndexOf('.');
      const stem = name.slice(0, dot).replace(/\(\d+\)$/, '');
      const extension = name.slice(dot);
      for (let number = 2; ; number++) {
        const candidate = `${destination}/${stem}(${number})${extension}`;
        if (!exists(candidate)) { target = candidate; break; }
      }
    }
    const affected = workspace.files.filter(file => file.path === source || file.path.startsWith(`${source}/`));
    const replace = replacement(source, target);
    if (affected.some(file => !supports(replace(file.path), file.mime))) { setMessage('The destination folder does not support this file type.'); return false; }
    if (!copy && workspace.project.rooms.some(scene => affected.some(file => file.id === scene.backgroundAssetId)) && rootOf(target) !== 'backgrounds') { setMessage('A scene background must stay in the backgrounds folder.'); return false; }
    edit(next => {
      const folders = next.folders.filter(path => path === source || path.startsWith(`${source}/`)).map(replace);
      if (copy) {
        next.folders.push(...folders);
        for (const file of affected) {
          const id = createId(); const path = replace(file.path);
          next.files.push({ ...file, id, path });
          if (rootOf(path) === 'backgrounds' || rootOf(path) === 'images') next.project.assets.push({ id, name: basename(path), kind: 'image', path });
        }
      } else {
        next.folders = next.folders.map(replace);
        next.files = next.files.map(file => ({ ...file, path: replace(file.path) }));
        next.project.assets = next.project.assets.map(asset => ({ ...asset, path: replace(asset.path), name: asset.path === source ? basename(target) : asset.name }));
      }
    });
    setSelectedPath(target);
    return true;
  };
  const rename = (source: string, name: string): boolean => {
    if (!workspace || isRoot(source)) { setMessage('Root folders keep their names.'); return false; }
    if (!validSegment(name)) { setMessage('Enter a valid name using letters, numbers, spaces, underscores, dots, or hyphens.'); return false; }
    const path = `${parentOf(source)}/${name}`;
    if (path !== source && exists(path)) { setMessage('That name is already used in this folder.'); return false; }
    const file = workspace.files.find(item => item.path === source);
    if (file && !supports(path, file.mime)) { setMessage('Keep the file extension and type supported by its folder.'); return false; }
    if (path === source) return true;
    const replace = replacement(source, path);
    edit(next => {
      next.folders = next.folders.map(replace);
      next.files = next.files.map(file => ({ ...file, path: replace(file.path) }));
      next.project.assets = next.project.assets.map(asset => ({ ...asset, path: replace(asset.path), name: asset.path === source ? name : asset.name }));
    });
    setSelectedPath(path);
    return true;
  };
  const remove = () => {
    if (!workspace || isRoot(selectedPath)) { setMessage('Root folders cannot be removed.'); return; }
    const affected = workspace.files.filter(file => file.path === selectedPath || file.path.startsWith(`${selectedPath}/`));
    const affectedAssets = workspace.project.assets.filter(asset => affected.some(file => file.path === asset.path));
    if (workspace.project.rooms.some(scene => affectedAssets.some(asset => asset.id === scene.backgroundAssetId))) { setMessage('This background is used by a scene. Choose another background in Scenes before removing it.'); return; }
    edit(next => {
      next.files = next.files.filter(file => !affected.some(item => item.id === file.id));
      next.project.assets = next.project.assets.filter(asset => !affectedAssets.some(item => item.id === asset.id));
      next.folders = next.folders.filter(folder => folder !== selectedPath && !folder.startsWith(`${selectedPath}/`));
    });
    setSelectedPath(parentOf(selectedPath));
  };
  const addFiles = async (files: FileList | File[] | null, folder = parentFolder) => {
    if (!workspace || !files?.length || !workspace.folders.includes(folder)) return;
    const additions: { path: string; mime: string; dataUrl: string; id: string }[] = [];
    for (const file of Array.from(files)) {
      const path = `${folder}/${file.name}`;
      const mime = allowedMime(path);
      if (!validSegment(file.name) || !mime || file.size === 0 || file.size > 10_000_000 || exists(path) || additions.some(item => item.path === path)) { setMessage(`Cannot add ${file.name}: unsupported type, duplicate name, empty file, or file over 10 MB.`); return; }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesFileSignature(mime, bytes)) { setMessage(`Cannot add ${file.name}: file contents do not match its extension.`); return; }
      let binary = '';
      for (let start = 0; start < bytes.length; start += 8192) binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
      additions.push({ id: createId(), path, mime, dataUrl: `data:${mime};base64,${btoa(binary)}` });
    }
    edit(next => {
      for (const file of additions) {
        next.files.push(file);
        if (rootOf(file.path) === 'backgrounds' || rootOf(file.path) === 'images') next.project.assets.push({ id: file.id, name: basename(file.path), kind: 'image', path: file.path });
      }
    });
    setSelectedPath(additions[0]!.path);
  };
  const paste = (destination: string) => {
    if (!clipboard) return;
    if (move(clipboard.path, destination, !clipboard.cut, true) && clipboard.cut) setClipboard(null);
  };
  return { selectedFile, parentFolder, clipboard, setClipboard, addFolder, rename, remove, addFiles, move, paste, isRoot };
}
