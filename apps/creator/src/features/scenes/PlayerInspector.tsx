import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Character, Room } from '../../../../../packages/project-format/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

interface Props { room: Room; characters: Character[]; urls: ReadonlyMap<string, string>; edit: EditorController['edit'] }

export function PlayerInspector({ room, characters, urls, edit }: Props) {
  const player = room.player!;
  const character = characters.find(item => item.id === player.characterId);
  const [previewKey, setPreviewKey] = useState('idle');
  const preview = character?.animations.find(animation => animation.key === previewKey)
    ?? character?.animations.find(animation => animation.key.toLowerCase() === 'idle')
    ?? character?.animations[0];
  const previewUrl = preview && urls.get(preview.path);
  const anchor = player.anchor ?? { x: 0.5, y: 1 };
  const anchorPointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const anchorMarker = useRef<HTMLSpanElement>(null);
  const missing = ['idle', 'walk front', 'walk back', 'walk right', 'walk left'].filter(name => !character?.animations.some(animation => animation.key.toLowerCase() === name));
  const update = (change: (player: NonNullable<Room['player']>) => void) => edit(next => {
    const selected = next.project.rooms.find(scene => scene.id === room.id)?.player;
    if (selected) change(selected);
  });
  const setAnchor = (x: number, y: number) => update(next => { next.anchor = { x, y }; });
  const pointOnPreview = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, Math.round((event.clientX - bounds.left) / bounds.width * 100) / 100));
    const y = Math.max(0, Math.min(1, Math.round((event.clientY - bounds.top) / bounds.height * 100) / 100));
    return { x, y };
  };
  const showAnchor = (x: number, y: number) => {
    if (anchorMarker.current) { anchorMarker.current.style.left = `${x * 100}%`; anchorMarker.current.style.top = `${y * 100}%`; }
  };
  return <div className="scene-static-inspector player-inspector" aria-label="Player inspector">
    <section className="player-inspector-preview-section" aria-label="Character and animation preview">
    <label>Character<select aria-label="Player character" value={player.characterId} onChange={event => { const id = event.currentTarget.value; update(next => { next.characterId = id; }); setPreviewKey('idle'); }}><option value="">Choose character</option>{characters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <div className="player-preview-heading"><strong>Animation preview</strong><span>{preview?.key ?? 'No animation'}</span></div>
    {character?.animations.length ? <div className="player-preview-actions" role="group" aria-label="Player animation previews">{character.animations.map(animation => <button type="button" key={animation.key} aria-label={`Preview ${animation.key}`} aria-pressed={preview?.key === animation.key} onClick={() => setPreviewKey(animation.key)}>{animation.key}</button>)}</div> : <p className="subtle">Choose a character with animations to preview it.</p>}
    <div className="player-preview-frame" aria-label="Player animation preview">
      {preview && previewUrl ? <div className="player-preview-sprite" onPointerDown={event => { if (event.button !== 0) return; const point = pointOnPreview(event); anchorPointer.current = { id: event.pointerId, ...point }; event.currentTarget.setPointerCapture(event.pointerId); showAnchor(point.x, point.y); }} onPointerMove={event => { if (anchorPointer.current?.id !== event.pointerId) return; const point = pointOnPreview(event); anchorPointer.current = { id: event.pointerId, ...point }; showAnchor(point.x, point.y); }} onPointerUp={event => { const pending = anchorPointer.current; if (pending?.id !== event.pointerId) return; anchorPointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId); setAnchor(pending.x, pending.y); }} onPointerCancel={event => { if (anchorPointer.current?.id === event.pointerId) { anchorPointer.current = null; showAnchor(anchor.x, anchor.y); } }}>
        <img key={`${character?.id}:${preview.key}:${preview.path}`} src={previewUrl} alt={`${character?.name ?? 'Player'} ${preview.key}`} draggable={false} style={{ height: Math.min(preview.height, 200), transform: preview.mirrorX ? 'scaleX(-1)' : undefined }} />
        <span ref={anchorMarker} className="player-preview-anchor" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }} aria-hidden="true" />
      </div> : <span className="subtle">{preview ? 'Animation file unavailable.' : 'No animation selected.'}</span>}
    </div>
    </section>
    <section className="player-inspector-placement" aria-label="Player placement"><h3>Placement</h3><p className="subtle">The starting point and base size of the character.</p>
    <div className="scene-static-fields"><label>Initial X<input type="number" aria-label="Player initial X" min="0" max={room.width} value={player.position.x} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= room.width) update(next => { next.position.x = value; }); }} /></label>
      <label>Initial Y<input type="number" aria-label="Player initial Y" min="0" max={room.height} value={player.position.y} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= room.height) update(next => { next.position.y = value; }); }} /></label>
      <label>Scale<input type="number" aria-label="Player scale" min="0.01" step="0.05" value={player.scale} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value > 0) update(next => { next.scale = value; }); }} /></label></div>
    <h3>Anchor</h3>
    <div className="scene-static-fields"><label>Anchor X<input type="number" aria-label="Player anchor X" min="0" max="1" step="0.01" value={anchor.x} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 1) setAnchor(value, anchor.y); }} /></label>
      <label>Anchor Y<input type="number" aria-label="Player anchor Y" min="0" max="1" step="0.01" value={anchor.y} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 1) setAnchor(anchor.x, value); }} /></label></div>
    <p className="subtle">Drag the crosshair on the preview to set the point placed at Initial X/Y. The anchor also applies while the character walks. 0 is left or top; 1 is right or bottom.</p>
    {character && missing.length > 0 && <p className="subtle">Add {missing.join(', ')} in Characters for complete directional walking.</p>}
    </section>
  </div>;
}
