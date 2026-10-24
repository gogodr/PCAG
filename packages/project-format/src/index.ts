/** Authored data only. No editor workspace or live session state belongs here. */
export interface ImageAsset { id: string; name: string; kind: 'image'; path: string }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface Hotspot { id: string; name: string; bounds: Bounds; inspect: string }
export interface Room { id: string; name: string; width: number; height: number; backgroundAssetId: string; hotspots: Hotspot[] }
export interface Project { schemaVersion: 1; id: string; name: string; startRoomId: string; assets: ImageAsset[]; rooms: Room[] }
export type EntityKind = 'project' | 'asset' | 'room' | 'hotspot';
export interface Diagnostic {
  severity: 'error';
  code: 'invalid_json' | 'unsupported_version' | 'invalid_type' | 'unknown_field' | 'invalid_value' | 'duplicate_id' | 'missing_reference' | 'out_of_bounds';
  path: string;
  target: { kind: EntityKind; id: string | null; roomId: string | null; field: string };
  message: string;
}
export type ValidationResult = { ok: true; project: Project; diagnostics: [] } | { ok: false; diagnostics: Diagnostic[] };

type RecordValue = Record<string, unknown>;
type Context = Omit<Diagnostic['target'], 'field'>;
const projectContext: Context = { kind: 'project', id: null, roomId: null };
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const isRecord = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const pointer = (part: string) => part.replaceAll('~', '~0').replaceAll('/', '~1');

/** Allocate once when creating an entity; renaming/reordering must retain its ID. */
export function createId(): string { return `id_${globalThis.crypto.randomUUID()}`; }

export function parseProject(json: string): ValidationResult {
  let input: unknown;
  try { input = JSON.parse(json); }
  catch {
    return { ok: false, diagnostics: [{ severity: 'error', code: 'invalid_json', path: '', target: { ...projectContext, field: '' }, message: 'This file is not valid project JSON. Choose an intact project file.' }] };
  }
  return validateProject(input);
}

/** Structural checks precede reference checks; failure never returns a partial project. */
export function validateProject(input: unknown): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const issue = (code: Diagnostic['code'], path: string, context: Context, field: string, message: string) => {
    diagnostics.push({ severity: 'error', code, path, target: { ...context, field }, message });
  };
  const context = (kind: EntityKind, value: RecordValue, roomId: string | null = null): Context => ({ kind, id: typeof value.id === 'string' ? value.id : null, roomId });
  const object = (value: unknown, path: string, ctx: Context, field: string, keys: string[]): value is RecordValue => {
    if (!isRecord(value)) { issue('invalid_type', path, ctx, field, 'Expected a record of named fields.'); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) issue('unknown_field', `${path}/${pointer(key)}`, ctx, field ? `${field}.${key}` : key, `The field "${key}" is not supported by project version 1.`);
    return true;
  };
  const text = (value: unknown, path: string, ctx: Context, field: string, empty = false) => {
    if (typeof value !== 'string') issue('invalid_type', path, ctx, field, `${field} must be text.`);
    else if (!empty && !value.trim()) issue('invalid_value', path, ctx, field, `${field} cannot be empty.`);
  };
  const id = (value: unknown, path: string, ctx: Context, field: string) => {
    if (typeof value !== 'string' || !idPattern.test(value)) issue('invalid_value', path, ctx, field, `${field} must start with a letter and contain 1–64 letters, numbers, underscores, or hyphens.`);
  };
  const number = (value: unknown, path: string, ctx: Context, field: string, positive: boolean) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) issue('invalid_type', path, ctx, field, `${field} must be a finite number.`);
    else if (positive ? value <= 0 : value < 0) issue('invalid_value', path, ctx, field, `${field} must be ${positive ? 'greater than zero' : 'zero or greater'}.`);
  };
  const list = (value: unknown, path: string, ctx: Context, field: string): value is unknown[] => {
    if (!Array.isArray(value)) { issue('invalid_type', path, ctx, field, `${field} must be a list.`); return false; }
    for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) {
      issue('invalid_type', `${path}/${index}`, ctx, field, `${field} cannot contain missing list entries.`);
      return false;
    }
    return true;
  };
  if (!isRecord(input)) {
    issue('invalid_type', '', projectContext, '', 'A project must be a record of named fields.');
    return { ok: false, diagnostics };
  }
  const root = context('project', input);
  if (input.schemaVersion !== 1) {
    issue('unsupported_version', '/schemaVersion', root, 'schemaVersion', 'This reader supports project version 1 only. Keep the original and use a compatible reader; no migration was applied.');
    return { ok: false, diagnostics };
  }
  object(input, '', root, '', ['schemaVersion', 'id', 'name', 'startRoomId', 'assets', 'rooms']);
  id(input.id, '/id', root, 'id');
  text(input.name, '/name', root, 'name');
  id(input.startRoomId, '/startRoomId', root, 'startRoomId');
  if (list(input.assets, '/assets', root, 'assets')) input.assets.forEach((asset, i) => {
    const path = `/assets/${i}`;
    const ctx = isRecord(asset) ? context('asset', asset) : root;
    if (!object(asset, path, ctx, '', ['id', 'name', 'kind', 'path'])) return;
    id(asset.id, `${path}/id`, ctx, 'id');
    text(asset.name, `${path}/name`, ctx, 'name');
    if (asset.kind !== 'image') issue('invalid_value', `${path}/kind`, ctx, 'kind', 'Only image asset declarations are supported in version 1.');
    text(asset.path, `${path}/path`, ctx, 'path');
    if (typeof asset.path === 'string' && (!/^[A-Za-z0-9_./() -]+\.(png|jpg|jpeg|webp|svg)$/i.test(asset.path) || asset.path.split('/').some(segment => !segment || segment === '.' || segment === '..'))) {
      issue('invalid_value', `${path}/path`, ctx, 'path', 'Use a relative image path with plain filename characters, no URL, traversal, or empty segments.');
    }
  });
  if (list(input.rooms, '/rooms', root, 'rooms')) {
    if (!input.rooms.length) issue('invalid_value', '/rooms', root, 'rooms', 'Add at least one room.');
    input.rooms.forEach((room, i) => {
      const path = `/rooms/${i}`;
      const ctx = isRecord(room) ? context('room', room) : root;
      if (!object(room, path, ctx, '', ['id', 'name', 'width', 'height', 'backgroundAssetId', 'hotspots'])) return;
      id(room.id, `${path}/id`, ctx, 'id');
      text(room.name, `${path}/name`, ctx, 'name');
      number(room.width, `${path}/width`, ctx, 'width', true);
      number(room.height, `${path}/height`, ctx, 'height', true);
      id(room.backgroundAssetId, `${path}/backgroundAssetId`, ctx, 'backgroundAssetId');
      if (list(room.hotspots, `${path}/hotspots`, ctx, 'hotspots')) room.hotspots.forEach((hotspot, j) => {
        const hp = `${path}/hotspots/${j}`;
        const hc = isRecord(hotspot) ? context('hotspot', hotspot, ctx.id) : ctx;
        if (!object(hotspot, hp, hc, '', ['id', 'name', 'bounds', 'inspect'])) return;
        id(hotspot.id, `${hp}/id`, hc, 'id');
        text(hotspot.name, `${hp}/name`, hc, 'name');
        text(hotspot.inspect, `${hp}/inspect`, hc, 'inspect', true);
        if (object(hotspot.bounds, `${hp}/bounds`, hc, 'bounds', ['x', 'y', 'width', 'height'])) {
          for (const key of ['x', 'y', 'width', 'height']) number(hotspot.bounds[key], `${hp}/bounds/${key}`, hc, `bounds.${key}`, key === 'width' || key === 'height');
        }
      });
    });
  }
  if (diagnostics.length) return { ok: false, diagnostics };

  // Every field and nested record has passed the structural checks above.
  const project = input as unknown as Project;
  const ids = new Map<string, string>();
  const unique = (value: string, path: string, ctx: Context) => {
    const previous = ids.get(value);
    if (previous !== undefined) issue('duplicate_id', path, ctx, 'id', `ID "${value}" is already used at ${previous}. Give the new entity its own ID.`);
    else ids.set(value, path);
  };
  unique(project.id, '/id', root);
  project.assets.forEach((asset, i) => unique(asset.id, `/assets/${i}/id`, { kind: 'asset', id: asset.id, roomId: null }));
  const assets = new Set(project.assets.map(asset => asset.id));
  if (!project.rooms.some(room => room.id === project.startRoomId)) issue('missing_reference', '/startRoomId', root, 'startRoomId', 'The starting room no longer exists. Choose an existing room.');
  project.rooms.forEach((room, i) => {
    const path = `/rooms/${i}`;
    const rc: Context = { kind: 'room', id: room.id, roomId: null };
    unique(room.id, `${path}/id`, rc);
    if (!assets.has(room.backgroundAssetId)) issue('missing_reference', `${path}/backgroundAssetId`, rc, 'backgroundAssetId', `Background "${room.backgroundAssetId}" is missing. Choose an existing image for "${room.name}".`);
    room.hotspots.forEach((hotspot, j) => {
      const hp = `${path}/hotspots/${j}`;
      const hc: Context = { kind: 'hotspot', id: hotspot.id, roomId: room.id };
      unique(hotspot.id, `${hp}/id`, hc);
      const b = hotspot.bounds;
      if (b.x > room.width) issue('out_of_bounds', `${hp}/bounds/x`, hc, 'bounds.x', 'Move the hotspot inside the room width.');
      else if (b.width > room.width - b.x) issue('out_of_bounds', `${hp}/bounds/width`, hc, 'bounds.width', 'The hotspot extends past the right edge of the room.');
      if (b.y > room.height) issue('out_of_bounds', `${hp}/bounds/y`, hc, 'bounds.y', 'Move the hotspot inside the room height.');
      else if (b.height > room.height - b.y) issue('out_of_bounds', `${hp}/bounds/height`, hc, 'bounds.height', 'The hotspot extends past the bottom edge of the room.');
    });
  });
  if (diagnostics.length) return { ok: false, diagnostics };
  return { ok: true, project: JSON.parse(JSON.stringify(project)) as Project, diagnostics: [] };
}
