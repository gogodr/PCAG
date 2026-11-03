import { useEffect, useMemo, useState } from 'react';
import { createId } from '../../../../packages/project-format/src/index';
import type { Character, CharacterAnimation } from '../../../../packages/project-format/src/index';
import { allowedMime, animationAtlasFiles, matchesFileSignature, maxAssetBytes, rootOf, validSegment } from '../../../../packages/editor-workspace/src/index';
import type { WorkspaceFile } from '../../../../packages/editor-workspace/src/index';
import type { EditorController } from '../app/useEditorWorkspace';

const required = ['idle', 'walk front', 'walk back', 'walk right', 'walk left'];
const optional = ['run front', 'run back', 'run right', 'run left'];
const fixed = new Set([...required, ...optional]);
const normalizeAnimation = (animation: CharacterAnimation) => {
  const previous = animation as CharacterAnimation & { width?: number };
  animation.height ??= previous.width ?? 160;
  animation.mirrorX ??= false;
  delete previous.width;
};

export function CharactersView({ editor }: { editor: EditorController }) {
  const workspace = editor.workspace;
  const characters = workspace?.project.characters ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [error, setError] = useState('');
  const selected = creating ? null : (characters.find(character => character.id === selectedId) ?? characters[0] ?? null);
  const references = workspace?.project.assets.filter(asset => rootOf(asset.path) === 'images' || rootOf(asset.path) === 'backgrounds') ?? [];
  const hidden = useMemo(() => new Set(workspace?.files.flatMap(file => {
    const companions = animationAtlasFiles(file);
    return companions ? [companions.image] : [];
  }) ?? []), [workspace?.files]);
  const sprites = workspace?.files.filter(file => (rootOf(file.path) === 'animation' || rootOf(file.path) === 'images') && (file.mime === 'image/gif' || file.mime === 'image/png' || file.mime === 'image/jpeg' || file.mime === 'image/webp') && !hidden.has(file.path)) ?? [];
  const fileUrls = useMemo(() => new Map(workspace?.files.map(file => [file.path, file.dataUrl]) ?? []), [workspace?.files]);
  const assetPaths = useMemo(() => new Map(workspace?.project.assets.map(asset => [asset.id, asset.path]) ?? []), [workspace?.project.assets]);
  const url = (path: string) => fileUrls.get(path);
  const imageOf = (character: Character) => url(assetPaths.get(character.referenceAssetId) ?? '');
  useEffect(() => { if (selectedId && !characters.some(character => character.id === selectedId)) setSelectedId(null); }, [characters, selectedId]);

  const update = (id: string, change: (character: Character) => void) => editor.edit(next => {
    const character = next.project.characters?.find(item => item.id === id);
    if (character) { character.animations.forEach(normalizeAnimation); change(character); }
  });
  const pick = async (kind: 'reference' | 'animation', apply: (path: string, id: string | null, addition: WorkspaceFile | null) => void) => {
    try {
      if (editor.projectRoot && window.pcagDesktop) {
        const path = await window.pcagDesktop.invoke<string | null>('pick-character-file', editor.projectRoot, kind);
        if (!path) return;
        const file = workspace?.files.find(item => item.path === path);
        if (!file || kind === 'reference' && !references.some(asset => asset.path === path) || kind === 'animation' && !sprites.some(item => item.path === path)) { setError('Import this file in Assets first, then choose it here.'); return; }
        apply(path, file.id, null);
      } else {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = kind === 'reference' ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp,image/gif';
        input.onchange = async () => { try {
          const file = input.files?.[0];
          if (!file || !workspace) return;
          const folder = kind === 'reference' ? 'images' : 'animation';
          const path = `${folder}/${file.name}`;
          const mime = allowedMime(path);
          const bytes = new Uint8Array(await file.arrayBuffer());
          if (!validSegment(file.name) || !mime || !matchesFileSignature(mime, bytes) || file.size > maxAssetBytes(path) || workspace.files.some(item => item.path === path)) { setError('Choose a supported image or GIF with a unique filename.'); return; }
          let binary = '';
          for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
          const addition = { id: createId(), path, mime, dataUrl: `data:${mime};base64,${btoa(binary)}` };
          apply(path, addition.id, addition);
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not import file.'); } };
        input.click();
      }
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not choose file.'); }
  };
  const addPickedFile = (next: NonNullable<typeof workspace>, addition: WorkspaceFile | null) => {
    if (!addition) return;
    next.files.push(addition);
    if (rootOf(addition.path) === 'images') next.project.assets.push({ id: addition.id, name: addition.path.slice(addition.path.lastIndexOf('/') + 1), kind: 'image', path: addition.path });
  };
  const pickReference = () => void pick('reference', (_path, id, addition) => {
    if (!id) return;
    if (selected) editor.edit(next => { addPickedFile(next, addition); next.project.characters!.find(item => item.id === selected.id)!.referenceAssetId = id; });
    else { if (addition) editor.edit(next => addPickedFile(next, addition)); setReferenceId(id); }
  });
  const saveNew = () => {
    if (!name.trim() || !referenceId) { setError('Enter a name and choose a reference image.'); return; }
    const id = createId();
    editor.edit(next => { (next.project.characters ??= []).push({ id, name: name.trim(), referenceAssetId: referenceId, animations: [] }); });
    setSelectedId(id); setCreating(false); setName(''); setReferenceId(''); setError('');
  };
  const setAnimation = (key: string, path: string, addition: WorkspaceFile | null = null) => {
    if (!selected) return;
    editor.edit(next => {
      addPickedFile(next, addition);
      const character = next.project.characters?.find(item => item.id === selected.id);
      if (!character) return;
      character.animations.forEach(normalizeAnimation);
      const current = character.animations.find(item => item.key === key);
      if (!path) character.animations = character.animations.filter(item => item.key !== key);
      else if (current) current.path = path;
      else character.animations.push({ key, path, height: 160, mirrorX: false });
    });
  };
  const addCustom = () => {
    if (!selected) return;
    const key = customName.trim();
    if (!key || fixed.has(key.toLowerCase()) || selected.animations.some(item => item.key.toLowerCase() === key.toLowerCase())) { setError('Enter a unique custom animation name.'); return; }
    if (!customPath) { setError('Choose a sprite or GIF for the custom animation.'); return; }
    update(selected.id, character => character.animations.push({ key, path: customPath, height: 160, mirrorX: false }));
    setCustomName(''); setCustomPath(''); setError('');
  };
  const removeCharacter = () => {
    if (!selected) return;
    if (workspace?.project.rooms.some(room => room.player?.characterId === selected.id)) { setError('This character is assigned to a scene Player. Choose another character in Scenes before deleting it.'); return; }
    if (!window.confirm(`Delete character “${selected.name}”?`)) return;
    editor.edit(next => { next.project.characters = (next.project.characters ?? []).filter(item => item.id !== selected.id); });
    setSelectedId(null);
  };
  const slot = (key: string, kind: 'required' | 'optional' | 'custom') => {
    if (!selected) return null;
    const animation: CharacterAnimation | undefined = selected.animations.find(item => item.key === key);
    const legacy = animation as (CharacterAnimation & { width?: number }) | undefined;
    const height = animation ? animation.height ?? legacy?.width ?? 160 : 160;
    const mirrored = animation?.mirrorX ?? false;
    const src = animation && url(animation.path);
    return <article className="character-slot" key={key}>
      <div className="character-slot-head"><div><strong>{key}</strong><span>{kind}</span></div>{kind === 'custom' && <button type="button" className="danger" aria-label={`Remove ${key}`} onClick={() => update(selected.id, character => { character.animations = character.animations.filter(item => item.key !== key); })}>Remove</button>}</div>
      <div className="character-frame" aria-label={`${key} preview`}>{src ? <img src={src} alt={`${selected.name} ${key} animation`} style={{ height, transform: mirrored ? 'scaleX(-1)' : undefined }} /> : <span>No sprite loaded</span>}</div>
      <div className="character-file-choice"><span title={animation?.path}>{animation?.path ?? 'No file selected'}</span><button type="button" aria-label={`Choose ${key} sprite`} onClick={() => void pick('animation', (path, _id, addition) => setAnimation(key, path, addition))}>Choose file…</button>{animation && <button type="button" className="danger" aria-label={`Clear ${key} sprite`} onClick={() => setAnimation(key, '')}>Clear</button>}</div>
      {animation && <><label>Displayed height <span>{height}px</span><input aria-label={`${key} height`} type="range" min={16} max={512} value={height} onChange={event => update(selected.id, character => { character.animations.find(item => item.key === key)!.height = Number(event.target.value); })} /><input aria-label={`${key} height in pixels`} type="number" min={1} max={2048} value={height} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= 2048) update(selected.id, character => { character.animations.find(item => item.key === key)!.height = value; }); }} /></label><label className="character-mirror"><input type="checkbox" aria-label={`Mirror ${key} horizontally`} checked={mirrored} onChange={event => update(selected.id, character => { character.animations.find(item => item.key === key)!.mirrorX = event.target.checked; })} />Mirror horizontally</label></>}
    </article>;
  };
  if (!workspace) return null;
  return <div className="characters-view">
    <aside className="panel character-list"><div className="character-list-head"><h2>Characters</h2><button type="button" onClick={() => { setCreating(true); setSelectedId(null); setError(''); }}>New character</button></div>
      {characters.map(character => <button type="button" key={character.id} aria-current={selected?.id === character.id ? 'true' : undefined} className={`character-list-row${selected?.id === character.id ? ' selected' : ''}`} onClick={() => { setSelectedId(character.id); setCreating(false); setError(''); }}><span className="character-list-avatar">{imageOf(character) && <img src={imageOf(character)} alt="" />}</span><span>{character.name}<small>{character.animations.length} animations</small></span></button>)}
      {!characters.length && <p className="subtle">Create a character to assign its reference and animations.</p>}
    </aside>
    <section className="character-main">
      {creating && <div className="panel character-create"><h2>New character</h2><p className="subtle">A name and reference image are required.</p><label>Name<input aria-label="Character name" autoFocus value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveNew(); }} /></label><div className="character-file-choice"><span>{references.find(asset => asset.id === referenceId)?.path ?? 'No reference image selected'}</span><button type="button" onClick={pickReference}>Choose reference…</button></div><div className="character-actions"><button type="button" onClick={saveNew}>Create character</button><button type="button" onClick={() => { setCreating(false); setError(''); }}>Cancel</button></div></div>}
      {selected && <><div className="panel character-details"><div className="character-details-head"><div><p className="sidebar-label">CHARACTER</p><h2>{selected.name}</h2></div><button type="button" className="danger" onClick={removeCharacter}>Delete character</button></div><div className="character-details-body"><div className="character-reference">{imageOf(selected) && <img src={imageOf(selected)} alt={`${selected.name} reference`} />}</div><div><label>Name<input aria-label="Character name" value={selected.name} onChange={event => { const value = event.target.value; if (value.trim()) update(selected.id, character => { character.name = value; }); }} /></label><div className="character-file-choice"><span title={references.find(asset => asset.id === selected.referenceAssetId)?.path}>{references.find(asset => asset.id === selected.referenceAssetId)?.path}</span><button type="button" onClick={pickReference}>Choose reference…</button></div><p className="subtle">Set each animation’s displayed height to align the character across previews.</p></div></div></div>
      <div className="character-section-title"><h2>Required animations</h2><span>{required.filter(key => selected.animations.some(animation => animation.key === key)).length} / {required.length} loaded</span></div><div className="character-slot-grid">{required.map(key => slot(key, 'required'))}</div>
      <div className="character-section-title"><h2>Optional animations</h2></div><div className="character-slot-grid">{optional.map(key => slot(key, 'optional'))}</div>
      <div className="character-section-title"><h2>Custom animations</h2></div><div className="character-slot-grid">{selected.animations.filter(animation => !fixed.has(animation.key)).map(animation => slot(animation.key, 'custom'))}</div><div className="panel character-custom"><label>Animation name<input aria-label="Custom animation name" placeholder="Punch, pick up, receive hit…" value={customName} onChange={event => setCustomName(event.target.value)} /></label><div className="character-file-choice"><span title={customPath}>{customPath || 'No file selected'}</span><button type="button" onClick={() => void pick('animation', (path, _id, addition) => { if (addition) editor.edit(next => addPickedFile(next, addition)); setCustomPath(path); })}>Choose file…</button></div><button type="button" onClick={addCustom}>Add custom animation</button></div></>}
      {!creating && !selected && <div className="panel character-empty"><div className="character-empty-copy"><p className="panel-kicker">CAST &amp; ANIMATION</p><h2>Bring your cast to life</h2><p className="subtle">Start with a reference image, then give your character idle, walk, and interaction animations.</p><button type="button" onClick={() => { setCreating(true); setSelectedId(null); setError(''); }}>Create a character</button></div><img src={`${import.meta.env.BASE_URL}art/mara-lighthouse-keeper-v2.png`} alt="" aria-hidden="true" /></div>}
      {error && <p role="alert">{error}</p>}
      {selected && !sprites.length && <p className="subtle">Import sprites or GIFs in Assets, or export a GIF from Animations, to populate these slots.</p>}
    </section>
  </div>;
}
