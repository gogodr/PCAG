import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Room } from '../../../../../packages/project-format/src/index';
import { createId } from '../../../../../packages/project-format/src/index';
import type { WorkspaceFile } from '../../../../../packages/editor-workspace/src/index';
import { basename, matchesFileSignature, maxAssetBytes, validSegment } from '../../../../../packages/editor-workspace/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';

export function WalkableAreaInspector({ room, backgroundUrl, files, edit }: { room: Room; backgroundUrl: string; files: WorkspaceFile[]; edit: EditorController['edit'] }) {
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const area = room.walkableArea!;
  const update = (change: (area: NonNullable<Room['walkableArea']>) => void) => edit(next => {
    const selected = next.project.rooms.find(scene => scene.id === room.id)?.walkableArea;
    if (selected) change(selected);
  });
  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      if (!validSegment(file.name) || !file.name.toLowerCase().endsWith('.png') || file.size < 1 || file.size > maxAssetBytes(`images/${file.name}`)) throw new Error('Choose a PNG image within the project asset size limit.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesFileSignature('image/png', bytes)) throw new Error('The file is not a valid PNG.');
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const background = new Image();
      background.src = backgroundUrl;
      await background.decode();
      const matches = bitmap.width === background.naturalWidth && bitmap.height === background.naturalHeight;
      bitmap.close();
      if (!matches) throw new Error(`The Walkable Area must be exactly ${background.naturalWidth} × ${background.naturalHeight} pixels, matching the background.`);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
      const dataUrl = `data:image/png;base64,${btoa(binary)}`;
      const path = `images/${file.name}`;
      const existing = files.find(item => item.path === path);
      if (existing && existing.dataUrl !== dataUrl) throw new Error('A different file already uses this name in Images.');
      edit(next => {
        const selected = next.project.rooms.find(scene => scene.id === room.id)?.walkableArea;
        if (!selected) return;
        if (!existing) {
          const id = createId();
          next.files.push({ id, path, mime: 'image/png', dataUrl });
          next.project.assets.push({ id, name: file.name, kind: 'image', path });
        }
        selected.path = path;
      });
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the Walkable Area.'); }
  };
  const maskUrl = files.find(file => file.path === area.path)?.dataUrl;
  return <div className="scene-static-inspector walkable-inspector" aria-label="Walkable Area inspector">
    <div className="walkable-inspector-preview"><div className="walkable-inspector-layers" style={{ aspectRatio: `${room.width} / ${room.height}` }}>
      {backgroundUrl && <img className="walkable-preview-background" src={backgroundUrl} alt="Scene background preview" />}
      {maskUrl ? <img className="walkable-preview-mask" src={maskUrl} alt="Walkable Area mask preview" /> : <span>No walkable mask selected</span>}
    </div></div>
    <div className="walkable-inspector-controls"><h3>Mask image</h3><p className="subtle">A transparent PNG aligned with the background.</p>
    <div className="element-file-picker"><span title={area.path}>{area.path ? basename(area.path) : 'No image selected'}</span><button type="button" onClick={() => picker.current?.click()}>Choose PNG…</button><input ref={picker} type="file" accept=".png,image/png" aria-label="Walkable Area file" onChange={event => { void choose(event); }} hidden /></div>
    {area.path && <button type="button" onClick={() => update(next => { next.path = ''; })}>Clear image</button>}
    <h3>Depth scale</h3><div className="scene-static-fields"><label>Min scale<input type="number" aria-label="Walkable min scale" min="0.01" step="0.05" value={area.minScale} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value > 0 && value <= area.maxScale) update(next => { next.minScale = value; }); }} /></label>
      <label>Max scale<input type="number" aria-label="Walkable max scale" min={area.minScale} step="0.05" value={area.maxScale} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value) && value >= area.minScale) update(next => { next.maxScale = value; }); }} /></label></div>
    <p className="subtle">Transparent pixels block movement. Black uses max scale, white uses min scale, and gray blends between them. The image matches the background size and stays invisible while playing.</p>
    {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}
