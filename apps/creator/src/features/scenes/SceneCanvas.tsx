import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Character, Element, Point, Room } from '../../../../../packages/project-format/src/index';
import { movePolygon } from '../../../../../packages/project-format/src/element-geometry';
import { animationAtlasFromDataUrl } from '../../../../../packages/animation-atlas/src/index';

interface Props { room: Room; backgroundUrl: string; assetUrls: ReadonlyMap<string, string>; playerCharacter: Character | undefined; selectedPlayer: boolean; onSelectPlayer: () => void; onMovePlayer: (x: number, y: number) => void; selectedElementId: string | null; onSelectElement: (id: string) => void; onMoveElement: (id: string, x: number, y: number) => void; onChangeShape: (id: string, vertices: Point[]) => void; onPlayScene: () => void; canPlayScene: boolean }
interface View { scale: number; x: number; y: number }
interface Pan { pointerId: number; startX: number; startY: number; x: number; y: number }
interface ItemDrag extends Pan { id: string; width: number; height: number; element: HTMLElement; nextX: number; nextY: number }
interface ShapeDrag { pointerId: number; id: string; startX: number; startY: number; original: Point[]; next: Point[]; vertex: number | null; polygon: SVGPolygonElement }

function AtlasSprite({ element, urls }: { element: Element; urls: ReadonlyMap<string, string> }) {
  const media = element.media!;
  const atlas = useMemo(() => {
    if (media.kind !== 'animation' || !media.path) return null;
    const metadata = animationAtlasFromDataUrl(urls.get(media.path));
    if (!metadata) return null;
    const path = `${media.path.slice(0, media.path.lastIndexOf('/'))}/${metadata.image}`;
    return { image: urls.get(path), frames: metadata.frames, fps: metadata.fps };
  }, [media.kind, media.path, urls]);
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!atlas) return;
    setFrame(media.reverse ? atlas.frames.length - 1 : 0);
    if (!media.loop || atlas.frames.length < 2) return;
    let position = media.reverse ? atlas.frames.length - 1 : 0;
    const timer = window.setInterval(() => {
      position += media.reverse ? -1 : 1;
      if (position < 0 || position >= atlas.frames.length) position = media.reverse ? atlas.frames.length - 1 : 0;
      setFrame(position);
    }, 1000 / atlas.fps);
    return () => window.clearInterval(timer);
  }, [atlas, media.loop, media.reverse]);
  if (!atlas?.image) return null;
  const rect = atlas.frames[frame]?.rect ?? atlas.frames[0]!.rect;
  return <div className="element-sprite" style={{ backgroundImage: `url(${atlas.image})`, backgroundSize: `${atlas.frames.length * 100}% 100%`, backgroundPosition: `${atlas.frames.length === 1 ? 0 : frame / (atlas.frames.length - 1) * 100}% 0%` }} data-frame-x={rect.x} />;
}

export function SceneCanvas({ room, backgroundUrl, assetUrls, playerCharacter, selectedPlayer, onSelectPlayer, onMovePlayer, selectedElementId, onSelectElement, onMoveElement, onChangeShape, onPlayScene, canPlayScene }: Props) {
  const idle = playerCharacter?.animations.find(animation => animation.key.toLowerCase() === 'idle');
  const playerImage = idle && assetUrls.get(idle.path);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const cursorLabelRef = useRef<HTMLElement>(null);
  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 });
  const panRef = useRef<Pan | null>(null);
  const itemRef = useRef<ItemDrag | null>(null);
  const shapeRef = useRef<ShapeDrag | null>(null);
  const playerDragRef = useRef<(Pan & { nextX: number; nextY: number }) | null>(null);
  const applyView = (next: View) => {
    const viewport = viewportRef.current, content = contentRef.current;
    if (!viewport || !content) return;
    const x = Math.min(0, Math.max(viewport.clientWidth * (1 - next.scale), next.x));
    const y = Math.min(0, Math.max(viewport.clientHeight * (1 - next.scale), next.y));
    viewRef.current = { scale: next.scale, x, y };
    content.style.transform = `translate(${x}px, ${y}px) scale(${next.scale})`;
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(next.scale * 100)}%`;
  };
  const sceneDelta = (dx: number, dy: number) => {
    const viewport = viewportRef.current;
    return viewport ? { x: dx * room.width / (viewport.clientWidth * viewRef.current.scale), y: dy * room.height / (viewport.clientHeight * viewRef.current.scale) } : { x: 0, y: 0 };
  };
  const scenePoint = (clientX: number, clientY: number): Point => {
    const viewport = viewportRef.current!;
    const rect = viewport.getBoundingClientRect(), view = viewRef.current;
    return { x: Math.max(0, Math.min(room.width, Math.round((clientX - rect.left - view.x) * room.width / (viewport.clientWidth * view.scale)))), y: Math.max(0, Math.min(room.height, Math.round((clientY - rect.top - view.y) * room.height / (viewport.clientHeight * view.scale)))) };
  };
  const showScenePosition = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current, label = cursorLabelRef.current;
    if (!viewport || !label) return;
    const bounds = viewport.getBoundingClientRect();
    if (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom) {
      label.textContent = 'X: —  Y: —';
      return;
    }
    const { x, y } = scenePoint(clientX, clientY);
    label.textContent = `X: ${x}  Y: ${y}`;
  };
  useEffect(() => { if (cursorLabelRef.current) cursorLabelRef.current.textContent = 'X: —  Y: —'; }, [room.id]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-scene-element]')) return;
      event.preventDefault();
      const current = viewRef.current, scale = Math.min(4, Math.max(1, current.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
      if (scale === current.scale) return;
      const bounds = viewport.getBoundingClientRect(), x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      applyView({ scale, x: x - (x - current.x) * scale / current.scale, y: y - (y - current.y) * scale / current.scale });
      showScenePosition(event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, [room.width, room.height]);
  const startPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('[data-scene-element]')) || viewRef.current.scale === 1) return;
    event.preventDefault();
    const { x, y } = viewRef.current;
    panRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const drag = panRef.current;
    if (drag?.pointerId === event.pointerId) {
      applyView({ scale: viewRef.current.scale, x: drag.x + event.clientX - drag.startX, y: drag.y + event.clientY - drag.startY });
      showScenePosition(event.clientX, event.clientY);
    }
  };
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const startPlayer = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !selectedPlayer || !room.player || room.player.locked === true) return;
    event.stopPropagation();
    const { x, y } = room.player.position;
    playerDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x, y, nextX: x, nextY: y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePlayer = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = playerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = sceneDelta(event.clientX - drag.startX, event.clientY - drag.startY);
    drag.nextX = Math.max(0, Math.min(room.width, Math.round(drag.x + delta.x)));
    drag.nextY = Math.max(0, Math.min(room.height, Math.round(drag.y + delta.y)));
    event.currentTarget.style.left = `${drag.nextX / room.width * 100}%`;
    event.currentTarget.style.top = `${drag.nextY / room.height * 100}%`;
  };
  const endPlayer = (event: PointerEvent<HTMLButtonElement>, canceled = false) => {
    const drag = playerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    playerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!canceled && (drag.nextX !== drag.x || drag.nextY !== drag.y)) onMovePlayer(drag.nextX, drag.nextY);
    else { event.currentTarget.style.left = `${drag.x / room.width * 100}%`; event.currentTarget.style.top = `${drag.y / room.height * 100}%`; }
  };
  const startItem = (event: PointerEvent<HTMLButtonElement>, element: Element) => {
    if (event.button !== 0 || selectedElementId !== element.game_id || element.locked === true) return;
    event.stopPropagation();
    const { x, y, width, height } = element.bounds;
    itemRef.current = { pointerId: event.pointerId, id: element.game_id, startX: event.clientX, startY: event.clientY, x, y, width, height, element: event.currentTarget, nextX: x, nextY: y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveItem = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = itemRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const delta = sceneDelta(event.clientX - drag.startX, event.clientY - drag.startY);
    drag.nextX = Math.max(0, Math.min(room.width - drag.width, Math.round(drag.x + delta.x)));
    drag.nextY = Math.max(0, Math.min(room.height - drag.height, Math.round(drag.y + delta.y)));
    drag.element.style.left = `${drag.nextX / room.width * 100}%`;
    drag.element.style.top = `${drag.nextY / room.height * 100}%`;
  };
  const endItem = (event: PointerEvent<HTMLButtonElement>, canceled = false) => {
    const drag = itemRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation(); itemRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (canceled) { drag.element.style.left = `${drag.x / room.width * 100}%`; drag.element.style.top = `${drag.y / room.height * 100}%`; }
    else if (drag.nextX !== drag.x || drag.nextY !== drag.y) onMoveElement(drag.id, drag.nextX, drag.nextY);
  };
  const startShape = (event: PointerEvent<SVGElement>, element: Element, vertex: number | null) => {
    event.stopPropagation();
    if (event.button !== 0 || element.locked === true) return;
    if (vertex !== null && event.altKey) {
      if (element.vertices!.length > 3) onChangeShape(element.game_id, element.vertices!.filter((_, index) => index !== vertex));
      return;
    }
    if (selectedElementId !== element.game_id) { onSelectElement(element.game_id); return; }
    const polygon = event.currentTarget.closest('svg')!.querySelector('polygon')!;
    shapeRef.current = { pointerId: event.pointerId, id: element.game_id, startX: event.clientX, startY: event.clientY, original: element.vertices!.map(point => ({ ...point })), next: element.vertices!.map(point => ({ ...point })), vertex, polygon };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveShape = (event: PointerEvent<SVGElement>) => {
    const drag = shapeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const delta = sceneDelta(event.clientX - drag.startX, event.clientY - drag.startY);
    if (drag.vertex === null) drag.next = movePolygon(drag.original, Math.round(delta.x), Math.round(delta.y), room.width, room.height);
    else drag.next = drag.original.map((point, index) => index === drag.vertex ? { x: Math.max(0, Math.min(room.width, Math.round(point.x + delta.x))), y: Math.max(0, Math.min(room.height, Math.round(point.y + delta.y))) } : point);
    drag.polygon.setAttribute('points', drag.next.map(point => `${point.x},${point.y}`).join(' '));
    const circles = drag.polygon.parentElement!.querySelectorAll('circle[data-vertex]');
    circles.forEach((circle, index) => { circle.setAttribute('cx', String(drag.next[index]!.x)); circle.setAttribute('cy', String(drag.next[index]!.y)); });
  };
  const endShape = (event: PointerEvent<SVGElement>, canceled = false) => {
    const drag = shapeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation(); shapeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!canceled && drag.next.some((point, index) => point.x !== drag.original[index]!.x || point.y !== drag.original[index]!.y)) onChangeShape(drag.id, drag.next);
    else drag.polygon.setAttribute('points', drag.original.map(point => `${point.x},${point.y}`).join(' '));
  };
  return <div className="panel scene-canvas">
    <div className="scene-canvas-heading"><p className="sidebar-label">Scene canvas</p><span ref={zoomLabelRef} aria-label="Scene zoom">100%</span><button type="button" onClick={() => applyView({ scale: 1, x: 0, y: 0 })}>Reset view</button><button type="button" onClick={onPlayScene} disabled={!canPlayScene}>Play scene</button></div>
    <div ref={viewportRef} className="scene-canvas-viewport" style={{ aspectRatio: `${room.width} / ${room.height}` }} onDragStart={event => event.preventDefault()} onPointerDown={startPan} onPointerMoveCapture={event => showScenePosition(event.clientX, event.clientY)} onPointerMove={movePan} onPointerLeave={() => { if (cursorLabelRef.current) cursorLabelRef.current.textContent = 'X: —  Y: —'; }} onPointerUp={endPan} onPointerCancel={endPan}>
      <div ref={contentRef} className="layout" style={{ backgroundImage: `url(${backgroundUrl})` }}>
        {room.elements.map((element, layer) => ({ element, layer })).filter(({ element }) => element.visible !== false && (element.locked !== true || ((element.type === 'image' || element.type === 'overlay') && element.media?.path))).map(({ element, layer }) => element.type === 'overlay' ? element.media?.path ? <img key={element.game_id} src={assetUrls.get(element.media.path)} alt="" draggable={false} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: element.enabled === false ? 0.4 : 1, pointerEvents: 'none', zIndex: layer + 1 + Number(layer >= (room.player?.layer ?? room.elements.length)) }} /> : null : element.type === 'shape' && element.vertices ? <svg key={element.game_id} className={`scene-shape${selectedElementId === element.game_id ? ' selected' : ''}${element.enabled === false ? ' disabled' : ''}${element.locked === true ? ' locked' : ''}`} style={{ zIndex: layer + 1 + Number(layer >= (room.player?.layer ?? room.elements.length)) }} viewBox={`0 0 ${room.width} ${room.height}`} preserveAspectRatio="none" aria-label={`Select element ${element.name}`}>
          <polygon data-scene-element points={element.vertices.map(point => `${point.x},${point.y}`).join(' ')} onPointerDown={event => startShape(event, element, null)} onPointerMove={moveShape} onPointerUp={endShape} onPointerCancel={event => endShape(event, true)} />
          {selectedElementId === element.game_id && element.locked !== true && <>{element.vertices.map((point, index) => { const next = element.vertices![(index + 1) % element.vertices!.length]!; return <line key={`edge-${index}`} data-scene-element className="scene-shape-edge" x1={point.x} y1={point.y} x2={next.x} y2={next.y} onPointerDown={event => { event.stopPropagation(); if (event.button !== 0) return; const added = scenePoint(event.clientX, event.clientY); onChangeShape(element.game_id, [...element.vertices!.slice(0, index + 1), added, ...element.vertices!.slice(index + 1)]); }} />; })}{element.vertices.map((point, index) => <circle key={`vertex-${index}`} data-scene-element data-vertex={index} className="scene-shape-vertex" cx={point.x} cy={point.y} r={Math.max(4, room.width / 200)} onPointerDown={event => startShape(event, element, index)} onPointerMove={moveShape} onPointerUp={event => endShape(event)} onPointerCancel={event => endShape(event, true)} />)}</>}
        </svg> : <button type="button" key={element.game_id} data-scene-element className={`scene-element${selectedElementId === element.game_id ? ' selected' : ''}${element.type === 'image' ? ' scene-image-element' : ''}${element.enabled === false ? ' disabled' : ''}${element.locked === true ? ' locked' : ''}`} aria-label={`Select element ${element.name}`} onClick={() => onSelectElement(element.game_id)} onPointerDown={event => startItem(event, element)} onPointerMove={moveItem} onPointerUp={event => endItem(event)} onPointerCancel={event => endItem(event, true)} style={{ left: `${element.bounds.x / room.width * 100}%`, top: `${element.bounds.y / room.height * 100}%`, width: `${element.bounds.width / room.width * 100}%`, height: `${element.bounds.height / room.height * 100}%`, zIndex: layer + 1 + Number(layer >= (room.player?.layer ?? room.elements.length)) }}>
          {element.type === 'image' && element.media?.path && (element.media.kind === 'image' ? <img src={assetUrls.get(element.media.path)} alt="" draggable={false} /> : <AtlasSprite element={element} urls={assetUrls} />)}
        </button>)}
        {room.player && <button type="button" data-scene-element className={`scene-player-marker${selectedPlayer ? ' selected' : ''}${room.player.locked === true ? ' locked' : ''}`} aria-label="Select Player" onClick={onSelectPlayer} onPointerDown={startPlayer} onPointerMove={movePlayer} onPointerUp={endPlayer} onPointerCancel={event => endPlayer(event, true)} style={{ left: `${room.player.position.x / room.width * 100}%`, top: `${room.player.position.y / room.height * 100}%`, transform: `translate(${-100 * (room.player.anchor?.x ?? 0.5)}%, ${-100 * (room.player.anchor?.y ?? 1)}%)`, zIndex: room.player.layer + 1, height: `${(idle?.height ?? 100) * room.player.scale / room.height * 100}%` }}>{playerImage ? <img src={playerImage} alt="" draggable={false} /> : <span>Player</span>}{selectedPlayer && room.player.locked !== true && <span className="scene-player-anchor" style={{ left: `${(room.player.anchor?.x ?? 0.5) * 100}%`, top: `${(room.player.anchor?.y ?? 1) * 100}%` }} aria-hidden="true" />}</button>}
      </div>
    </div>
    <div className="scene-canvas-coordinates" role="group" aria-label="Scene cursor coordinates"><span>Cursor position</span><code ref={cursorLabelRef}>X: —  Y: —</code></div>
  </div>;
}
