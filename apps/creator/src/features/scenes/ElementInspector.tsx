import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { allowedMime, basename, matchesFileSignature, maxAssetBytes, validSegment } from '../../../../../packages/editor-workspace/src/index';
import type { WorkspaceFile } from '../../../../../packages/editor-workspace/src/index';
import { animationAtlasFromDataUrl } from '../../../../../packages/animation-atlas/src/index';
import type { Bounds, Element, ElementMedia, PlayerAction, Room } from '../../../../../packages/project-format/src/index';
import { createId, playerActions } from '../../../../../packages/project-format/src/index';
import { movePolygon } from '../../../../../packages/project-format/src/element-geometry';
import { playerActionLabels } from '../../../../../packages/scene-events/src/index';
import type { EditorController } from '../../app/useEditorWorkspace';
import { ElementMediaPreview } from './ElementMediaPreview';

interface Props { room: Room; element: Element; backgroundUrl: string; files: WorkspaceFile[]; edit: EditorController['edit'] }
const rounded = (value: number) => Math.round(value * 100) / 100;
function fitImage(bounds: Bounds, naturalWidth: number, naturalHeight: number, room: Room): void {
  const factor = Math.min(1, (room.width - bounds.x) / naturalWidth, (room.height - bounds.y) / naturalHeight);
  bounds.width = rounded(naturalWidth * factor);
  bounds.height = rounded(naturalHeight * factor);
}
function resizeImage(bounds: Bounds, media: ElementMedia, field: 'width' | 'height', value: number, room: Room): void {
  const availableWidth = room.width - bounds.x, availableHeight = room.height - bounds.y;
  if (!media.preserveAspectRatio) {
    bounds[field] = rounded(Math.max(0.01, Math.min(value, field === 'width' ? availableWidth : availableHeight)));
    return;
  }
  const factor = Math.min(value / media[field], availableWidth / media.width, availableHeight / media.height);
  bounds.width = rounded(Math.max(0.01, media.width * factor));
  bounds.height = rounded(Math.max(0.01, media.height * factor));
}
function dataUrl(mime: string, bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}
async function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('The selected image could not be decoded.'));
    image.src = url;
  });
}

export function ElementInspector({ room, element, backgroundUrl, files, edit }: Props) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const update = (change: (element: Element) => void) => edit(next => {
    const selected = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(item => item.game_id === element.game_id);
    if (selected) change(selected);
  });
  const updateBounds = (field: keyof Bounds, value: number) => {
    if (!Number.isInteger(value)) return;
    update(next => {
      const bounds = next.bounds;
      if (field === 'x' || field === 'y') {
        const limit = field === 'x' ? room.width - bounds.width : room.height - bounds.height;
        const position = Math.max(0, Math.min(value, limit));
        if (next.type === 'shape' && next.vertices) next.vertices = movePolygon(next.vertices, field === 'x' ? position - bounds.x : 0, field === 'y' ? position - bounds.y : 0, room.width, room.height);
        bounds[field] = position;
      } else if (next.type === 'box' || !next.type) bounds[field] = Math.max(1, Math.min(value, field === 'width' ? room.width - bounds.x : room.height - bounds.y));
    });
  };
  const chooseFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!picked.length || !element.media) return;
    try {
      const kind = element.media.kind;
      if (picked.length !== 1) throw new Error(kind === 'image' ? 'Choose one image file.' : 'Choose one animation atlas JSON file.');
      const folder = kind === 'image' ? 'images' : 'animation';
      const file = picked[0]!, importedPath = `${folder}/${file.name}`, mime = allowedMime(importedPath);
      if (!validSegment(file.name) || !mime || kind === 'animation' && mime !== 'application/json' || file.size < 1 || file.size > maxAssetBytes(importedPath)) throw new Error(`Choose a supported project ${kind} file under ${Math.round(maxAssetBytes(importedPath) / 1_000_000)} MB.`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesFileSignature(mime, bytes)) throw new Error(`${file.name} is not a valid ${kind} file.`);
      const url = dataUrl(mime, bytes);
      const atlas = kind === 'animation' ? animationAtlasFromDataUrl(url) : null;
      if (kind === 'animation' && !atlas) throw new Error('The selected file is not a valid animation atlas JSON.');
      const existing = files.find(item => item.path === importedPath && item.dataUrl === url) ?? (kind === 'animation' ? files.find(item => item.mime === mime && item.dataUrl === url && basename(item.path) === file.name) : undefined);
      const atlasImages = atlas ? files.filter(item => item.mime === 'image/png' && basename(item.path) === atlas.image && item.path.startsWith('animation/')) : [];
      if (atlas && !existing && atlasImages.length !== 1) throw new Error(atlasImages.length ? `More than one ${atlas.image} is in the project. Import the JSON into its atlas folder first.` : `The atlas image ${atlas.image} is missing. Import it into the animation folder first.`);
      const selectedPath = existing?.path ?? (atlasImages.length ? `${atlasImages[0]!.path.slice(0, atlasImages[0]!.path.lastIndexOf('/'))}/${file.name}` : importedPath);
      if (!existing && files.some(item => item.path === selectedPath)) throw new Error(`${file.name} already exists with different contents. Rename it before importing.`);
      const additions: WorkspaceFile[] = existing ? [] : [{ id: createId(), path: selectedPath, mime, dataUrl: url }];
      let naturalWidth: number, naturalHeight: number;
      if (kind === 'image') {
        const dimensions = await imageSize(url);
        naturalWidth = dimensions.width; naturalHeight = dimensions.height;
      } else {
        const imagePath = `${selectedPath.slice(0, selectedPath.lastIndexOf('/'))}/${atlas!.image}`;
        if (!files.some(file => file.path === imagePath && file.mime === 'image/png')) throw new Error(`The atlas image ${atlas!.image} is missing. Import it into the same animation folder first.`);
        naturalWidth = atlas!.frameWidth; naturalHeight = atlas!.frameHeight;
      }
      if (!(naturalWidth > 0 && naturalHeight > 0)) throw new Error('The selected file has no usable dimensions.');
      if (element.type === 'overlay') {
        if (!backgroundUrl) throw new Error('Choose a scene background before choosing an Overlay image.');
        const background = await imageSize(backgroundUrl);
        if (naturalWidth !== background.width || naturalHeight !== background.height) throw new Error(`Overlay image must be ${background.width} × ${background.height} pixels to match the background.`);
      }
      edit(next => {
        const selected = next.project.rooms.find(scene => scene.id === room.id)?.elements.find(item => item.game_id === element.game_id);
        if (!selected?.media) return;
        for (const file of additions) {
          next.files.push(file);
          if (kind === 'image') next.project.assets.push({ id: file.id, name: basename(file.path), kind: 'image', path: file.path });
        }
        selected.media.path = selectedPath;
        selected.media.width = naturalWidth; selected.media.height = naturalHeight;
        if (selected.type !== 'overlay') fitImage(selected.bounds, naturalWidth, naturalHeight, room);
      });
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not choose a file.'); }
  };
  const media = element.media;
  return <fieldset className="element-inspector" data-kind={element.type ?? 'box'} aria-label="Element inspector">
    <div className="element-inspector-heading"><h3>{element.type === 'shape' ? 'Shape' : element.type === 'image' ? 'Image' : element.type === 'overlay' ? 'Overlay' : 'Box'} element</h3><span>Game ID <code title={element.game_id}>{element.game_id}</code></span></div>
    <section className="element-inspector-group element-identity-group" aria-label="Identity"><h4>Identity</h4><div className="element-identity-fields">
      <label>Element ID<input aria-label="Element ID" value={element.element_id ?? ''} onChange={event => { const value = event.currentTarget.value; update(next => { next.element_id = value; }); }} /></label>
      {element.type !== 'overlay' && <label>Name<input aria-label="Element name" value={element.name ?? ''} onChange={event => { const value = event.currentTarget.value; update(next => { next.name = value; }); }} /></label>}
    </div></section>
    {element.type !== 'overlay' && <section className="element-inspector-group" aria-label="Available Actions"><h4>Available Actions</h4><div className="element-actions-grid">{playerActions.map(action => <label key={action} className="element-checkbox"><input type="checkbox" aria-label={`Available action ${playerActionLabels[action].replace('Player: ', '')}`} checked={(element.availableActions ?? ['view']).includes(action)} onChange={event => { const checked = event.currentTarget.checked; update(next => { const selected = new Set<PlayerAction>(next.availableActions ?? ['view']); if (checked) selected.add(action); else selected.delete(action); next.availableActions = playerActions.filter(candidate => selected.has(candidate)); }); }} />{playerActionLabels[action].replace('Player: ', '')}</label>)}</div></section>}
    {media && <section className="element-inspector-group" aria-label="Element source"><h4>Source</h4><div className="element-media-controls">
      {element.type !== 'overlay' && <label>Type<select aria-label="Element source type" value={media.kind} onChange={event => { setError(''); update(next => { if (next.media) { next.media.kind = event.target.value as 'image' | 'animation'; next.media.path = ''; } }); }}><option value="image">Image</option><option value="animation">Animation</option></select></label>}
      <div className="element-file-picker"><span title={media.path}>{media.path ? basename(media.path) : 'No file selected'}</span><button type="button" aria-label="Choose element file" onClick={() => pickerRef.current?.click()}>Choose {media.kind === 'image' ? 'image' : 'animation'}…</button><input ref={pickerRef} type="file" aria-label="Element files" accept={media.kind === 'image' ? '.png,.jpg,.jpeg,.webp,.svg,.gif' : '.json'} onChange={event => { void chooseFiles(event); }} hidden /></div>
    </div>{media.kind === 'animation' && <p className="subtle element-picker-help">The atlas PNG is loaded from the same project folder.</p>}</section>}
    {media?.path && <ElementMediaPreview media={media} files={files} />}
    {element.type === 'overlay' ? <p className="subtle">Aligned to the background and sized to fill the scene. Choose an image with the same pixel dimensions as the background.</p> : <section className="element-inspector-group" aria-label="Element geometry"><h4>Position & size</h4>
      <div className="element-inspector-fields">{(['x', 'y', 'width', 'height'] as const).filter(field => element.type === 'box' || !element.type || field === 'x' || field === 'y').map(field => <label key={field}>{field.toUpperCase()}<input type="number" aria-label={`Element ${field}`} min={field === 'width' || field === 'height' ? 1 : 0} value={element.bounds[field]} onChange={event => updateBounds(field, event.currentTarget.valueAsNumber)} /></label>)}
      {media && <><label>Width<input type="number" aria-label="Element width" min="0.01" step="any" value={element.bounds.width} onChange={event => { const value = event.currentTarget.valueAsNumber; if (!Number.isFinite(value) || value <= 0) return; update(next => { if (next.media) resizeImage(next.bounds, next.media, 'width', value, room); }); }} /></label><label>Height<input type="number" aria-label="Element height" min="0.01" step="any" value={element.bounds.height} onChange={event => { const value = event.currentTarget.valueAsNumber; if (!Number.isFinite(value) || value <= 0) return; update(next => { if (next.media) resizeImage(next.bounds, next.media, 'height', value, room); }); }} /></label></>}</div>
      {media && <label className="element-checkbox"><input type="checkbox" aria-label="Preserve aspect ratio" checked={media.preserveAspectRatio} onChange={event => update(next => { if (!next.media) return; next.media.preserveAspectRatio = event.target.checked; if (event.target.checked) resizeImage(next.bounds, next.media, 'width', next.bounds.width, room); })} />Preserve aspect ratio</label>}
      {element.type === 'shape' && <p className="subtle element-shape-help">Drag vertices; click an edge to add one; Alt+click a vertex to remove it. Drag inside to move the shape.</p>}
    </section>}
    {media?.kind === 'animation' && <section className="element-inspector-group" aria-label="Animation settings"><h4>Playback</h4><div className="element-playback-controls"><label>Run<select aria-label="Element playback" value={media.loop ? 'loop' : 'once'} onChange={event => update(next => { if (next.media) next.media.loop = event.target.value === 'loop'; })}><option value="once">Single run</option><option value="loop">Loop</option></select></label><label className="element-checkbox"><input type="checkbox" aria-label="Reverse animation" checked={media.reverse} onChange={event => update(next => { if (next.media) next.media.reverse = event.target.checked; })} />Reverse animation</label></div></section>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
