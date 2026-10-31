import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import { basename, rootOf } from '../../../../packages/editor-workspace/src/index';
import type { EditorController } from '../app/useEditorWorkspace';

type Selection = { status: 'select'; fps: number; frameCount: number; width: number; height: number; start: number; end: number; matched: boolean; thumbnails: string[] };
type Confirmed = { status: 'confirmed'; sourceFps: number; frames: number[]; width: number; height: number };
type ManualEntry = { baseAuto: boolean; seeds: { x: number; y: number; color: number[] }[] };
type Edit = { frames: number[]; fps: number; removeBg: boolean; pixelSize: number; palette: string[]; manual: Record<number, ManualEntry> };
type ExportResult = { folder: string; gif: string; atlas: string; metadata: string; insideProjectAssets: boolean };
const imageKey = (path: string, index: number, removeBg: boolean, pixelSize: number, palette: string[], manual?: ManualEntry) => `${path}:${index}:${removeBg}:${pixelSize}:${palette.join(',')}:${JSON.stringify(manual ?? null)}`;
const colorHex = (red: number, green: number, blue: number) => `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('')}`;
const animationError = (reason: unknown, fallback: string) => {
  if (!(reason instanceof Error)) return fallback;
  return reason.message.includes('Unsupported desktop operation')
    ? 'The running Creator window is using an older Electron preload. Restart npm run dev and select the animation again.'
    : reason.message;
};

export function AnimationsView({ editor, active }: { editor: EditorController; active: boolean }) {
  const root = editor.projectRoot;
  const videos = editor.workspace?.files.filter(file => rootOf(file.path) === 'video' && /\.(mp4|webm|mov|gif)$/i.test(file.path)) ?? [];
  const [path, setPath] = useState('');
  const [importName, setImportName] = useState('');
  const [pendingSource, setPendingSource] = useState<{ token: string; kind: 'video' | 'frames'; count: number } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [past, setPast] = useState<Edit[]>([]);
  const [future, setFuture] = useState<Edit[]>([]);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [targetFps, setTargetFps] = useState(6);
  const [pixelDraft, setPixelDraft] = useState(1);
  const [paletteDraft, setPaletteDraft] = useState<string[]>([]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [pickerColor, setPickerColor] = useState('#000000');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [eyedropperIndex, setEyedropperIndex] = useState<number | null | undefined>(undefined);
  const [targeting, setTargeting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [width, setWidth] = useState(90);
  const [height, setHeight] = useState(160);
  const [images, setImages] = useState<Record<string, string>>({});
  const [exported, setExported] = useState<ExportResult | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [loopPlaying, setLoopPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panDrag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const suppressImageClick = useRef(false);
  const pending = useRef(new Set<string>());
  const imageQueue = useRef<Array<() => void>>([]);
  const activeImages = useRef(0);
  const draggingSelection = useRef<{ mode: 'start' | 'end' | 'segment'; pointerFrame: number; start: number; end: number } | null>(null);
  const selectedFile = videos.find(file => file.path === path);
  const selected = edit?.frames[position];
  const previewPixelSize = edit && Number.isInteger(pixelDraft) && pixelDraft >= 1 && pixelDraft <= 128 ? pixelDraft : edit?.pixelSize ?? 1;
  const say = (value: string, isError = false) => { setMessage(value); setError(isError); };

  const acceptConfirmed = (result: Confirmed) => {
    setSelection(null); setConfirmed(result);
    setEdit({ frames: [...result.frames], fps: result.sourceFps, removeBg: false, pixelSize: 1, palette: [], manual: {} });
    setPast([]); setFuture([]); setPosition(0); setPlaying(false);
    setPixelDraft(1); setPaletteDraft([]); setPickerOpen(false); setEyedropperIndex(undefined); setTargeting(false); setZoom(1); setPan({ x: 0, y: 0 });
    setTargetFps(Math.min(6, Math.max(1, Math.floor(result.sourceFps - 1))));
    setExported(null); say('Animation loop ready. Source frames are unchanged until export.');
  };
  const pickSource = async (kind: 'video' | 'frames') => {
    if (!root || !window.pcagDesktop) return;
    setBusy(true);
    try {
      const result = await window.pcagDesktop.invoke<{ cancelled: true } | { token: string; kind: 'video' | 'frames'; name: string; count: number }>('animation-pick-source', root, kind);
      if ('cancelled' in result) return;
      setPendingSource({ token: result.token, kind: result.kind, count: result.count }); setImportName(result.name); say('Edit the animation name, then continue.');
    } catch (reason) { say(animationError(reason, 'Could not select animation source.'), true); }
    finally { setBusy(false); }
  };
  const importSource = async () => {
    if (!root || !pendingSource || !window.pcagDesktop) return;
    setBusy(true); say('Loading animation…');
    try {
      const imported = await window.pcagDesktop.invoke<{ path: string; result: Selection | Confirmed }>('animation-import-selection', root, pendingSource.token, importName);
      await editor.refreshLocalProject();
      setPath(imported.path); setPendingSource(null); setSelection(null); setConfirmed(null); setEdit(null); setExported(null); setVideoError(false); setLoopPlaying(true);
      if (imported.result.status === 'confirmed') acceptConfirmed(imported.result);
      else { setSelection(imported.result); setStart(imported.result.start); setEnd(imported.result.end); setCursor(imported.result.start); say(imported.result.matched ? 'Suggested loop found. Adjust the handles if needed.' : 'No clear return was found. Select the loop boundaries manually.'); }
    } catch (reason) { say(animationError(reason, 'Could not load animation.'), true); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (path && !videos.some(file => file.path === path)) { setPath(''); setSelection(null); setConfirmed(null); setEdit(null); } }, [path, editor.workspace?.files]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!active || !confirmed || !viewport) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(value => Math.max(.25, Math.min(8, value * (event.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, [active, confirmed]);
  useEffect(() => {
    if (!active || !selection || !loopPlaying) { videoRef.current?.pause(); return; }
    const video = videoRef.current;
    if (video && !videoError) void video.play().catch(reason => {
      if (reason instanceof DOMException && reason.name === 'NotSupportedError') setVideoError(true);
      else setLoopPlaying(false);
    });
    const timer = window.setInterval(() => {
      if (video && !videoError) {
        if (video.currentTime < start / selection.fps || video.currentTime >= end / selection.fps) video.currentTime = start / selection.fps;
        setCursor(Math.max(start, Math.min(end - 1, Math.floor(video.currentTime * selection.fps))));
      } else setCursor(frame => frame < start || frame >= end - 1 ? start : frame + 1);
    }, video && !videoError ? 30 : 1000 / selection.fps);
    return () => window.clearInterval(timer);
  }, [active, selection, loopPlaying, start, end, videoError]);
  const seek = (frame: number) => { setCursor(frame); if (videoRef.current && selection) videoRef.current.currentTime = frame / selection.fps; };
  const moveSelection = (event: PointerEvent<HTMLDivElement>) => {
    if (!selection) return;
    const drag = draggingSelection.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const frame = Math.round(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * selection.frameCount);
    if (drag.mode === 'start') { const value = Math.max(0, Math.min(drag.end - 1, frame)); setStart(value); seek(value); }
    else if (drag.mode === 'end') { const value = Math.min(selection.frameCount, Math.max(drag.start + 1, frame)); setEnd(value); seek(Math.min(value, selection.frameCount - 1)); }
    else {
      const delta = Math.max(-drag.start, Math.min(selection.frameCount - drag.end, frame - drag.pointerFrame));
      setStart(drag.start + delta); setEnd(drag.end + delta);
      seek(drag.start + delta);
    }
  };
  const confirm = async () => {
    if (!root || !selection || !path || !window.pcagDesktop) return;
    setBusy(true); say('Saving selected loop frames…');
    try {
      const result = await window.pcagDesktop.invoke<Confirmed>('animation-confirm', root, path, start, end);
      acceptConfirmed(result);
    } catch (reason) { say(animationError(reason, 'Could not save animation loop.'), true); }
    finally { setBusy(false); }
  };

  const drainImages = () => {
    while (activeImages.current < 4 && imageQueue.current.length) {
      activeImages.current += 1;
      imageQueue.current.shift()!();
    }
  };
  const loadImage = useCallback((index: number, removeBg: boolean, pixelSize: number, palette: string[], manual: ManualEntry | undefined, priority = false) => {
    if (!root || !path || !window.pcagDesktop) return;
    const key = imageKey(path, index, removeBg, pixelSize, palette, manual);
    if (images[key] || pending.current.has(key)) return;
    pending.current.add(key);
    const task = () => window.pcagDesktop!.invoke<string>('animation-frame', root, path, index, removeBg, pixelSize, palette, manual ? { [index]: manual } : {})
      .then(data => setImages(existing => ({ ...existing, [key]: `data:image/png;base64,${data}` })))
      .catch(reason => say(reason instanceof Error ? reason.message : 'Could not load loop frame.', true))
      .finally(() => { pending.current.delete(key); activeImages.current -= 1; drainImages(); });
    if (priority) imageQueue.current.unshift(task);
    else imageQueue.current.push(task);
    drainImages();
  }, [root, path, images]);
  useEffect(() => {
    if (!active || !confirmed || !edit) return;
    if (selected !== undefined) loadImage(selected, edit.removeBg, previewPixelSize, edit.palette, edit.manual[selected], true);
    for (const index of edit.frames) loadImage(index, edit.removeBg, edit.pixelSize, edit.palette, edit.manual[index]);
  }, [active, confirmed, edit?.frames, edit?.removeBg, edit?.pixelSize, edit?.palette, edit?.manual, selected, previewPixelSize, loadImage]);
  useEffect(() => {
    if (!active || !playing || !edit || edit.frames.length < 2) return;
    const timer = window.setInterval(() => setPosition(value => (value + 1) % edit.frames.length), 1000 / edit.fps);
    return () => window.clearInterval(timer);
  }, [active, playing, edit?.fps, edit?.frames.length]);
  const change = (next: Edit) => {
    if (!edit) return;
    setPast(existing => [...existing, edit]); setFuture([]); setEdit(next);
    setPosition(value => Math.min(value, next.frames.length - 1)); setPlaying(false); setExported(null);
  };
  const undo = () => {
    if (!edit || !past.length) return;
    const previous = past[past.length - 1]!;
    setFuture(existing => [edit, ...existing]); setEdit(previous); setPast(existing => existing.slice(0, -1));
    setPosition(value => Math.min(value, previous.frames.length - 1)); setPlaying(false); setExported(null);
    setPixelDraft(previous.pixelSize); setPaletteDraft([...previous.palette]);
  };
  const redo = () => {
    if (!edit || !future.length) return;
    const next = future[0]!;
    setPast(existing => [...existing, edit]); setEdit(next); setFuture(existing => existing.slice(1));
    setPosition(value => Math.min(value, next.frames.length - 1)); setPlaying(false); setExported(null);
    setPixelDraft(next.pixelSize); setPaletteDraft([...next.palette]);
  };
  const remove = () => {
    if (!edit || edit.frames.length <= 1) return;
    change({ ...edit, frames: edit.frames.filter((_, index) => index !== position) });
    say(`Removed source frame ${selected} from this edit.`);
  };
  useEffect(() => {
    if (!active || !edit) return;
    const keydown = (event: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if (event.key === 'Delete') { event.preventDefault(); remove(); }
      else if (event.code === 'Space') { event.preventDefault(); setPlaying(value => !value); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  const reduce = () => {
    if (!edit || edit.frames.length < 2) return;
    const fps = Number(targetFps);
    if (!Number.isInteger(fps) || fps < 1 || fps > 60 || fps >= edit.fps) { say('Choose a whole-number FPS from 1 to 60 below the current rate.', true); return; }
    const count = Math.max(2, Math.min(edit.frames.length, Math.round(edit.frames.length * fps / edit.fps)));
    const positions = [...new Set(Array.from({ length: count }, (_, index) => Math.round(index * (edit.frames.length - 1) / (count - 1))))];
    const frames = positions.map(index => edit.frames[index]!);
    change({ ...edit, frames, fps }); say(`Reduced to ${frames.length} frames at ${fps} fps.`);
  };
  const applyPixels = () => {
    if (!edit || !Number.isInteger(pixelDraft) || pixelDraft < 1 || pixelDraft > 128) { say('Choose a whole-number pixel size from 1 to 128.', true); return; }
    if (pixelDraft === edit.pixelSize) return;
    change({ ...edit, pixelSize: pixelDraft }); say(`Applied ${pixelDraft}px pixels to the loop.`);
  };
  const applyPalette = () => {
    if (!edit) return;
    if (paletteDraft.length > 32) { say('Use no more than 32 palette colors.', true); return; }
    change({ ...edit, palette: [...paletteDraft] }); say(paletteDraft.length ? `Applied ${paletteDraft.length} colors to the loop.` : 'Color palette cleared.');
  };
  const suggestPalette = async () => {
    if (!edit || selected === undefined || !root || !window.pcagDesktop) return;
    setBusy(true); say('Grouping visible sprite colors…');
    try {
      const result = await window.pcagDesktop.invoke<{ colors: string[] }>('animation-suggest-palette', root, path, selected, edit.removeBg, previewPixelSize, edit.manual);
      setPaletteDraft(result.colors); say(`Suggested ${result.colors.length} colors from frame ${selected}. Edit the palette before applying it.`);
    } catch (reason) { say(animationError(reason, 'Could not suggest a palette.'), true); }
    finally { setBusy(false); }
  };
  const savePicker = () => {
    setPaletteDraft(colors => pickerIndex === null ? [...colors, pickerColor] : colors.map((color, index) => index === pickerIndex ? pickerColor : color));
    setPickerOpen(false);
  };
  const sampleColor = async (event: MouseEvent<HTMLImageElement>) => {
    if (suppressImageClick.current || (eyedropperIndex === undefined && !targeting)) return;
    const image = event.currentTarget;
    const bounds = image.getBoundingClientRect();
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const displayWidth = image.naturalWidth * scale;
    const displayHeight = image.naturalHeight * scale;
    const x = Math.floor((event.clientX - bounds.left - (bounds.width - displayWidth) / 2) / scale);
    const y = Math.floor((event.clientY - bounds.top - (bounds.height - displayHeight) / 2) / scale);
    if (x < 0 || y < 0 || x >= image.naturalWidth || y >= image.naturalHeight) return;
    if (targeting && edit && selected !== undefined && root && window.pcagDesktop) {
      setBusy(true);
      try {
        const result = await window.pcagDesktop.invoke<{ color: number[]; pixels: number; baseAuto: boolean }>('animation-target', root, path, selected, x, y, edit.removeBg, edit.manual);
        const previous = edit.manual[selected] ?? { baseAuto: result.baseAuto, seeds: [] };
        change({ ...edit, manual: { ...edit.manual, [selected]: { ...previous, seeds: [...previous.seeds, { x, y, color: result.color }] } } });
        setTargeting(false);
        say(`Removed ${result.pixels} connected pixels from frame ${selected}.`);
      } catch (reason) { say(reason instanceof Error ? reason.message : 'Could not remove the targeted background.', true); }
      finally { setBusy(false); }
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0);
    const [red, green, blue, alpha] = context.getImageData(x, y, 1, 1).data;
    if (alpha === 0) { say('Choose a visible pixel to sample.', true); return; }
    const color = colorHex(red ?? 0, green ?? 0, blue ?? 0);
    setPaletteDraft(colors => eyedropperIndex === null ? [...colors, color] : colors.map((old, index) => index === eyedropperIndex ? color : old));
    setEyedropperIndex(undefined); say(`Sampled ${color}. Apply the palette when ready.`);
  };
  const exportFile = async () => {
    if (!root || !path || !edit || !window.pcagDesktop) return;
    if (![width, height].every(value => Number.isInteger(value) && value >= 1 && value <= 1024)) { say('Enter whole-number frame dimensions from 1 to 1024.', true); return; }
    setBusy(true); setExported(null); say('Choose a folder for the GIF and atlas…');
    try {
      const result = await window.pcagDesktop.invoke<ExportResult | { cancelled: true }>('animation-export', root, path, { frames: edit.frames, fps: edit.fps, removeBg: edit.removeBg, width, height, pixelSize: edit.pixelSize, palette: edit.palette, manual: edit.manual });
      if ('cancelled' in result) { say('Export canceled.'); return; }
      setExported(result); say(`Saved GIF and atlas to ${result.folder}`);
      if (result.insideProjectAssets) await editor.refreshLocalProject();
    } catch (reason) { say(reason instanceof Error ? reason.message : 'Export failed.', true); }
    finally { setBusy(false); }
  };
  const preview = selected === undefined || !edit ? undefined : images[imageKey(path, selected, edit.removeBg, previewPixelSize, edit.palette, edit.manual[selected])];
  const thumbnailStyle = (index: number) => index >= start && index < end ? 'animation-source-frame included' : 'animation-source-frame';

  return <section className="animation-view" hidden={!active} aria-label="Animation editor">
    {!root && <p className="animation-message error" role="alert">Animation processing is available in the desktop Creator app.</p>}
    {root && path && <button type="button" className="animation-new-source" onClick={() => { setPath(''); setSelection(null); setConfirmed(null); setEdit(null); setPendingSource(null); }}>Load another animation</button>}
    {root && !path && <div className="panel animation-empty"><p className="sidebar-label">STEP 1 / CHOOSE A FILE</p><h2>Select an animation to work on</h2><p className="subtle">Load a video or GIF, or import image frames directly.</p><div className="animation-import-frames"><button type="button" disabled={busy} onClick={() => void pickSource('video')}>Load Video</button><button type="button" disabled={busy} onClick={() => void pickSource('frames')}>Import frames</button></div>{pendingSource && <div className="animation-import-name"><label htmlFor="animation-import-name">Animation name<input id="animation-import-name" type="text" value={importName} disabled={busy} onChange={event => setImportName(event.target.value)} /></label><span className="subtle">{pendingSource.kind === 'video' ? 'Selected video' : `${pendingSource.count} frames selected`}</span><button type="button" disabled={busy || !importName.trim()} onClick={() => void importSource()}>Continue</button></div>}</div>}
    {selection && selectedFile && <>
      <div className="animation-heading"><div><p className="sidebar-label">STEP 2 / FIND THE LOOP</p><h2>{basename(path)}</h2><p className="subtle">The highlighted frames are the proposed loop. Drag either handle to choose its start and end.</p></div></div>
      <div className="animation-selection-layout"><div className="panel animation-source-preview"><p className="sidebar-label">LOOP PREVIEW</p>{selectedFile.mime === 'image/gif' || videoError ? <img src={`data:image/jpeg;base64,${selection.thumbnails[cursor]}`} alt={`Loop frame ${cursor}`} /> : <video ref={videoRef} muted playsInline src={selectedFile.dataUrl} aria-label="Selected animation loop preview" onError={() => setVideoError(true)} />}<div className="animation-playback"><button type="button" aria-label={loopPlaying ? 'Pause loop preview' : 'Play loop preview'} onClick={() => setLoopPlaying(value => !value)}>{loopPlaying ? 'Ⅱ' : '▶'}</button><span>Frame {cursor + 1} / {selection.frameCount}</span><span>{(cursor / selection.fps).toFixed(2)} s</span></div></div><div className="panel animation-boundaries"><p className="sidebar-label">LOOP BOUNDARIES</p><label>Start frame <strong>{start}</strong><input aria-label="Loop start frame" type="range" min={0} max={end - 1} value={start} onChange={event => { const value = Number(event.target.value); setStart(value); seek(value); }} /></label><label>End frame <strong>{end}</strong><input aria-label="Loop end frame" type="range" min={start + 1} max={selection.frameCount} value={end} onChange={event => { const value = Number(event.target.value); setEnd(value); seek(Math.min(value, selection.frameCount - 1)); }} /></label><p className="subtle">{(start / selection.fps).toFixed(2)}–{(end / selection.fps).toFixed(2)} s · {end - start} frames at {selection.fps.toFixed(2)} fps</p><button type="button" onClick={() => { setStart(selection.start); setEnd(selection.end); seek(selection.start); }}>Suggest animation loop</button><button type="button" disabled={busy} onClick={() => void confirm()}>Confirm Animation Loop</button></div></div>
      <div className="panel animation-source-timeline"><div className="animation-timeline-heading"><div><p className="sidebar-label">SOURCE TIMELINE</p><h2>Choose a complete cycle</h2></div><span className="subtle">{selection.frameCount} frames · {(selection.frameCount / selection.fps).toFixed(2)} s</span></div><div className="animation-source-frames">{selection.thumbnails.map((data, index) => <button type="button" key={index} className={thumbnailStyle(index) + (index === cursor ? ' cursor' : '')} title={`Frame ${index}`} onClick={() => seek(index)}><img src={`data:image/jpeg;base64,${data}`} alt="" /><span>{index}</span></button>)}</div><div className="animation-selection-bar" title="Drag a handle to resize or drag the highlighted segment to move the loop" onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); const frame = (event.clientX - rect.left) / rect.width * selection.frameCount; const tolerance = Math.max(1, 9 / rect.width * selection.frameCount); const mode = Math.abs(frame - start) <= tolerance ? 'start' : Math.abs(frame - end) <= tolerance ? 'end' : frame > start && frame < end ? 'segment' : Math.abs(frame - start) < Math.abs(frame - end) ? 'start' : 'end'; draggingSelection.current = { mode, pointerFrame: Math.round(frame), start, end }; event.currentTarget.setPointerCapture(event.pointerId); if (mode !== 'segment') moveSelection(event); }} onPointerMove={event => { if (draggingSelection.current) moveSelection(event); }} onPointerUp={event => { draggingSelection.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { draggingSelection.current = null; }}><span style={{ left: `${start / selection.frameCount * 100}%`, width: `${(end - start) / selection.frameCount * 100}%` }} /><i style={{ left: `${start / selection.frameCount * 100}%` }} /><i style={{ left: `${end / selection.frameCount * 100}%` }} /></div></div>
    </>}
    {confirmed && edit && <>
      <div className="animation-heading"><div><h2>{basename(path)}</h2><p className="subtle">Adjust timing and frames, then export a sprite atlas or GIF.</p></div><div className="animation-history"><button type="button" onClick={undo} disabled={!past.length}>Undo</button><button type="button" onClick={redo} disabled={!future.length}>Redo</button></div></div>
      <div className="animation-workspace"><div className="animation-stage panel"><div className="animation-panel-heading"><span className="sidebar-label">PREVIEW</span><span>{confirmed.width} × {confirmed.height} source · {confirmed.sourceFps} fps</span></div><div className="animation-viewport-controls"><button type="button" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(.25, value / 1.25))}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(8, value * 1.25))}>+</button><button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Reset view</button></div><div ref={viewportRef} className="animation-checker animation-pan-viewport" onPointerDown={event => { if (targeting || eyedropperIndex !== undefined) return; event.preventDefault(); panDrag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const drag = panDrag.current; if (!drag) return; const dx = event.clientX - drag.x; const dy = event.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; setPan({ x: drag.panX + dx, y: drag.panY + dy }); }} onPointerUp={event => { if (!panDrag.current) return; suppressImageClick.current = panDrag.current.moved; panDrag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); window.setTimeout(() => { suppressImageClick.current = false; }, 0); }} onPointerCancel={() => { panDrag.current = null; }}>{preview && <div className="animation-sprite-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}><img src={preview} alt={`Frame ${selected} of ${basename(path)}`} draggable={false} className={targeting || eyedropperIndex !== undefined ? 'animation-picking' : ''} onDragStart={event => event.preventDefault()} onClick={event => void sampleColor(event)} />{previewPixelSize > 1 && <svg className="animation-pixel-grid" aria-hidden="true" viewBox={`0 0 ${confirmed.width} ${confirmed.height}`} preserveAspectRatio="none"><defs><pattern id="animation-pixel-grid-pattern" width={previewPixelSize} height={previewPixelSize} patternUnits="userSpaceOnUse"><path d={`M ${previewPixelSize} 0 L 0 0 0 ${previewPixelSize}`} fill="none" stroke="#e3e5e4" strokeOpacity=".55" strokeWidth=".55" /></pattern></defs><rect width={confirmed.width} height={confirmed.height} fill="url(#animation-pixel-grid-pattern)" /></svg>}</div>}</div><div className="animation-playback"><button type="button" aria-label={playing ? 'Pause animation' : 'Play animation'} onClick={() => setPlaying(value => !value)}>{playing ? 'Ⅱ' : '▶'}</button><input aria-label="Current frame" type="range" min={0} max={edit.frames.length - 1} value={position} onChange={event => { setPlaying(false); setPosition(Number(event.target.value)); }} /><span>{position + 1} / {edit.frames.length}</span></div></div>
        <aside className="animation-tools panel"><p className="sidebar-label">EDIT LOOP</p><div className="animation-tool"><label htmlFor="animation-target-fps">TARGET FPS</label><div className="animation-inline"><input id="animation-target-fps" type="number" min={1} max={60} value={targetFps} onChange={event => setTargetFps(Number(event.target.value))} /><button type="button" onClick={reduce} disabled={edit.frames.length < 2}>Reduce frames</button></div><p className="subtle">Keeps evenly spaced frames, including the first and last.</p></div><div className="animation-tool"><span className="animation-field-label">BACKGROUND</span><button type="button" onClick={() => { change({ ...edit, removeBg: !edit.removeBg }); say(edit.removeBg ? 'Background restored.' : 'Background removed.'); }}>{edit.removeBg ? 'Restore background' : 'Remove background'}</button><p className="subtle">{edit.removeBg ? 'Transparent preview and exports.' : 'Original video backdrop is visible.'}</p></div><div className="animation-tool"><span className="animation-field-label">SELECTED FRAME</span><strong>Frame {String(selected ?? 0).padStart(3, '0')}</strong><p className="subtle">{(position / edit.fps).toFixed(2)} s in edit</p><button type="button" className="danger" disabled={edit.frames.length <= 1} onClick={remove}>Remove frame</button></div><div className="animation-tool"><span className="animation-field-label">EXPORT SIZE</span><div className="animation-size"><label>W<input type="number" min={1} max={1024} value={width} onChange={event => setWidth(Number(event.target.value))} /></label><span>×</span><label>H<input type="number" min={1} max={1024} value={height} onChange={event => setHeight(Number(event.target.value))} /></label></div><div className="animation-export-actions"><button type="button" disabled={busy} onClick={() => void exportFile()}>Export GIF and atlas…</button></div><p className="subtle">Choose a destination folder. The dialog starts in the project's animation folder.</p></div></aside></div>
      <div className="panel animation-target-tool"><div><p className="animation-field-label">TARGETED BACKGROUND REMOVAL</p><p className="subtle">Click a background pixel in the preview to remove only its connected color region on this frame. Frames edited here are skipped by whole-loop background removal.</p></div><button type="button" disabled={busy} onClick={() => { setTargeting(value => !value); setEyedropperIndex(undefined); setPlaying(false); }}>{targeting ? 'Cancel targeted removal' : 'Targeted removal'}</button>{selected !== undefined && edit.manual[selected] && <span>{edit.manual[selected].seeds.length} target{edit.manual[selected].seeds.length === 1 ? '' : 's'} on this frame</span>}</div>
      <div className="panel animation-color-tools">
        <div className="animation-tool"><p className="animation-field-label">PIXEL QUANTIZE</p><div className="animation-inline"><label>Pixel size<input aria-label="Pixel size" type="number" min={1} max={128} step={1} value={pixelDraft} onChange={event => setPixelDraft(Number(event.target.value))} /></label><button type="button" disabled={pixelDraft === edit.pixelSize} onClick={applyPixels}>Apply pixel quantize</button></div><p className="subtle">Preview updates as you change the size. Apply uses nearest-neighbor sampling on every frame.</p></div>
        <div className="animation-tool"><p className="animation-field-label">COLOR PALETTE BUILDER</p><div className="animation-palette-list">{paletteDraft.map((color, index) => <div className="animation-palette-color" key={index}><span className="animation-swatch" style={{ background: color }} /><span>{color}</span><button type="button" aria-label={`Edit color ${index + 1}`} onClick={() => { setPickerIndex(index); setPickerColor(color); setPickerOpen(true); }}>Edit</button><button type="button" aria-label={`Sample color ${index + 1}`} onClick={() => { setEyedropperIndex(index); setPlaying(false); say('Click a visible pixel in the preview to sample its color.'); }}>Eyedropper</button><button type="button" aria-label={`Remove color ${index + 1}`} onClick={() => setPaletteDraft(colors => colors.filter((_, place) => place !== index))}>Remove</button></div>)}</div><div className="animation-palette-actions"><button type="button" disabled={busy} onClick={() => void suggestPalette()}>Suggest palette</button><button type="button" disabled={paletteDraft.length >= 32} onClick={() => { setPickerIndex(null); setPickerColor('#000000'); setPickerOpen(true); }}>Add color</button><button type="button" disabled={paletteDraft.length >= 32} onClick={() => { setEyedropperIndex(null); setPlaying(false); say('Click a visible pixel in the preview to add its color.'); }}>Add with eyedropper</button><button type="button" disabled={paletteDraft.join() === edit.palette.join()} onClick={applyPalette}>Apply Color Palette</button></div><p className="subtle">Suggestions group visible colors when their summed RGB difference is at most 80. Edit before applying. Transparent pixels keep their alpha.</p></div>
      </div>
      {pickerOpen && <div className="animation-modal-backdrop" role="presentation"><div className="panel animation-color-modal" role="dialog" aria-modal="true" aria-label="RGB color selector"><p className="sidebar-label">RGB COLOR</p><input aria-label="RGB color picker" type="color" value={pickerColor} onChange={event => setPickerColor(event.target.value)} /><div className="animation-rgb-inputs">{(['R', 'G', 'B'] as const).map((channel, place) => <label key={channel}>{channel}<input aria-label={`${channel} value`} type="number" min={0} max={255} value={parseInt(pickerColor.slice(place * 2 + 1, place * 2 + 3), 16)} onChange={event => { const parts = [0, 1, 2].map(index => parseInt(pickerColor.slice(index * 2 + 1, index * 2 + 3), 16)); parts[place] = Math.max(0, Math.min(255, Number(event.target.value) || 0)); setPickerColor(colorHex(parts[0]!, parts[1]!, parts[2]!)); }} /></label>)}</div><span>{pickerColor}</span><div className="animation-palette-actions"><button type="button" onClick={() => setPickerOpen(false)}>Cancel</button><button type="button" onClick={savePicker}>Save color</button></div></div></div>}
      <div className="animation-timeline panel"><div className="animation-timeline-heading"><div><p className="sidebar-label">FRAME STRIP</p><h2>Current sequence <small>({edit.frames.length} frames)</small></h2></div><span className="subtle">{(edit.frames.length / edit.fps).toFixed(2)} s · {edit.fps} fps</span></div><div className="animation-frames">{edit.frames.map((index, place) => <button type="button" className={`animation-frame${place === position ? ' selected' : ''}${edit.manual[index] ? ' manually-edited' : ''}`} key={index} title={`Select source frame ${index}${edit.manual[index] ? ' (targeted background edit)' : ''}`} onClick={() => { setPlaying(false); setPosition(place); }}><img src={images[imageKey(path, index, edit.removeBg, edit.pixelSize, edit.palette, edit.manual[index])]} alt="" loading="lazy" /><span>#{String(index).padStart(3, '0')}{edit.manual[index] ? ' · edited' : ''}</span></button>)}</div></div>
    </>}
    {message && <div className={error ? 'animation-message error' : 'animation-message'} role={error ? 'alert' : 'status'}>{message}{exported && root && <button type="button" onClick={() => void window.pcagDesktop?.invoke('animation-reveal-export', root, path, exported.gif)}>Show in folder</button>}</div>}
  </section>;
}
