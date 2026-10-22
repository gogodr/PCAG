import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Point, Project, Rect, Room } from '../../../packages/project-format/src/index';
import type { Tool } from './world';

interface Props {
  project: Project; room: Room; selectedId: string | null; tool: Tool;
  select(id: string): void; add(kind: Tool, bounds: Rect): void; place(kind: 'spawn' | 'approach', point: Point): void;
}
export function RoomCanvas({ project, room, selectedId, tool, select, add, place }: Props) {
  const [draft, setDraft] = useState<Rect | null>(null), start = useRef<Point | null>(null);
  const percent = (rect: Rect): CSSProperties => ({ left: `${rect.x / room.width * 100}%`, top: `${rect.y / room.height * 100}%`, width: `${rect.width / room.width * 100}%`, height: `${rect.height / room.height * 100}%` });
  const point = (e: PointerEvent<HTMLDivElement>): Point => {
    const bounds = e.currentTarget.getBoundingClientRect();
    return { x: Math.round(Math.max(0, Math.min(room.width, (e.clientX - bounds.left) / bounds.width * room.width))), y: Math.round(Math.max(0, Math.min(room.height, (e.clientY - bounds.top) / bounds.height * room.height))) };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (tool === 'select' || e.button !== 0) return;
    const p = point(e);
    if (tool === 'spawn' || tool === 'approach') { place(tool, p); return; }
    start.current = p; setDraft({ ...p, width: 0, height: 0 }); e.currentTarget.setPointerCapture(e.pointerId);
  };
  const shape = (e: PointerEvent<HTMLDivElement>): Rect | null => { const p = point(e), s = start.current; return s ? { x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), width: Math.abs(s.x - p.x), height: Math.abs(s.y - p.y) } : null; };
  const background = project.assets.find(a => a.id === room.backgroundAssetId);
  const actor = project.protagonist, entry = room.entrances.find(e => e.id === room.defaultEntranceId);
  const idle = actor?.animations.idle, actorAsset = project.assets.find(a => a.id === idle?.assetId);
  const pick = (id: string) => (e: PointerEvent | React.MouseEvent) => { if (tool === 'select') { e.stopPropagation(); select(id); } };
  return <div data-testid="room-canvas" className={`room-canvas ${tool !== 'select' ? 'drawing' : ''}`} style={{ aspectRatio: `${room.width} / ${room.height}` }}
    onPointerDown={down} onPointerMove={e => { if (start.current) setDraft(shape(e)); }}
    onPointerUp={e => { const rect = shape(e); start.current = null; setDraft(null); if (rect && rect.width >= 8 && rect.height >= 8) add(tool, rect); }}
    onPointerCancel={() => { start.current = null; setDraft(null); }}>
    {background ? <img draggable={false} src={background.dataUrl} alt={`${room.name} background`} /> : <div className="empty-scene"><span>◇</span><h2>{room.name}</h2><p>Import a background and place your story.</p></div>}
    {room.layers.map(layer => <button key={layer.id} aria-label={`Select layer ${layer.name}`} className="editor-layer" style={{ ...percent(layer), pointerEvents: tool === 'select' ? 'auto' : 'none' }} onPointerDown={pick(layer.id)} onClick={pick(layer.id)}><img draggable={false} src={project.assets.find(a => a.id === layer.assetId)?.dataUrl} alt={layer.name} /></button>)}
    <svg className="world-overlay" viewBox={`0 0 ${room.width} ${room.height}`} aria-hidden="true">
      {room.navigation.walkable.map(r => <rect key={r.id} {...{ x: r.x, y: r.y, width: r.width, height: r.height }} className={`walkable-shape ${r.id === selectedId ? 'active' : ''}`} />)}
      {room.navigation.obstacles.map(r => <rect key={r.id} {...{ x: r.x, y: r.y, width: r.width, height: r.height }} className={`obstacle-shape ${r.id === selectedId ? 'active' : ''}`} />)}
      {[...room.hotspots, ...room.exits].filter(h => h.approach).map(h => <g key={h.id}><line x1={h.x + h.width / 2} y1={h.y + h.height} x2={h.approach!.x} y2={h.approach!.y} className="approach-line" /><circle cx={h.approach!.x} cy={h.approach!.y} r={7} className="approach-marker" /><text x={h.approach!.x + 11} y={h.approach!.y + 4} className="world-label">{h.id === selectedId ? 'Stand here' : ''}</text></g>)}
      {room.entrances.map(e => <g key={e.id}><circle cx={e.x} cy={e.y} r={9} className="entry-marker" /><text x={e.x + 13} y={e.y + 4} className="world-label">{e.name}</text></g>)}
    </svg>
    {actor && entry && idle && actorAsset && <div className="editor-character" aria-label={`Character ${actor.name}`} style={{ left: `${entry.x / room.width * 100}%`, top: `${entry.y / room.height * 100}%`, width: `${actor.height * idle.frameWidth / idle.frameHeight / room.width * 100}%`, height: `${actor.height / room.height * 100}%`, transform: `translate(${-actor.feetX * 100}%, ${-actor.feetY * 100}%)` }}><svg viewBox={`0 0 ${idle.frameWidth} ${idle.frameHeight}`}><image href={actorAsset.dataUrl} x={-idle.frames[0] * idle.frameWidth} y={0} /></svg></div>}
    {[...room.hotspots, ...room.exits].map(h => <button key={h.id} type="button" aria-label={`Select ${h.name}`} className={`editor-hotspot ${h.id === selectedId ? 'selected' : ''} ${'targetRoomId' in h ? 'editor-exit' : ''}`} style={{ ...percent(h), pointerEvents: tool === 'select' ? 'auto' : 'none' }} onPointerDown={pick(h.id)} onClick={pick(h.id)}><span>{h.name}</span></button>)}
    {draft && <div className="draw-rectangle" style={percent(draft)} />}
  </div>;
}
