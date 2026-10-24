import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { basename } from '../../../../packages/editor-workspace/src/index';
import { createId } from '../../../../packages/project-format/src/index';
import type { EditorController } from '../app/useEditorWorkspace';

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
  const hotspot = room?.hotspots.find(item => item.id === selected);
  const selectedBackground = selected === 'background' || !hotspot;
  // The array is back-to-front for Phaser; the tree displays the frontmost item first.
  const frontToBack = [...(room?.hotspots ?? [])].reverse();
  const addHotspot = () => {
    if (!room) return;
    const id = createId();
    let name = 'Hotspot';
    for (let number = 2; room.hotspots.some(item => item.name === name); number++) name = `Hotspot ${number}`;
    const width = Math.min(160, room.width);
    const height = Math.min(100, room.height);
    edit(next => {
      next.project.rooms.find(scene => scene.id === room.id)!.hotspots.push({
        id, name, bounds: { x: Math.round((room.width - width) / 2), y: Math.round((room.height - height) / 2), width, height }, inspect: '',
      });
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
    const name = editing.value.trim();
    if (!name) { setMessage('Enter an element name.'); renameInput.current?.focus(); return; }
    if (room.hotspots.find(item => item.id === editing.id)?.name !== name) edit(next => {
      next.project.rooms.find(scene => scene.id === room.id)!.hotspots.find(item => item.id === editing.id)!.name = name;
    });
    setEditing(null);
  };
  const menuAction = (action: 'rename' | 'clone' | 'delete') => {
    if (!room || !menu || menu.id === 'background') return;
    const item = room.hotspots.find(candidate => candidate.id === menu.id);
    if (!item) { setMenu(null); return; }
    if (action === 'rename') setEditing({ id: item.id, value: item.name });
    if (action === 'clone') {
      const id = createId();
      const base = `${item.name} copy`;
      let name = base;
      for (let number = 2; room.hotspots.some(candidate => candidate.name === name); number++) name = `${base} ${number}`;
      edit(next => {
        const hotspots = next.project.rooms.find(scene => scene.id === room.id)!.hotspots;
        const index = hotspots.findIndex(candidate => candidate.id === item.id);
        hotspots.splice(index + 1, 0, { ...structuredClone(item), id, name });
      });
      setSelected(id);
    }
    if (action === 'delete') {
      edit(next => {
        const scene = next.project.rooms.find(candidate => candidate.id === room.id)!;
        scene.hotspots = scene.hotspots.filter(candidate => candidate.id !== item.id);
      });
      setSelected('background');
    }
    setMenu(null);
  };
  const moveHotspot = (sourceId: string, targetId: string, after: boolean) => {
    if (!room || sourceId === targetId) return;
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
      const byId = new Map(scene.hotspots.map(item => [item.id, item]));
      scene.hotspots = order.reverse().map(id => byId.get(id)!);
    });
  };
  return <div className="scenes-view" onClick={() => { setMenu(null); setAddMenuOpen(false); }} onKeyDown={event => { if (event.key === 'Escape') { setMenu(null); setAddMenuOpen(false); } }}>
    <aside className="panel scene-elements" aria-label="Scene elements">
      <div className="scene-elements-header"><p className="sidebar-label">Elements</p><button type="button" className="scene-add-button" aria-label="Add element" aria-haspopup="menu" aria-expanded={addMenuOpen} disabled={!room} onClick={event => { event.stopPropagation(); setMenu(null); setAddMenuOpen(!addMenuOpen); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg></button></div>
      {addMenuOpen && <div className="asset-context-menu scene-add-menu" role="menu" aria-label="Add element type" onClick={event => event.stopPropagation()}><button type="button" role="menuitem" onClick={addHotspot}>Hotspot</button></div>}
      {room && <div role="tree" aria-label="Scene element tree" className="scene-tree">
        {frontToBack.map(item => editing?.id === item.id ? <div key={item.id} className="scene-tree-edit"><img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/hotspot.png`} alt="" aria-hidden="true" /><input ref={renameInput} aria-label="Element name" value={editing.value} onChange={event => setEditing({ ...editing, value: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') finishRename(); if (event.key === 'Escape') setEditing(null); }} /></div> : <button type="button" role="treeitem" aria-level={1} aria-selected={selected === item.id} key={item.id} draggable className={`${selected === item.id ? 'selected ' : ''}${dragged === item.id ? 'dragging ' : ''}${dropTarget?.id === item.id ? dropTarget.after ? 'drop-after' : 'drop-before' : ''}`}
          onClick={() => setSelected(item.id)}
          onContextMenu={event => openMenu(event, item.id)}
          onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); setDragged(item.id); }}
          onDragOver={event => { if (!dragged || dragged === item.id) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget({ id: item.id, after: event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2 }); }}
          onDrop={event => { event.preventDefault(); if (dragged) moveHotspot(dragged, item.id, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2); setDragged(null); setDropTarget(null); }}
          onDragEnd={() => { setDragged(null); setDropTarget(null); }}>
            <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/hotspot.png`} alt="" aria-hidden="true" /><span>{item.name}</span>
          </button>)}
        <button type="button" role="treeitem" aria-level={1} aria-selected={selectedBackground} className={`${selectedBackground ? 'selected ' : ''}${dropTarget?.id === 'background' ? 'drop-before' : ''}`} onClick={() => setSelected('background')} onContextMenu={event => openMenu(event, 'background')}
          onDragOver={event => { if (!dragged) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget({ id: 'background', after: false }); }}
          onDrop={event => { event.preventDefault(); if (dragged) moveHotspot(dragged, 'background', false); setDragged(null); setDropTarget(null); }}>
          <img className="scene-tree-icon" src={`${import.meta.env.BASE_URL}icons/background.png`} alt="" aria-hidden="true" /><span>Background</span>
        </button>
      </div>}
    </aside>

    <div className="panel scene-canvas"><p className="sidebar-label">Scene canvas</p>
      {room && <div className="layout" style={{ aspectRatio: `${room.width} / ${room.height}`, backgroundImage: `url(${urls.get(background?.path ?? '') ?? ''})` }}>
        {hotspot && <div className="scene-selection" style={{ left: `${hotspot.bounds.x / room.width * 100}%`, top: `${hotspot.bounds.y / room.height * 100}%`, width: `${hotspot.bounds.width / room.width * 100}%`, height: `${hotspot.bounds.height / room.height * 100}%` }} />}
      </div>}
    </div>

    <aside className="panel scene-inspector" aria-label="Inspector">
      <p className="sidebar-label">Inspector</p>
      {selectedBackground ? <>
        <h3>Background</h3>
        <p className="subtle">The root image for this scene. Choose a file from this project’s backgrounds folder.</p>
        {room && (window.pcagDesktop ? <label>Background file<input aria-label="Scene background" value={background?.path ?? ''} readOnly /><button type="button" className="scene-browse" disabled={!editor.directory} onClick={() => { void chooseSceneBackground(); }}>Browse backgrounds…</button></label>
          : <label>Background file<select aria-label="Scene background" value={room.backgroundAssetId} onChange={event => edit(next => { next.project.rooms.find(scene => scene.id === room.id)!.backgroundAssetId = event.target.value; })}>{workspace.project.assets.filter(asset => asset.path.startsWith('backgrounds/')).map(asset => <option key={asset.id} value={asset.id}>{basename(asset.path)}</option>)}</select></label>)}
      </> : hotspot && <>
        <h3>{hotspot.name}</h3>
        <p className="subtle">Hotspot properties become editable with the interaction tools.</p>
        <dl className="scene-properties"><dt>View text</dt><dd>{hotspot.inspect}</dd><dt>Bounds</dt><dd>{hotspot.bounds.x}, {hotspot.bounds.y} · {hotspot.bounds.width} × {hotspot.bounds.height}</dd></dl>
      </>}
    </aside>
    {menu && <div className="asset-context-menu" role="menu" aria-label="Element actions" style={{ left: menu.x, top: menu.y }} onClick={event => event.stopPropagation()}>
      {(['rename', 'clone', 'delete'] as const).map(action => <button type="button" role="menuitem" key={action} disabled={menu.id === 'background'} title={menu.id === 'background' ? 'The scene background is required.' : undefined} onClick={() => menuAction(action)}>{action[0]!.toUpperCase() + action.slice(1)}</button>)}
    </div>}
  </div>;
}
