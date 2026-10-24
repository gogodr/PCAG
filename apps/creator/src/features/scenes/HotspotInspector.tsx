import type { Hotspot, Room } from '../../../../../packages/project-format/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

interface Props { room: Room; hotspot: Hotspot; edit: EditorController['edit'] }
export function HotspotInspector({ room, hotspot, edit }: Props) {
  const update = (change: (hotspot: Hotspot) => void) => edit(next => change(next.project.rooms.find(scene => scene.id === room.id)!.hotspots[0]!));
  return <><h3>Hotspot inspector</h3>
    <label>Hotspot name<input value={hotspot.name} onChange={event => update(next => { next.name = event.target.value; })} /></label>
    <div className="bounds-grid">{(['x', 'y', 'width', 'height'] as const).map(field => <label key={field}>{field.toUpperCase()}<input type="number" value={hotspot.bounds[field]} onChange={event => update(next => { next.bounds[field] = Number(event.target.value); })} /></label>)}</div>
    <label>View text<textarea rows={4} value={hotspot.inspect} onChange={event => update(next => { next.inspect = event.target.value; })} /></label>
    <p className="subtle">Hotspot ID: <code>{hotspot.id}</code></p>
  </>;
}
