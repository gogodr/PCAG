import { useState } from 'react';
import { addStarterCharacter, type Project } from '../../../packages/project-format/src/index';
import { readImage } from '../../../packages/project-io/src/index';
import { roomEntities, type Edit, type Tool } from './world';

export function assetReferences(project: Project, assetId: string): number {
  return project.rooms.reduce((n, r) => n + Number(r.backgroundAssetId === assetId) + r.layers.filter(l => l.assetId === assetId).length, 0)
    + (project.protagonist ? Object.values(project.protagonist.animations).filter(a => a.assetId === assetId).length : 0);
}

interface Props { project: Project; roomIndex: number; selectedId: string | null; edit: Edit; select(id: string | null): void; setTool(tool: Tool): void; report(error: unknown): void; disabled: boolean }
export function WorldInspector({ project, roomIndex, selectedId, edit, select, setTool, report, disabled }: Props) {
  const room = project.rooms[roomIndex], entity = roomEntities(room).find(e => e.id === selectedId);
  const [assetId, setAssetId] = useState(project.assets[0]?.id ?? '');
  const activeAsset = project.assets.find(a => a.id === assetId) ?? project.assets[0];
  const update = (values: object) => edit(p => { const e = roomEntities(p.rooms[roomIndex]).find(e => e.id === selectedId); if (e) Object.assign(e, values); });
  const numeric = (label: string, value: number, change: (value: number) => void, id?: string) => <label className="world-field" key={label}>{label}<input id={id} aria-label={label} type="number" step="any" value={value} onChange={e => change(Number(e.target.value))} /></label>;
  const rooms = project.rooms;
  const selectedExit = room.exits.find(e => e.id === selectedId);
  const selectedEntry = room.entrances.find(e => e.id === selectedId);
  const remove = () => edit(p => {
    const r = p.rooms[roomIndex];
    r.hotspots = r.hotspots.filter(e => e.id !== selectedId); r.exits = r.exits.filter(e => e.id !== selectedId); r.layers = r.layers.filter(e => e.id !== selectedId);
    r.navigation.walkable = r.navigation.walkable.filter(e => e.id !== selectedId); r.navigation.obstacles = r.navigation.obstacles.filter(e => e.id !== selectedId);
    if (r.entrances.length > 1) {
      r.entrances = r.entrances.filter(e => e.id !== selectedId);
      if (!r.entrances.some(e => e.id === r.defaultEntranceId)) r.defaultEntranceId = r.entrances[0].id;
      for (const target of p.rooms) for (const exit of target.exits) if (exit.targetEntranceId === selectedId) exit.targetEntranceId = null;
    }
  });
  return <fieldset disabled={disabled} className="world-inspector">
    <section className="inspector-section"><h2>Scene setup</h2><p className="field-hint">Green is walkable. Red blocks the character's feet. Gold markers show where interactions happen.</p>
      <div className="world-tool-buttons"><button id="draw-ground" onClick={() => setTool('walkable')}>Draw ground</button><button onClick={() => setTool('obstacle')}>Draw obstacle</button><button onClick={() => setTool('spawn')}>Place character</button><button onClick={() => setTool('exit')}>Draw exit</button></div>
      <label>Starting entrance<select value={room.defaultEntranceId} onChange={e => edit(p => { p.rooms[roomIndex].defaultEntranceId = e.target.value; })}>{room.entrances.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
      <button className="wide-button" onClick={() => { const id = `entry_${crypto.randomUUID()}`; edit(p => p.rooms[roomIndex].entrances.push({ id, name: `Entrance ${room.entrances.length + 1}`, x: 160, y: room.height * .85, facing: 'right' })); select(id); }} disabled={room.entrances.length >= 12}>＋ Add entrance</button>
      <div className="world-entity-list">{[...room.navigation.walkable, ...room.navigation.obstacles, ...room.entrances, ...room.exits, ...room.layers].map(e => <button key={e.id} className={selectedId === e.id ? 'selected' : ''} onClick={() => select(e.id)}>{e.name}</button>)}</div>
    </section>
    {entity && <section className="inspector-section"><h2>{selectedExit ? 'Exit properties' : selectedEntry ? 'Entrance properties' : 'inspection' in entity ? 'Object properties' : 'Scene element'}</h2>
      <label htmlFor="entity-name">Name<input id="entity-name" aria-label={'inspection' in entity ? 'Object name' : 'Element name'} value={entity.name} onChange={e => update({ name: e.target.value })} /></label>
      <div className="two-fields">{numeric('X', entity.x, x => update({ x }), 'field-x')}{numeric('Y', entity.y, y => update({ y }), 'field-y')}
        {'width' in entity && <>{numeric('Object width', entity.width, width => update({ width }), 'field-width')}{numeric('Object height', entity.height, height => update({ height }), 'field-height')}</>}
      </div>
      {'inspection' in entity && <><label htmlFor="field-inspection">When inspected<textarea id="field-inspection" rows={4} value={entity.inspection} onChange={e => update({ inspection: e.target.value })} /></label><p className="field-hint">The protagonist says this when the player chooses View.</p><label className="check-field"><input type="checkbox" checked={entity.enabled} onChange={e => update({ enabled: e.target.checked })} /> Available in play</label></>}
      {'approach' in entity && <><div className="property-label">APPROACH POINT</div><p className="field-hint">Where the character stands. Keep this marker on walkable ground.</p><button className="wide-button" onClick={() => setTool('approach')}>Place approach point</button>
        {entity.approach && <><div className="two-fields">{numeric('Approach X', entity.approach.x, x => update({ approach: { ...entity.approach, x } }), 'approach-x')}{numeric('Approach Y', entity.approach.y, y => update({ approach: { ...entity.approach, y } }), 'approach-y')}</div><label>Face after approach<select value={entity.approach.facing} onChange={e => update({ approach: { ...entity.approach, facing: e.target.value } })}><option value="right">Right</option><option value="left">Left</option></select></label></>}
      </>}
      {selectedEntry && <label>Entrance facing<select value={selectedEntry.facing} onChange={e => update({ facing: e.target.value })}><option value="right">Right</option><option value="left">Left</option></select></label>}
      {selectedExit && <><label>Destination room<select id="exit-room" value={selectedExit.targetRoomId ?? ''} onChange={e => { const target = rooms.find(r => r.id === e.target.value); update({ targetRoomId: target?.id ?? null, targetEntranceId: target?.defaultEntranceId ?? null }); }}><option value="">Choose a room…</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Destination entrance<select id="exit-entry" value={selectedExit.targetEntranceId ?? ''} onChange={e => update({ targetEntranceId: e.target.value || null })}><option value="">Choose an entrance…</option>{rooms.find(r => r.id === selectedExit.targetRoomId)?.entrances.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></label></>}
      {'assetId' in entity && <><label>Layer image<select value={entity.assetId} onChange={e => update({ assetId: e.target.value })}>{project.assets.map(a => <option value={a.id} key={a.id}>{a.name}</option>)}</select></label><label>Layer depth<select value={entity.depth} onChange={e => update({ depth: e.target.value })}><option value="behind">Behind character</option><option value="front">In front of character</option></select></label></>}
      <div className="object-actions">{'inspection' in entity && <button onClick={() => { const id = `hotspot_${crypto.randomUUID()}`; edit(p => p.rooms[roomIndex].hotspots.push({ ...structuredClone(entity), id, name: `${entity.name} copy` })); select(id); }} disabled={room.hotspots.length >= 50}>Duplicate</button>}<button className="delete-button" disabled={Boolean(selectedEntry && room.entrances.length === 1)} onClick={() => { remove(); select(null); }}>{'inspection' in entity ? 'Delete object' : 'Delete element'}</button></div>
    </section>}
    <section className="inspector-section"><h2>Playable character</h2>
      {!project.protagonist ? <><p className="field-hint">This older project has no character. Add the supplied explorer or configure imported artwork after setup.</p><button id="setup-character" onClick={() => edit(addStarterCharacter)}>Use starter character</button></> : <>
        <label>Character name<input id="character-name" value={project.protagonist.name} onChange={e => edit(p => { p.protagonist!.name = e.target.value; })} /></label>
        <div className="two-fields">{numeric('Walk speed', project.protagonist.speed, speed => edit(p => { p.protagonist!.speed = speed; }))}{numeric('Character height', project.protagonist.height, height => edit(p => { p.protagonist!.height = height; }))}
          {numeric('Feet anchor X', project.protagonist.feetX, feetX => edit(p => { p.protagonist!.feetX = feetX; }))}{numeric('Feet anchor Y', project.protagonist.feetY, feetY => edit(p => { p.protagonist!.feetY = feetY; }))}</div>
        <p className="field-hint">Feet anchors use 0–1 across the frame. The supplied explorer uses X 0.5, Y 1.</p>
        {(['idle', 'walk', 'talk'] as const).map(mode => {
          const map = project.protagonist!.animations[mode];
          const change = (values: object) => edit(p => Object.assign(p.protagonist!.animations[mode], values));
          return <details key={mode} className="animation-mapping"><summary>{mode[0].toUpperCase() + mode.slice(1)} animation</summary><label>Sprite sheet<select aria-label={`${mode} sprite sheet`} value={map.assetId} onChange={e => change({ assetId: e.target.value })}>{project.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <div className="two-fields">{numeric(`${mode} frame width`, map.frameWidth, frameWidth => change({ frameWidth }))}{numeric(`${mode} frame height`, map.frameHeight, frameHeight => change({ frameHeight }))}
              {numeric(`${mode} first frame`, map.frames[0], first => change({ frames: Array.from({ length: map.frames.length }, (_, i) => first + i) }))}{numeric(`${mode} frame count`, map.frames.length, count => change({ frames: Array.from({ length: Math.max(1, Math.min(64, Math.round(count))) }, (_, i) => map.frames[0] + i) }))}
              {numeric(`${mode} frames per second`, map.fps, fps => change({ fps }))}</div></details>;
        })}
      </>}
    </section>
    <section className="inspector-section"><h2>Asset library</h2><p className="field-hint">Images are shared by rooms, layers, and animation mappings.</p>
      <label>Selected asset<select value={activeAsset?.id ?? ''} onChange={e => setAssetId(e.target.value)}><option value="" disabled>Import an image…</option>{project.assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {activeAsset && <><img className="asset-preview" src={activeAsset.dataUrl} alt={activeAsset.name} /><label>Asset name<input value={activeAsset.name} onChange={e => edit(p => { p.assets.find(a => a.id === activeAsset.id)!.name = e.target.value; })} /></label><p className="field-hint">Used in {assetReferences(project, activeAsset.id)} places.</p><div className="world-tool-buttons"><button disabled={room.layers.length >= 30} onClick={() => { const id = `layer_${crypto.randomUUID()}`; edit(p => p.rooms[roomIndex].layers.push({ id, name: activeAsset.name, assetId: activeAsset.id, x: 100, y: 100, width: 150, height: 150, depth: 'behind' })); select(id); }}>Add image layer</button><button disabled={assetReferences(project, activeAsset.id) > 0} onClick={() => edit(p => { p.assets = p.assets.filter(a => a.id !== activeAsset.id); })}>Delete unused asset</button></div></>}
      <label className="file-label">Import an image<input aria-label="Import library image" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        try { const dataUrl = await readImage(file), id = `asset_${crypto.randomUUID()}`; edit(p => { if (p.id === project.id) p.assets.push({ id, name: file.name, dataUrl }); }); setAssetId(id); } catch (error) { report(error); }
      }} /></label>
    </section>
  </fieldset>;
}
