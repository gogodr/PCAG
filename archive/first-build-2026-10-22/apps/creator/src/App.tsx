import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import sample from '../../../examples/foundation/project.json';
import { createProject, createRoom, requireProject, validateProject, validatePlayableProject, type Project, type Point, type Rect } from '../../../packages/project-format/src/index';
import { buildPlayableArchive, downloadFile, fetchPlayerTemplate, loadProject, readImage, readProjectFile, saveProject, serializeProject, validateProjectMedia, STORAGE_KEY } from '../../../packages/project-io/src/index';
import { mountPlayer } from '../../../packages/presentation/src/index';
import { historyReducer } from './history';
import { RoomCanvas } from './RoomCanvas';
import { WorldInspector } from './WorldInspector';
import { duplicateRoom, roomEntities, type Tool } from './world';

function boot() {
  try {
    const saved = loadProject(localStorage), legacy = saved && !localStorage.getItem(STORAGE_KEY);
    return { project: saved ?? requireProject(sample), saved: saved && !legacy ? JSON.stringify(saved) : '', notice: legacy ? 'Your older project is preserved. Set up a character and draw walkable ground before playtesting; saving keeps the original older save separately.' : saved ? 'Your saved project is open.' : 'Explore the study, or build a new adventure with the starter character.' };
  } catch {
    return { project: requireProject(sample), saved: '', notice: 'Your saved project could not be opened. It has been left untouched. Open a backup or save this sample separately.' };
  }
}
function Preview({ project, revision }: { project: Project; revision: number }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => { const player = mountPlayer(host.current!, project); return () => player.dispose(); }, [project, revision]);
  return <div ref={host} data-testid="preview-host" />;
}

export function App() {
  const [initial] = useState(boot), [history, dispatch] = useReducer(historyReducer, { past: [], present: initial.project, future: [] });
  const project = history.present;
  const [roomId, setRoomId] = useState(project.startRoomId), roomIndex = Math.max(0, project.rooms.findIndex(r => r.id === roomId)), room = project.rooms[roomIndex];
  const [selectedId, setSelectedId] = useState<string | null>(room.hotspots[0]?.id ?? null);
  const [saved, setSaved] = useState(initial.saved), [notice, setNotice] = useState(initial.notice), [error, setError] = useState('');
  const [mode, setMode] = useState<'edit' | 'play'>('edit'), [snapshot, setSnapshot] = useState<Project | null>(null), [revision, setRevision] = useState(0);
  const [tool, setTool] = useState<Tool>('select'), [busy, setBusy] = useState(false);
  const projectInput = useRef<HTMLInputElement>(null), backgroundInput = useRef<HTMLInputElement>(null);
  const validation = useMemo(() => validateProject(project), [project]), playable = useMemo(() => validatePlayableProject(project), [project]);
  const dirty = JSON.stringify(project) !== saved, background = project.assets.find(a => a.id === room.backgroundAssetId);
  const edit = (update: (project: Project) => void) => dispatch({ type: 'edit', update });
  const report = (e: unknown) => setError(e instanceof Error ? e.message : 'That operation could not be completed.');
  const selectRoom = (id: string) => { setRoomId(id); setSelectedId(null); setMode('edit'); setTool('select'); };
  const select = (id: string | null) => { setSelectedId(id); setTool('select'); };

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTool('select');
      const target = event.target as HTMLElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && mode === 'edit') { event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [mode]);

  const addShape = (kind: Tool, bounds: Rect) => {
    const id = `${kind}_${crypto.randomUUID()}`;
    const approach = { x: Math.min(room.width - 1, bounds.x + bounds.width / 2), y: room.height * .85, facing: 'right' as const };
    edit(p => {
      const r = p.rooms[roomIndex];
      if (kind === 'hotspot' && r.hotspots.length < 50) r.hotspots.push({ id, name: 'New object', inspection: 'There is more to this than meets the eye.', ...bounds, approach, enabled: true });
      else if (kind === 'walkable' && r.navigation.walkable.length < 8) r.navigation.walkable.push({ id, name: 'Walkable ground', ...bounds });
      else if (kind === 'obstacle' && r.navigation.obstacles.length < 8) r.navigation.obstacles.push({ id, name: 'Obstacle', ...bounds });
      else if (kind === 'exit' && r.exits.length < 12) {
        const target = p.rooms.find(other => other.id !== r.id);
        r.exits.push({ id, name: 'New exit', ...bounds, approach, targetRoomId: target?.id ?? null, targetEntranceId: target?.defaultEntranceId ?? null });
      }
    });
    setSelectedId(id); setTool('select');
  };
  const place = (kind: 'spawn' | 'approach', point: Point) => {
    edit(p => {
      const r = p.rooms[roomIndex];
      if (kind === 'spawn') Object.assign(r.entrances.find(e => e.id === r.defaultEntranceId)!, point);
      else { const e = [...r.hotspots, ...r.exits].find(e => e.id === selectedId); if (e) e.approach = { ...point, facing: e.approach?.facing ?? 'right' }; }
    });
    if (kind === 'spawn') setSelectedId(room.defaultEntranceId);
    setTool('select');
  };
  const save = () => {
    try { saveProject(localStorage, project); setSaved(JSON.stringify(project)); setError(''); setNotice('Saved in this browser. Download a backup to keep a separate copy.'); }
    catch (e) { report(e); setNotice('Save failed. Your last saved project is unchanged. Download a backup if storage is full.'); }
  };
  const replace = (loaded: Project) => { edit(p => Object.assign(p, loaded)); setRoomId(loaded.startRoomId); setSelectedId(loaded.rooms.find(r => r.id === loaded.startRoomId)!.hotspots[0]?.id ?? null); setMode('edit'); setTool('select'); };
  const reopen = () => {
    try { const restored = loadProject(localStorage); if (!restored) throw new Error('There is no saved project in this browser yet. Save first or open a backup.'); replace(restored); setSaved(JSON.stringify(restored)); setError(''); setNotice('Saved project reopened. Undo can restore the previous edits.'); } catch (e) { report(e); }
  };
  const play = async () => {
    setBusy(true); setError('');
    try { await validateProjectMedia(project); setSnapshot(structuredClone(project)); setMode('play'); setTool('select'); }
    catch (e) { report(e); } finally { setBusy(false); }
  };
  const exportGame = async () => {
    setBusy(true); setError('');
    try { await validateProjectMedia(project); const template = await fetchPlayerTemplate(`${import.meta.env.BASE_URL}player-template/`); const zip = buildPlayableArchive(project, template); downloadFile('adventure-game.zip', new Uint8Array(zip).buffer, 'application/zip'); setNotice('Game exported. Extract the ZIP and serve the folder on static web hosting.'); }
    catch (e) { report(e); } finally { setBusy(false); }
  };
  const focusDiagnostic = (entityId: string | undefined, path: string) => {
    setMode('edit'); setTool('select');
    const match = path.match(/^rooms\.(\d+)/), ri = match ? Number(match[1]) : roomIndex;
    if (project.rooms[ri]) setRoomId(project.rooms[ri].id);
    let selected = entityId;
    const index = path.match(/(?:hotspots|exits|entrances|walkable|obstacles|layers)\.(\d+)/);
    if (index) {
      const r = project.rooms[ri], i = Number(index[1]);
      selected = path.includes('hotspots.') ? r.hotspots[i]?.id : path.includes('exits.') ? r.exits[i]?.id : path.includes('entrances.') ? r.entrances[i]?.id : path.includes('walkable.') ? r.navigation.walkable[i]?.id : path.includes('obstacles.') ? r.navigation.obstacles[i]?.id : r.layers[i]?.id;
    }
    if (selected) setSelectedId(selected);
    window.setTimeout(() => {
      const key = path.split('.').at(-1), field = path === 'name' ? 'project-name' : path === 'protagonist' ? 'setup-character' : path.startsWith('protagonist') ? 'character-name' : key === 'navigation' ? 'draw-ground' : key === 'backgroundAssetId' ? 'background-import' : path.includes('.approach.') ? `approach-${key}` : path.includes('targetRoomId') ? 'exit-room' : path.includes('targetEntranceId') ? 'exit-entry' : index ? key === 'name' ? 'entity-name' : `field-${key}` : key === 'name' ? 'field-name' : `room-${key}`;
      document.getElementById(field)?.focus();
    }, 0);
  };
  const removeRoom = () => {
    const next = project.rooms.find(r => r.id !== room.id); if (!next) return;
    edit(p => { p.rooms = p.rooms.filter(r => r.id !== room.id); if (p.startRoomId === room.id) p.startRoomId = next.id; for (const r of p.rooms) for (const e of r.exits) if (e.targetRoomId === room.id) { e.targetRoomId = null; e.targetEntranceId = null; } });
    selectRoom(next.id); setNotice('Room removed. Undo restores it. Reconnect any exits that pointed to it.');
  };

  return <div className="workshop">
    <header className="topbar"><a className="brand" href="./" aria-label="PCAG home"><span className="brand-mark">P<span>·</span></span><span>PCAG<span className="brand-sub">ADVENTURE WORKSHOP</span></span></a><div className="project-heading"><span className="project-dot" /><span>{project.name}</span><span className={`save-state ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'Saved in browser'}</span></div><div className="header-actions"><button onClick={save} disabled={!validation.ok || busy}>Save project</button><button className="button-accent" onClick={() => void exportGame()} disabled={!playable.ok || busy}>{busy ? 'Preparing…' : 'Export game ↗'}</button></div></header>
    <div className="workspace">
      <aside className="sidebar" aria-label="Project library"><div className="sidebar-title"><span>YOUR ADVENTURE</span><span className="small-tag">SCENES</span></div>
        <div className="library-group"><h2>Rooms <span>{String(project.rooms.length).padStart(2, '0')}</span></h2>{project.rooms.map(r => <button key={r.id} className={`room-entry ${r.id === room.id ? 'active-room' : ''}`} aria-label={`Edit room ${r.name}`} onClick={() => selectRoom(r.id)}><span className="room-thumbnail" style={{ backgroundImage: r.backgroundAssetId ? `url(${project.assets.find(a => a.id === r.backgroundAssetId)?.dataUrl})` : undefined }} /><span>{r.name}<small>{r.width} × {r.height}{r.id === project.startRoomId ? ' · START' : ''}</small></span></button>)}<button className="add-object" disabled={project.rooms.length >= 20 || busy} onClick={() => { const r = createRoom(); edit(p => p.rooms.push(r)); selectRoom(r.id); }}>＋ Add room</button></div>
        <div className="library-group"><h2>Objects <span>{String(room.hotspots.length).padStart(2, '0')}</span></h2>{room.hotspots.map((h, i) => <button key={h.id} className={`object-entry ${selectedId === h.id ? 'selected' : ''}`} onClick={() => { setMode('edit'); select(h.id); }}><span className="object-symbol">◇</span><span>{h.name}</span><small>{String(i + 1).padStart(2, '0')}</small></button>)}<button className="add-object" onClick={() => { setMode('edit'); addShape('hotspot', { x: room.width * .4, y: room.height * .4, width: 120, height: 70 }); }} disabled={room.hotspots.length >= 50 || busy}>＋ Add object</button></div>
        <div className="sidebar-bottom"><div className="project-tools"><button disabled={busy} onClick={() => { replace(createProject()); setNotice('New project with a supplied explorer and floor. Customize both before playtesting.'); }}>New project</button><button onClick={reopen} disabled={busy}>Reopen saved</button><button onClick={() => projectInput.current?.click()} disabled={busy}>Open backup</button><button disabled={!validation.ok || busy} onClick={() => { try { downloadFile('adventure.pcag.json', serializeProject(project), 'application/json'); setNotice('Editable backup downloaded. Use Open backup to restore it.'); } catch (e) { report(e); } }}>Download backup</button></div><div className="local-note"><span>◉</span><p>Made here. Kept here.<br /><small>Your projects stay in your browser. Keep a downloaded backup.</small></p></div></div>
      </aside>
      <main className="main-workspace"><div className="workspace-heading"><div><p className="eyebrow">ROOM WORKSPACE</p><h1>{room.name}</h1></div><div className="mode-switch" aria-label="Workspace mode"><button className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>◇ Edit scene</button><button aria-label="Playtest" className={mode === 'play' ? 'active' : ''} disabled={!playable.ok || busy} onClick={() => void play()}>▷ Playtest</button></div></div>
        <div className="scene-toolbar"><div className="toolbar-left">{mode === 'edit' ? <>{([['select', '↖ Select'], ['hotspot', '▧ Draw hotspot'], ['walkable', 'Ground'], ['obstacle', 'Obstacle'], ['exit', 'Exit']] as const).map(([kind, label]) => <button key={kind} className={tool === kind ? 'tool-active' : ''} onClick={() => setTool(kind)}>{label}</button>)}<span className="toolbar-divider" /><button aria-label="Undo" disabled={!history.past.length} onClick={() => dispatch({ type: 'undo' })}>↶</button><button aria-label="Redo" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })}>↷</button></> : <><span className="preview-indicator" /><span>Isolated play session</span><button onClick={() => setRevision(v => v + 1)}>↻ Restart</button></>}</div><span className="canvas-dimensions">{room.width} × {room.height}</span></div>
        <div className="scene-area">{mode === 'play' && snapshot ? <Preview project={snapshot} revision={revision} /> : <RoomCanvas key={`${room.id}-${tool}`} project={project} room={room} selectedId={selectedId} tool={tool} select={select} add={addShape} place={place} />}<div className="canvas-caption"><span>{mode === 'play' ? 'Walk to explore. Choose View, then an object, to hear the protagonist’s observation.' : tool === 'spawn' ? 'Click on walkable ground to place the character’s feet.' : tool === 'approach' ? 'Click where the character should stand to reach the selected object.' : tool !== 'select' ? `Drag to draw ${tool}. Escape cancels. Use the inspector for exact coordinates.` : 'Select objects to edit. Green ground and red obstacles guide the character’s feet.'}</span><span>{mode === 'edit' ? 'EDIT MODE' : 'PLAY MODE'}</span></div></div>
        <section className="guidance"><div className="guidance-icon">✦</div><div><h2>A character. A place. A story.</h2><p>Connect rooms with exits, mark walkable ground, and give your protagonist something to discover.</p></div></section>
        {!playable.ok && <section className="diagnostics" aria-label="Project issues"><h2>{validation.ok ? 'Finish scene setup before playtesting or exporting' : 'A few things to fix before playing or saving'}</h2>{playable.diagnostics.map((d, i) => <button key={i} onClick={() => focusDiagnostic(d.entityId, d.path)}>{d.message}<span>Go to field →</span></button>)}{validation.ok && <p className="field-hint">You can save or back up this unfinished project.</p>}</section>}
        {error && <div className="error-message" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}<div className="notice" role="status">{notice}</div>
      </main>
      <aside className="inspector" aria-label="Inspector"><div className="inspector-heading"><span>INSPECTOR</span><span>⚙</span></div><fieldset disabled={mode === 'play' || busy}>
        <div className="inspector-section"><div className="section-heading"><span className="section-icon">▧</span><h2>Room settings</h2></div><label htmlFor="field-name">Room name</label><input id="field-name" value={room.name} onChange={e => edit(p => { p.rooms[roomIndex].name = e.target.value; })} /><div className="two-fields">{(['width', 'height'] as const).map(key => <div key={key}><label htmlFor={`room-${key}`}>{key === 'width' ? 'Room width' : 'Room height'}</label><input id={`room-${key}`} type="number" value={room[key]} onChange={e => edit(p => { p.rooms[roomIndex][key] = Number(e.target.value); })} /></div>)}</div>
          <label>Background<select value={room.backgroundAssetId ?? ''} onChange={e => edit(p => { p.rooms[roomIndex].backgroundAssetId = e.target.value || null; })}><option value="">No background</option>{project.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><button id="background-import" className="background-button" onClick={() => backgroundInput.current?.click()}>{background ? <img src={background.dataUrl} alt="" /> : <span>＋</span>}<span>{background ? 'Replace background' : 'Import background'}<small>PNG, JPG, WebP · up to 8 MB</small></span></button>
          <label>Starting room<select value={project.startRoomId} onChange={e => edit(p => { p.startRoomId = e.target.value; })}>{project.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><div className="object-actions"><button disabled={project.rooms.length >= 20} onClick={() => { const copy = duplicateRoom(room); edit(p => p.rooms.push(copy)); selectRoom(copy.id); }}>Duplicate room</button><button disabled={project.rooms.length === 1} className="delete-button" onClick={removeRoom}>Delete room</button></div>
        </div>
        <WorldInspector project={project} roomIndex={roomIndex} selectedId={selectedId} edit={edit} select={select} setTool={setTool} report={report} disabled={mode === 'play' || busy} />
        <div className="inspector-section project-settings"><label htmlFor="project-name">Adventure title</label><input id="project-name" value={project.name} onChange={e => edit(p => { p.name = e.target.value; })} /><p className="field-hint">Walk, observe, and travel between rooms. Inventory and physical verb effects are next.</p></div>
      </fieldset></aside>
    </div>
    <footer className="statusbar"><span><i />LOCAL WORKSPACE</span><span>{playable.ok ? '✓ Ready to play' : validation.ok ? 'Draft can be saved' : `${validation.diagnostics.length} project issues`}</span><span>PCAG <b>0.2</b> · ROOMS & EXPLORATION</span></footer>
    <input ref={projectInput} type="file" accept=".json,.pcag.json,application/json" aria-label="Open project file" className="file-input" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); try { const loaded = await readProjectFile(file); replace(loaded); setError(''); setNotice(loaded.protagonist ? 'Backup opened. Save project to keep it in this browser.' : 'Older backup opened without changing the file. Set up a character and draw ground before playtesting.'); } catch (err) { report(err); } finally { setBusy(false); } }} />
    <input ref={backgroundInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Import background file" className="file-input" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setBusy(true); try { const dataUrl = await readImage(file), id = `asset_${crypto.randomUUID()}`; edit(p => { const r = p.rooms.find(r => r.id === room.id); if (p.id === project.id && r) { p.assets.push({ id, name: file.name, dataUrl }); r.backgroundAssetId = id; } }); setError(''); setNotice('Background imported. Existing assets and other rooms are preserved.'); } catch (err) { report(err); } finally { setBusy(false); } }} />
  </div>;
}
