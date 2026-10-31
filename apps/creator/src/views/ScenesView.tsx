import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { basename } from '../../../../packages/editor-workspace/src/index';
import { createId } from '../../../../packages/project-format/src/index';
import type { Element, Point } from '../../../../packages/project-format/src/index';
import { movePolygon, polygonBounds } from '../../../../packages/project-format/src/element-geometry';
import type { EditorController } from '../app/useEditorWorkspace';
import { UiIcon } from '../components/UiIcon';
import { ElementInspector } from '../features/scenes/ElementInspector';
import { SceneCanvas } from '../features/scenes/SceneCanvas';
import { SceneManagerInspector } from '../features/scenes/SceneManagerInspector';
import { StateVariablesInspector } from '../features/scenes/StateVariablesInspector';

const sceneStateSelection = '$scene-state';
const gameStateSelection = '$game-state';
const sceneManagerSelection = '$scene-manager';

function ElementFlagIcon({ flag, active }: { flag: 'enabled' | 'visible' | 'locked'; active: boolean }) {
  return <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {flag === 'enabled' ? <><path d="M12 2v9" /><path d="M6.4 5.8a9 9 0 1 0 11.2 0" />{!active && <path d="M3 21 21 3" />}</>
      : flag === 'visible' ? <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" />{!active && <path d="M3 21 21 3" />}</>
        : <><rect x="5" y="10" width="14" height="11" rx="2" /><path d={active ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M8 10V7a4 4 0 0 1 7.5-2'} /></>}
  </svg>;
}

export function ScenesView({ editor }: { editor: EditorController }) {
  const { workspace, room, urls, edit, chooseSceneBackground, setMessage } = editor;
  const [selected, setSelected] = useState('background');
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setSelected('background'); setDragged(null); setDropTarget(null); setMenu(null); setAddMenuOpen(false); setEditing(null); }, [room?.id]);
  useEffect(() => { if (editing) { renameInput.current?.focus(); renameInput.current?.select(); } }, [editing?.id]);
  if (!workspace) return null;

  const background = workspace.project.assets.find(asset => asset.id === room?.backgroundAssetId);
  const element = room?.elements.find(item => item.id === selected);
  const selectedBackground = selected === 'background' || (selected !== sceneStateSelection && selected !== gameStateSelection && selected !== sceneManagerSelection && !element);
  // The array is back-to-front for Phaser; the tree displays the frontmost item first.
  const frontToBack = [...(room?.elements ?? [])].reverse();
  const addElement = (type: 'box' | 'shape' | 'image') => {
    if (!room) return;
    const id = createId();
    let name = 'Element';
    for (let number = 2; room.elements.some(item => item.name === name); number++) name = `Element ${number}`;
    const width = Math.min(type === 'box' ? 160 : 100, room.width);
    const height = Math.min(100, room.height);
    const x = Math.round((room.width - width) / 2), y = Math.round((room.height - height) / 2);
    const item: Element = { id, name, type, enabled: true, visible: true, locked: false, bounds: { x, y, width, height } };
    if (type === 'shape') item.vertices = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
    if (type === 'image') item.media = { path: '', kind: 'image', width, height, preserveAspectRatio: true, loop: true, reverse: false };
    edit(next => {
      next.project.rooms.find(scene => scene.id === room.id)!.elements.push(item);
    });
    setSelected(id);
    setEditing({ id, value: name });
    setAddMenuOpen(false);
  };
  const openMenu = (event: MouseEvent, id: string) => {
    event.preventDefault(); event.stopPropagation();
    setSelected(id);
    setAddMenuOpen(false);
    setMenu({ x: event.clientX, y: event.clientY, id });
  };
  const finishRename = () => {
    if (!room || !editing) return;
    const name = (editing.value ?? '').trim();
    if (!name) { setMessage('Enter an element name.'); renameInput.current?.focus(); return; }
    if (room.elements.find(item => item.id === editing.id)?.name !== name && room.elements.find(item => item.id === editing.id)?.locked !== true) edit(next => {
      next.project.rooms.find(scene => scene.id === room.id)!.elements.find(item => item.id === editing.id)!.name = name;
    });
    setEditing(null);
  };
  const menuAction = (action: 'rename' | 'clone' | 'delete') => {
    if (!room || !menu || menu.id === 'background') return;
    const item = room.elements.find(candidate => candidate.id === menu.id);
    if (!item) { setMenu(null); return; }
    if (item.locked === true && action !== 'clone') { setMenu(null); return; }
    if (action === 'rename') setEditing({ id: item.id, value: item.name ?? '' });
    if (action === 'clone') {
      const id = createId();
      const base = `${item.name} copy`;
      let name = base;
      for (let number = 2; room.elements.some(candidate => candidate.name === name); number++) name = `${base} ${number}`;
      edit(next => {
        const elements = next.project.rooms.find(scene => scene.id === room.id)!.elements;
        const index = elements.findIndex(candidate => candidate.id === item.id);
        elements.splice(index + 1, 0, { ...structuredClone(item), id, name });
      });
      setSelected(id);
    }
    if (action === 'delete') {
      edit(next => {
        const scene = next.project.rooms.find(candidate => candidate.id === room.id)!;
        scene.elements = scene.elements.filter(candidate => candidate.id !== item.id);
      });
      setSelected('background');
    }
    setMenu(null);
  };
  const moveElement = (sourceId: string, targetId: string, after: boolean) => {
    if (!room || sourceId === targetId) return;
    if (room.elements.find(item => item.id === sourceId)?.locked === true) return;
    const order = frontToBack.map(item => item.id);
    const from = order.indexOf(sourceId);
    if (from < 0) return;
    order.splice(from, 1);
    const target = targetId === 'background' ? order.length : order.indexOf(targetId);
    if (target < 0) return;
    order.splice(targetId === 'background' ? target : target + Number(after), 0, sourceId);
    if (order.every((id, index) => id === frontToBack[index]?.id)) return;
    edit(next => {
      const scene = next.project.rooms.find(item => item.id === room.id)!;
      const byId = new Map(scene.elements.map(item => [item.id, item]));
      scene.elements = order.reverse().map(id => byId.get(id)!);
    });
  };
  const moveCanvasElement = (id: string, x: number, y: number) => {
    if (!room) return;
    const current = room.elements.find(item => item.id === id);
    if (!current || current.locked === true || (current.bounds.x === x && current.bounds.y === y)) return;
    edit(next => {
      const selected = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(item => item.id === id);
      if (selected && selected.locked !== true) {
        if (selected.type === 'shape' && selected.vertices) selected.vertices = movePolygon(selected.vertices, x - selected.bounds.x, y - selected.bounds.y, room.width, room.height);
        selected.bounds.x = x; selected.bounds.y = y;
      }
    });
  };
  const changeShape = (id: string, vertices: Point[]) => {
    if (!room) return;
    edit(next => {
      const selected = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(item => item.id === id);
      if (selected?.type === 'shape' && selected.locked !== true) { selected.vertices = vertices; selected.bounds = polygonBounds(vertices); }
    });
  };
  const toggleElement = (id: string, flag: 'enabled' | 'visible' | 'locked') => {
    if (!room) return;
    edit(next => {
      const item = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(candidate => candidate.id === id);
      if (item) item[flag] = flag === 'locked' ? item.locked !== true : item[flag] === false;
    });
  };
  return <div className="scenes-view" onClick={() => { setMenu(null); setAddMenuOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setMenu(null); setAddMenuOpen(false); } }}>
    <aside className="panel scene-elements" aria-label="Scene elements">
      <div className="scene-elements-header"><p className="sidebar-label">Elements</p><button type="button" className="scene-add-button" aria-label="Add element" aria-haspopup="menu" aria-expanded={addMenuOpen} disabled={!room} onClick={event => { event.stopPropagation(); setMenu(null); setAddMenuOpen(!addMenuOpen); }}><UiIcon name="add" /></button></div>
      {addMenuOpen && <div className="asset-context-menu scene-add-menu" role="menu" aria-label="Add element type" onClick={event => event.stopPropagation()}>{(['box', 'shape', 'image'] as const).map(type => <button type="button" role="menuitem" key={type} onClick={() => addElement(type)}>{type.charAt(0).toUpperCase() + type.slice(1)} element</button>)}</div>}
      {room && <div role="tree" aria-label="Scene element tree" className="scene-tree">
        {frontToBack.map(item => <div key={item.id} className={`scene-element-row${item.visible === false ? ' hidden' : ''}${item.enabled === false ? ' disabled' : ''}${item.locked === true ? ' locked' : ''}${dropTarget?.id === item.id ? dropTarget.after ? ' drop-after' : ' drop-before' : ''}`}
          onDragOver={event => { if (!dragged || dragged === item.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget({ id: item.id, after: event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 }); }}
          onDrop={event => { if (!dragged) return; event.preventDefault(); moveElement(dragged, item.id, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2); setDragged(null); setDropTarget(null); }}>
          {editing?.id === item.id ? <div className="scene-tree-edit"><img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/material/touch-app.svg`} alt="" aria-hidden="true" /><input ref={renameInput} aria-label="Rename element" value={editing.value ?? ''} onChange={event => { const value = event.currentTarget.value; setEditing(current => current?.id === item.id ? { ...current, value } : current); }} onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setEditing(null); }} /></div> : <button type="button" role="treeitem" aria-level={1} aria-selected={selected === item.id} draggable={item.locked !== true} title={item.locked === true ? 'Unlock to reorder' : 'Drag to reorder'} className={`${selected === item.id ? 'selected ' : ''}${dragged === item.id ? 'dragging ' : ''}`}
          onClick={() => setSelected(item.id)}
          onContextMenu={event => openMenu(event, item.id)}
          onDragStart={event => { if (item.locked === true) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); setDragged(item.id); }}
          onDragEnd={() => { setDragged(null); setDropTarget(null); }}>
            <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/material/touch-app.svg`} alt="" aria-hidden="true" /><span>{item.name}</span>
          </button>}
          <div className="scene-element-flags" role="group" aria-label={`${item.name} controls`}>{(['enabled', 'visible', 'locked'] as const).map(flag => { const active = flag === 'locked' ? item.locked === true : item[flag] !== false; const action = flag === 'enabled' ? active ? 'Disable' : 'Enable' : flag === 'visible' ? active ? 'Hide' : 'Show' : active ? 'Unlock' : 'Lock'; return <button key={flag} type="button" className={active ? 'active' : ''} aria-label={`${action} ${item.name}`} title={`${action} ${item.name}`} aria-pressed={active} onClick={event => { event.stopPropagation(); toggleElement(item.id, flag); }}><ElementFlagIcon flag={flag} active={active} /></button>; })}</div>
        </div>)}
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === sceneStateSelection} className={selected === sceneStateSelection ? 'selected' : ''} onClick={() => setSelected(sceneStateSelection)}>
          <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/material/description.svg`} alt="" aria-hidden="true" /><span>SceneState</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === gameStateSelection} className={selected === gameStateSelection ? 'selected' : ''} onClick={() => setSelected(gameStateSelection)}>
          <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/project.svg`} alt="" aria-hidden="true" /><span>GameState</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === sceneManagerSelection} className={selected === sceneManagerSelection ? 'selected' : ''} onClick={() => setSelected(sceneManagerSelection)}>
          <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/material/description.svg`} alt="" aria-hidden="true" /><span>SceneManager</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selectedBackground} className={`${selectedBackground ? 'selected ' : ''}${dropTarget?.id === 'background' ? 'drop-before' : ''}`} onClick={() => setSelected('background')} onContextMenu={event => openMenu(event, 'background')}
          onDragOver={event => { if (!dragged) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget({ id: 'background', after: false }); }}
          onDrop={event => { event.preventDefault(); if (dragged) moveElement(dragged, 'background', false); setDragged(null); setDropTarget(null); }}>
          <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/material/image.svg`} alt="" aria-hidden="true" /><span>Background</span>
        </button>
      </div>}
    </aside>

    {room && <SceneCanvas key={room.id} room={room} backgroundUrl={urls.get(background?.path ?? '') ?? ''} assetUrls={urls} selectedElementId={element?.id ?? null} onSelectElement={setSelected} onMoveElement={moveCanvasElement} onChangeShape={changeShape} />}

    <section className="panel scene-inspector" aria-label="Inspector">
      <p className="sidebar-label">Inspector</p>
      {selectedBackground ? <>
        <h3>Background</h3>
        <p className="subtle">The root image for this scene. Choose a file from this project’s backgrounds folder.</p>
        {room && (window.pcagDesktop ? <label>Background file<input aria-label="Scene background" value={background?.path ?? ''} readOnly /><button type="button" className="scene-browse" disabled={!editor.directory} onClick={() => { void chooseSceneBackground(); }}>Browse backgrounds…</button></label>
          : <label>Background file<select aria-label="Scene background" value={room.backgroundAssetId} onChange={event => edit(next => { next.project.rooms.find(scene => scene.id === room.id)!.backgroundAssetId = event.target.value; })}>{workspace.project.assets.filter(asset => asset.path.startsWith('backgrounds/')).map(asset => <option key={asset.id} value={asset.id}>{basename(asset.path)}</option>)}</select></label>)}
      </> : selected === sceneStateSelection && room ? <StateVariablesInspector scope="scene" roomId={room.id} rooms={workspace.project.rooms} variables={room.sceneState} edit={edit} setMessage={setMessage} />
        : selected === gameStateSelection && room ? <StateVariablesInspector scope="game" roomId={room.id} rooms={workspace.project.rooms} variables={workspace.project.gameState} edit={edit} setMessage={setMessage} />
        : selected === sceneManagerSelection && room ? <SceneManagerInspector room={room} gameState={workspace.project.gameState} edit={edit} />
        : room && element && <ElementInspector room={room} element={element} files={workspace.files} edit={edit} locked={element.locked === true} />}
    </section>
    {menu && <div className="asset-context-menu" role="menu" aria-label="Element actions" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>
      {(['rename', 'clone', 'delete'] as const).map(action => <button type="button" role="menuitem" key={action} disabled={menu.id === 'background' || (action !== 'clone' && room?.elements.find(item => item.id === menu.id)?.locked === true)} title={menu.id === 'background' ? 'The scene background is required.' : undefined} onClick={() => menuAction(action)}>{action[0]!.toUpperCase() + action.slice(1)}</button>)}
    </div>}
  </div>;
}
