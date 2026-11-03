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
import { PlayerInspector } from '../features/scenes/PlayerInspector';
import { WalkableAreaInspector } from '../features/scenes/WalkableAreaInspector';
import { SceneKindIcon } from '../features/scenes/SceneKindIcon';

const sceneStateSelection = '$scene-state';
const gameStateSelection = '$game-state';
const sceneManagerSelection = '$scene-manager';
const playerSelection = '$player';
const walkableSelection = '$walkable-area';

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
  const element = room?.elements.find(item => item.game_id === selected);
  const selectedBackground = selected === 'background' || (selected !== sceneStateSelection && selected !== gameStateSelection && selected !== sceneManagerSelection && selected !== playerSelection && selected !== walkableSelection && !element);
  const inspectorKind = selectedBackground ? 'background' : element?.type ?? (selected === sceneStateSelection ? 'sceneState' : selected === gameStateSelection ? 'gameState' : selected === sceneManagerSelection ? 'sceneManager' : selected === playerSelection ? 'player' : 'walkable');
  const inspectorTitle = selectedBackground ? 'Background' : element?.element_id || (selected === sceneStateSelection ? 'SceneState' : selected === gameStateSelection ? 'GameState' : selected === sceneManagerSelection ? 'SceneManager' : selected === playerSelection ? 'Player' : 'Walkable Area');
  const inspectorType = selectedBackground ? 'Scene image' : element ? `${element.type ?? 'box'} element` : selected === sceneStateSelection ? 'Scene variables' : selected === gameStateSelection ? 'Shared variables' : selected === sceneManagerSelection ? 'Events and scripts' : selected === playerSelection ? 'Character' : 'Movement mask';
  const inspectorDetail = element ? element.game_id : selectedBackground ? `${room?.width ?? 0} × ${room?.height ?? 0} px` : selected === sceneStateSelection ? `${Object.keys(room?.sceneState ?? {}).length} ${Object.keys(room?.sceneState ?? {}).length === 1 ? 'variable' : 'variables'}` : selected === gameStateSelection ? `${Object.keys(workspace.project.gameState).length} ${Object.keys(workspace.project.gameState).length === 1 ? 'variable' : 'variables'}` : selected === sceneManagerSelection ? `${room?.sceneManager?.events.length ?? 0} ${(room?.sceneManager?.events.length ?? 0) === 1 ? 'event' : 'events'}` : selected === playerSelection ? 'Starting position and animation' : 'Background aligned image';
  // The array is back-to-front for Phaser; the tree displays the frontmost item first.
  const frontToBack = [...(room?.elements ?? [])].reverse();
  const orderedRows: ({ kind: 'element'; item: Element } | { kind: 'player' })[] = frontToBack.map(item => ({ kind: 'element', item }));
  if (room) orderedRows.splice(room.elements.length - (room.player?.layer ?? room.elements.length), 0, { kind: 'player' });
  const frontToBackIds = orderedRows.map(row => row.kind === 'player' ? playerSelection : row.item.game_id);
  const addElement = (type: 'box' | 'shape' | 'image' | 'overlay') => {
    if (!room) return;
    const id = createId();
    const baseName = type === 'overlay' ? 'Overlay' : 'Element';
    let name = baseName;
    for (let number = 2; room.elements.some(item => item.element_id === name); number++) name = `${baseName} ${number}`;
    const width = Math.min(type === 'box' ? 160 : 100, room.width);
    const height = Math.min(100, room.height);
    const x = Math.round((room.width - width) / 2), y = Math.round((room.height - height) / 2);
    const item: Element = { game_id: id, element_id: name, ...(type === 'overlay' ? {} : { name }), type, enabled: true, visible: true, locked: false, availableActions: type === 'overlay' ? [] : ['view'], bounds: type === 'overlay' ? { x: 0, y: 0, width: room.width, height: room.height } : { x, y, width, height } };
    if (type === 'shape') item.vertices = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
    if (type === 'image' || type === 'overlay') item.media = { path: '', kind: 'image', width: type === 'overlay' ? room.width : width, height: type === 'overlay' ? room.height : height, preserveAspectRatio: true, loop: true, reverse: false };
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
    if (!name) { setMessage('Enter an Element ID.'); renameInput.current?.focus(); return; }
    if (room.elements.find(item => item.game_id === editing.id)?.element_id !== name) edit(next => {
      next.project.rooms.find(scene => scene.id === room.id)!.elements.find(item => item.game_id === editing.id)!.element_id = name;
    });
    setEditing(null);
  };
  const menuAction = (action: 'rename' | 'clone' | 'delete') => {
    if (!room || !menu || menu.id === 'background') return;
    const item = room.elements.find(candidate => candidate.game_id === menu.id);
    if (!item) { setMenu(null); return; }
    if (action === 'rename') setEditing({ id: item.game_id, value: item.element_id ?? '' });
    if (action === 'clone') {
      const id = createId();
      const base = `${item.element_id} copy`;
      let name = base;
      for (let number = 2; room.elements.some(candidate => candidate.element_id === name); number++) name = `${base} ${number}`;
      edit(next => {
        const elements = next.project.rooms.find(scene => scene.id === room.id)!.elements;
        const index = elements.findIndex(candidate => candidate.game_id === item.game_id);
        elements.splice(index + 1, 0, { ...structuredClone(item), game_id: id, element_id: name, ...(item.type === 'overlay' ? {} : { name: `${item.name ?? item.element_id} copy` }) });
        const player = next.project.rooms.find(scene => scene.id === room.id)!.player;
        if (player && index + 1 <= player.layer) player.layer++;
      });
      setSelected(id);
    }
    if (action === 'delete') {
      edit(next => {
        const scene = next.project.rooms.find(candidate => candidate.id === room.id)!;
        const index = scene.elements.findIndex(candidate => candidate.game_id === item.game_id);
        if (scene.player && index < scene.player.layer) scene.player.layer--;
        scene.elements = scene.elements.filter(candidate => candidate.game_id !== item.game_id);
      });
      setSelected('background');
    }
    setMenu(null);
  };
  const moveElement = (sourceId: string, targetId: string, after: boolean) => {
    if (!room || sourceId === targetId) return;
    const order = [...frontToBackIds];
    const from = order.indexOf(sourceId);
    if (from < 0) return;
    order.splice(from, 1);
    const target = targetId === 'background' ? order.length : order.indexOf(targetId);
    if (target < 0) return;
    order.splice(targetId === 'background' ? target : target + Number(after), 0, sourceId);
    if (order.every((id, index) => id === frontToBackIds[index])) return;
    edit(next => {
      const scene = next.project.rooms.find(item => item.id === room.id)!;
      const byId = new Map(scene.elements.map(item => [item.game_id, item]));
      const backToFront = order.reverse();
      if (scene.player) scene.player.layer = backToFront.indexOf(playerSelection);
      scene.elements = backToFront.filter(id => id !== playerSelection).map(id => byId.get(id)!);
    });
  };
  const moveCanvasElement = (id: string, x: number, y: number) => {
    if (!room) return;
    const current = room.elements.find(item => item.game_id === id);
    if (!current || current.type === 'overlay' || current.locked === true || (current.bounds.x === x && current.bounds.y === y)) return;
    edit(next => {
      const selected = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(item => item.game_id === id);
      if (selected && selected.type !== 'overlay' && selected.locked !== true) {
        if (selected.type === 'shape' && selected.vertices) selected.vertices = movePolygon(selected.vertices, x - selected.bounds.x, y - selected.bounds.y, room.width, room.height);
        selected.bounds.x = x; selected.bounds.y = y;
      }
    });
  };
  const moveCanvasPlayer = (x: number, y: number) => {
    if (!room || room.player?.locked === true) return;
    edit(next => { const player = next.project.rooms.find(scene => scene.id === room.id)?.player; if (player && player.locked !== true) player.position = { x, y }; });
  };
  const changeShape = (id: string, vertices: Point[]) => {
    if (!room) return;
    edit(next => {
      const selected = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(item => item.game_id === id);
      if (selected?.type === 'shape' && selected.locked !== true) { selected.vertices = vertices; selected.bounds = polygonBounds(vertices); }
    });
  };
  const toggleElement = (id: string, flag: 'enabled' | 'visible' | 'locked') => {
    if (!room) return;
    edit(next => {
      const item = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(candidate => candidate.game_id === id);
      if (item) item[flag] = flag === 'locked' ? item.locked !== true : item[flag] === false;
    });
  };
  const togglePlayerLock = () => {
    if (!room) return;
    edit(next => {
      const player = next.project.rooms.find(scene => scene.id === room.id)?.player;
      if (player) player.locked = player.locked !== true;
    });
  };
  return <div className="scenes-view" onClick={() => { setMenu(null); setAddMenuOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setMenu(null); setAddMenuOpen(false); } }}>
    <aside className="panel scene-elements" aria-label="Scene elements">
      <div className="scene-elements-header"><p className="sidebar-label">Elements</p><button type="button" className="scene-add-button" aria-label="Add element" aria-haspopup="menu" aria-expanded={addMenuOpen} disabled={!room} onClick={event => { event.stopPropagation(); setMenu(null); setAddMenuOpen(!addMenuOpen); }}><UiIcon name="add" /></button></div>
      {addMenuOpen && <div className="asset-context-menu scene-add-menu" role="menu" aria-label="Add element type" onClick={event => event.stopPropagation()}>{(['box', 'shape', 'image', 'overlay'] as const).map(type => <button type="button" role="menuitem" key={type} onClick={() => addElement(type)}><SceneKindIcon kind={type} />{type.charAt(0).toUpperCase() + type.slice(1)}{type === 'overlay' ? '' : ' element'}</button>)}</div>}
      {room && <div role="tree" aria-label="Scene element tree" className="scene-tree">
        {orderedRows.map(row => { if (row.kind === 'player') return <div key={playerSelection} className={`scene-element-row scene-player-row${room.player?.locked === true ? ' locked' : ''}${dropTarget?.id === playerSelection ? dropTarget.after ? ' drop-after' : ' drop-before' : ''}`}
          onDragOver={event => { if (!dragged || dragged === playerSelection) return; event.preventDefault(); setDropTarget({ id: playerSelection, after: event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 }); }}
          onDrop={event => { if (dragged) { event.preventDefault(); moveElement(dragged, playerSelection, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2); } setDragged(null); setDropTarget(null); }}>
          <button type="button" role="treeitem" aria-level={1} aria-selected={selected === playerSelection} draggable title="Drag to reorder Player" className={`${selected === playerSelection ? 'selected ' : ''}${dragged === playerSelection ? 'dragging ' : ''}`} onClick={() => setSelected(playerSelection)} onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', playerSelection); setDragged(playerSelection); }} onDragEnd={() => { setDragged(null); setDropTarget(null); }}><SceneKindIcon kind="player" /><span>Player</span></button>
          <div className="scene-element-flags" role="group" aria-label="Player controls"><button type="button" className={room.player?.locked === true ? 'active' : ''} aria-label={room.player?.locked === true ? 'Unlock Player' : 'Lock Player'} title={room.player?.locked === true ? 'Unlock Player' : 'Lock Player'} aria-pressed={room.player?.locked === true} onClick={event => { event.stopPropagation(); togglePlayerLock(); }}><ElementFlagIcon flag="locked" active={room.player?.locked === true} /></button></div>
        </div>; const item = row.item; return <div key={item.game_id} className={`scene-element-row${item.visible === false ? ' hidden' : ''}${item.enabled === false ? ' disabled' : ''}${item.locked === true ? ' locked' : ''}${dropTarget?.id === item.game_id ? dropTarget.after ? ' drop-after' : ' drop-before' : ''}`}
          onDragOver={event => { if (!dragged || dragged === item.game_id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget({ id: item.game_id, after: event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 }); }}
          onDrop={event => { if (!dragged) return; event.preventDefault(); moveElement(dragged, item.game_id, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2); setDragged(null); setDropTarget(null); }}>
          {editing?.id === item.game_id ? <div className="scene-tree-edit"><SceneKindIcon kind={item.type ?? 'box'} /><input ref={renameInput} aria-label="Rename element" value={editing.value ?? ''} onChange={event => { const value = event.currentTarget.value; setEditing(current => current?.id === item.game_id ? { ...current, value } : current); }} onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setEditing(null); }} /></div> : <button type="button" role="treeitem" aria-level={1} aria-selected={selected === item.game_id} draggable title="Drag to reorder" className={`${selected === item.game_id ? 'selected ' : ''}${dragged === item.game_id ? 'dragging ' : ''}`}
          onClick={() => setSelected(item.game_id)}
          onContextMenu={event => openMenu(event, item.game_id)}
          onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.game_id); setDragged(item.game_id); }}
          onDragEnd={() => { setDragged(null); setDropTarget(null); }}>
            <SceneKindIcon kind={item.type ?? 'box'} /><span>{item.element_id}</span>
          </button>}
          <div className="scene-element-flags" role="group" aria-label={`${item.element_id} controls`}>{(['enabled', 'visible', 'locked'] as const).map(flag => { const active = flag === 'locked' ? item.locked === true : item[flag] !== false; const action = flag === 'enabled' ? active ? 'Disable' : 'Enable' : flag === 'visible' ? active ? 'Hide' : 'Show' : active ? 'Unlock' : 'Lock'; return <button key={flag} type="button" className={active ? 'active' : ''} aria-label={`${action} ${item.element_id}`} title={`${action} ${item.element_id}`} aria-pressed={active} onClick={event => { event.stopPropagation(); toggleElement(item.game_id, flag); }}><ElementFlagIcon flag={flag} active={active} /></button>; })}</div>
        </div>; })}
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === sceneStateSelection} className={selected === sceneStateSelection ? 'selected' : ''} onClick={() => setSelected(sceneStateSelection)}>
          <SceneKindIcon kind="sceneState" /><span>SceneState</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === gameStateSelection} className={selected === gameStateSelection ? 'selected' : ''} onClick={() => setSelected(gameStateSelection)}>
          <SceneKindIcon kind="gameState" /><span>GameState</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === sceneManagerSelection} className={selected === sceneManagerSelection ? 'selected' : ''} onClick={() => setSelected(sceneManagerSelection)}>
          <SceneKindIcon kind="sceneManager" /><span>SceneManager</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selected === walkableSelection} className={selected === walkableSelection ? 'selected' : ''} onClick={() => setSelected(walkableSelection)}>
          <SceneKindIcon kind="walkable" /><span>Walkable Area</span>
        </button>
        <button type="button" role="treeitem" aria-level={1} aria-selected={selectedBackground} className={`${selectedBackground ? 'selected ' : ''}${dropTarget?.id === 'background' ? 'drop-before' : ''}`} onClick={() => setSelected('background')} onContextMenu={event => openMenu(event, 'background')}
          onDragOver={event => { if (!dragged) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget({ id: 'background', after: false }); }}
          onDrop={event => { event.preventDefault(); if (dragged) moveElement(dragged, 'background', false); setDragged(null); setDropTarget(null); }}>
          <SceneKindIcon kind="background" /><span>Background</span>
        </button>
      </div>}
    </aside>

    {room && <SceneCanvas key={room.id} room={room} backgroundUrl={urls.get(background?.path ?? '') ?? ''} assetUrls={urls} playerCharacter={workspace.project.characters?.find(character => character.id === room.player?.characterId)} selectedPlayer={selected === playerSelection} onSelectPlayer={() => setSelected(playerSelection)} onMovePlayer={moveCanvasPlayer} selectedElementId={element?.game_id ?? null} onSelectElement={setSelected} onMoveElement={moveCanvasElement} onChangeShape={changeShape} onPlayScene={editor.playScene} canPlayScene={editor.ready} />}

    <section className="panel scene-inspector" aria-label="Inspector">
      <header className="scene-inspector-header"><span className="scene-inspector-marker" aria-hidden="true" /><SceneKindIcon kind={inspectorKind} /><div className="scene-inspector-heading"><p>Inspector <span>/ {inspectorType}</span></p><h2>{inspectorTitle}</h2><small title={inspectorDetail}>{inspectorDetail}</small></div><span className="scene-inspector-context">{room?.name ?? 'Scene'}</span></header>
      <div className="scene-inspector-content">
      {selectedBackground ? <>
        <div className="background-inspector-preview">{urls.get(background?.path ?? '') ? <img src={urls.get(background?.path ?? '')} alt="Scene background preview" /> : <span>No background selected</span>}</div>
        <div className="background-inspector-details">
        <h3>Image source</h3>
        <p className="subtle">The root image for this scene. Choose a file from this project’s backgrounds folder.</p>
        {room && (window.pcagDesktop ? <label>Background file<input aria-label="Scene background" value={background?.path ?? ''} readOnly /><button type="button" className="scene-browse" disabled={!editor.directory} onClick={() => { void chooseSceneBackground(); }}>Browse backgrounds…</button></label>
          : <label>Background file<select aria-label="Scene background" value={room.backgroundAssetId} onChange={event => { const id = event.currentTarget.value; edit(next => { const scene = next.project.rooms.find(candidate => candidate.id === room.id)!; if (scene.backgroundAssetId !== id) { if (scene.walkableArea) scene.walkableArea.path = ''; scene.elements.forEach(item => { if (item.type === 'overlay' && item.media) item.media.path = ''; }); } scene.backgroundAssetId = id; }); }}>{workspace.project.assets.filter(asset => asset.path.startsWith('backgrounds/')).map(asset => <option key={asset.id} value={asset.id}>{basename(asset.path)}</option>)}</select></label>)}
        </div>
      </> : selected === sceneStateSelection && room ? <StateVariablesInspector scope="scene" roomId={room.id} rooms={workspace.project.rooms} variables={room.sceneState} edit={edit} setMessage={setMessage} />
        : selected === gameStateSelection && room ? <StateVariablesInspector scope="game" roomId={room.id} rooms={workspace.project.rooms} variables={workspace.project.gameState} edit={edit} setMessage={setMessage} />
        : selected === sceneManagerSelection && room ? <SceneManagerInspector room={room} gameState={workspace.project.gameState} edit={edit} />
        : selected === playerSelection && room ? <PlayerInspector room={room} characters={workspace.project.characters ?? []} urls={urls} edit={edit} />
        : selected === walkableSelection && room ? <WalkableAreaInspector room={room} backgroundUrl={urls.get(background?.path ?? '') ?? ''} files={workspace.files} edit={edit} />
        : room && element && <ElementInspector room={room} element={element} backgroundUrl={urls.get(background?.path ?? '') ?? ''} files={workspace.files} edit={edit} />}
      </div>
    </section>
    {menu && <div className="asset-context-menu" role="menu" aria-label="Element actions" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>
      {(['rename', 'clone', 'delete'] as const).map(action => <button type="button" role="menuitem" key={action} disabled={menu.id === 'background'} title={menu.id === 'background' ? 'The scene background is required.' : undefined} onClick={() => menuAction(action)}>{action[0]!.toUpperCase() + action.slice(1)}</button>)}
    </div>}
  </div>;
}
