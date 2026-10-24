import { useEffect, useRef, useState } from 'react';
import { newScene } from '../../../../../packages/editor-workspace/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

type Mode = 'create' | 'rename' | null;

export function SceneSwitcher({ editor }: { editor: EditorController }) {
  const { workspace, room, edit, setSelectedSceneId, setPreview, setMessage } = editor;
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mode) { input.current?.focus(); input.current?.select(); } }, [mode]);
  if (!workspace) return null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setMessage('Enter a scene name.'); input.current?.focus(); return; }
    if (mode === 'create') {
      try {
        const scene = newScene(workspace);
        scene.name = trimmed;
        edit(next => { next.project.rooms.push(scene); });
        setSelectedSceneId(scene.id);
        setPreview(null);
        setMode(null);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to add scene.'); }
    } else if (mode === 'rename' && room) {
      edit(next => { next.project.rooms.find(scene => scene.id === room.id)!.name = trimmed; });
      setPreview(null);
      setMode(null);
    }
  };

  return <div className="scene-switcher">
    {mode ? <input ref={input} aria-label="Scene name" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') setMode(null); }} />
      : <select aria-label="Select scene" value={room?.id ?? ''} onChange={event => { setSelectedSceneId(event.target.value); setPreview(null); }}>{workspace.project.rooms.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>}
    <button type="button" className="scene-icon-button" aria-label="Rename scene" title="Rename scene" disabled={!room || !!mode} onClick={() => { if (room) { setName(room.name); setMode('rename'); } }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg></button>
    <button type="button" className="scene-icon-button" aria-label="Add scene" title="Add scene" disabled={!!mode} onClick={() => { setName('New Scene'); setMode('create'); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg></button>
  </div>;
}
