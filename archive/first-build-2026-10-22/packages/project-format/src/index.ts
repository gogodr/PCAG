import { z } from 'zod';
import { legacySchema } from './legacy';
import { isWalkable, type Rect } from './navigation';
import starter from '../../../examples/foundation/character.json';
export * from './navigation';

export const FORMAT_VERSION = 2;
export const MAX_PROJECT_BYTES = 24 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const id = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1, 'Enter a name.').max(200, 'Keep the name under 200 characters.');
const point = z.object({ x: z.number().finite().min(0), y: z.number().finite().min(0) }).strict();
const facing = z.enum(['left', 'right']);
const approach = point.extend({ facing }).strict();
const bounds = point.extend({ width: z.number().finite().positive('Give the shape a width greater than zero.'), height: z.number().finite().positive('Give the shape a height greater than zero.') });
const geometry = bounds.extend({ id, name: text }).strict();
const animation = z.object({ assetId: id, frameWidth: z.number().int().min(1).max(1024), frameHeight: z.number().int().min(1).max(1024), frames: z.array(z.number().int().min(0).max(255)).min(1).max(64), fps: z.number().min(1).max(30) }).strict();
const hotspot = bounds.extend({ id, name: text, inspection: z.string().trim().min(1, 'Write a response for viewing this object.').max(3000), approach: approach.nullable(), enabled: z.boolean() }).strict();
export const projectSchema = z.object({
  formatVersion: z.literal(FORMAT_VERSION), id, name: text, startRoomId: id,
  protagonist: z.object({ id: z.literal('player'), name: text, speed: z.number().min(30).max(600), height: z.number().min(20).max(250), feetX: z.number().min(0).max(1), feetY: z.number().min(0).max(1), animations: z.object({ idle: animation, walk: animation, talk: animation }).strict() }).strict().nullable(),
  assets: z.array(z.object({ id, name: text, dataUrl: z.string().max(Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 100).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Use a PNG, JPEG, or WebP image.') }).strict()).max(50),
  rooms: z.array(z.object({
    id, name: text, width: z.number().int().min(320, 'Room width must be at least 320 pixels.').max(1920), height: z.number().int().min(180, 'Room height must be at least 180 pixels.').max(1080), backgroundAssetId: id.nullable(),
    layers: z.array(bounds.extend({ id, name: text, assetId: id, depth: z.enum(['behind', 'front']) }).strict()).max(30),
    navigation: z.object({ walkable: z.array(geometry).max(8), obstacles: z.array(geometry).max(8) }).strict(),
    entrances: z.array(approach.extend({ id, name: text }).strict()).min(1).max(12), defaultEntranceId: id,
    exits: z.array(bounds.extend({ id, name: text, approach, targetRoomId: id.nullable(), targetEntranceId: id.nullable() }).strict()).max(12), hotspots: z.array(hotspot).max(50),
  }).strict()).min(1).max(20),
}).strict();
export type Project = z.infer<typeof projectSchema>;
export type Room = Project['rooms'][number];
export type Hotspot = Room['hotspots'][number];
export type Exit = Room['exits'][number];
export type Animation = NonNullable<Project['protagonist']>['animations']['idle'];
export interface Diagnostic { code: string; path: string; message: string; entityId?: string }
export type ValidationResult = { ok: true; project: Project; diagnostics: [] } | { ok: false; diagnostics: Diagnostic[] };

export function upgradeProject(input: unknown): unknown {
  if (!input || typeof input !== 'object' || !('formatVersion' in input) || input.formatVersion !== 1) return input;
  const old = legacySchema.safeParse(input); if (!old.success) return input;
  return { ...old.data, formatVersion: 2, protagonist: null, rooms: old.data.rooms.map(r => ({ ...r, layers: [], navigation: { walkable: [], obstacles: [] }, entrances: [{ id: `entry_${r.id}`, name: 'Entrance', x: r.width / 2, y: r.height * .85, facing: 'right' }], defaultEntranceId: `entry_${r.id}`, exits: [], hotspots: r.hotspots.map(h => ({ ...h, approach: null, enabled: true })) })) };
}
export function validateProject(input: unknown): ValidationResult {
  const value = upgradeProject(input);
  if (value && typeof value === 'object' && 'formatVersion' in value && value.formatVersion !== FORMAT_VERSION) return { ok: false, diagnostics: [{ code: 'unsupported-version', path: 'formatVersion', message: 'This project version is not supported. Open it with the creator version that saved it.' }] };
  const parsed = projectSchema.safeParse(value);
  if (!parsed.success) return { ok: false, diagnostics: parsed.error.issues.map(issue => ({ code: 'invalid-value', path: issue.path.join('.'), message: issue.message })) };
  const project = parsed.data, diagnostics: Diagnostic[] = [], ids = new Set<string>();
  const add = (code: string, path: string, message: string, entityId?: string) => diagnostics.push({ code, path, message, entityId });
  const checkId = (value: string, path: string) => { if (ids.has(value)) add('duplicate-id', path, 'Two objects share an identity. Duplicate objects using the creator instead.', value); ids.add(value); };
  checkId(project.id, 'id'); project.assets.forEach((a, i) => checkId(a.id, `assets.${i}.id`));
  if (project.protagonist) {
    checkId(project.protagonist.id, 'protagonist.id');
    for (const mode of ['idle', 'walk', 'talk'] as const) if (!project.assets.some(a => a.id === project.protagonist!.animations[mode].assetId)) add('missing-asset', `protagonist.animations.${mode}.assetId`, `Choose an available sprite sheet for the ${mode} animation.`, 'player');
  }
  project.rooms.forEach((room, ri) => {
    const prefix = `rooms.${ri}`; checkId(room.id, `${prefix}.id`);
    const checkBounds = (r: Rect, path: string, name: string, entityId: string) => { if (r.x + r.width > room.width || r.y + r.height > room.height) add('out-of-bounds', `${path}.x`, `Keep ${name} inside the room. Adjust its position or size.`, entityId); };
    if (room.backgroundAssetId && !project.assets.some(a => a.id === room.backgroundAssetId)) add('missing-asset', `${prefix}.backgroundAssetId`, `Choose an available background for ${room.name}.`, room.id);
    room.layers.forEach((layer, i) => { checkId(layer.id, `${prefix}.layers.${i}.id`); checkBounds(layer, `${prefix}.layers.${i}`, layer.name, layer.id); if (!project.assets.some(a => a.id === layer.assetId)) add('missing-asset', `${prefix}.layers.${i}.assetId`, `Choose artwork for ${layer.name}.`, layer.id); });
    for (const kind of ['walkable', 'obstacles'] as const) room.navigation[kind].forEach((r, i) => { checkId(r.id, `${prefix}.navigation.${kind}.${i}.id`); checkBounds(r, `${prefix}.navigation.${kind}.${i}`, r.name, r.id); });
    room.entrances.forEach((entry, i) => { checkId(entry.id, `${prefix}.entrances.${i}.id`); if (entry.x > room.width || entry.y > room.height) add('invalid-entry', `${prefix}.entrances.${i}.x`, `Place ${entry.name} inside the room.`, entry.id); });
    if (!room.entrances.some(e => e.id === room.defaultEntranceId)) add('missing-entry', `${prefix}.defaultEntranceId`, 'Choose an existing starting entrance.', room.id);
    room.hotspots.forEach((h, i) => { checkId(h.id, `${prefix}.hotspots.${i}.id`); checkBounds(h, `${prefix}.hotspots.${i}`, h.name, h.id); });
    room.exits.forEach((exit, i) => {
      const path = `${prefix}.exits.${i}`; checkId(exit.id, `${path}.id`); checkBounds(exit, path, exit.name, exit.id);
      const target = project.rooms.find(r => r.id === exit.targetRoomId);
      if (exit.targetRoomId && !target) add('missing-room', `${path}.targetRoomId`, `Reconnect ${exit.name} to an existing room.`, exit.id);
      if (exit.targetEntranceId && !target?.entrances.some(e => e.id === exit.targetEntranceId)) add('missing-entry', `${path}.targetEntranceId`, `Choose an existing destination entrance for ${exit.name}.`, exit.id);
    });
  });
  if (!project.rooms.some(r => r.id === project.startRoomId)) add('missing-room', 'startRoomId', 'Choose an existing starting room.');
  if (new TextEncoder().encode(JSON.stringify(project)).length > MAX_PROJECT_BYTES) add('too-large', 'assets', 'This project exceeds 24 MB. Use smaller images.');
  return diagnostics.length ? { ok: false, diagnostics } : { ok: true, project, diagnostics: [] };
}
export function validatePlayableProject(input: unknown): ValidationResult {
  const base = validateProject(input); if (!base.ok) return base;
  const p = base.project, diagnostics: Diagnostic[] = [];
  const add = (path: string, message: string, entityId?: string) => diagnostics.push({ code: 'play-setup', path, message, entityId });
  if (!p.protagonist) add('protagonist', 'Set up a playable character before playtesting. Your imported project remains editable.', 'player');
  p.rooms.forEach((r, ri) => {
    if (!r.navigation.walkable.length) add(`rooms.${ri}.navigation`, `Draw walkable ground in ${r.name} before playtesting.`, r.id);
    r.entrances.forEach((e, i) => { if (!isWalkable(r.navigation, e)) add(`rooms.${ri}.entrances.${i}.x`, `Place entrance ${e.name} on walkable ground in ${r.name}.`, e.id); });
    r.hotspots.forEach((h, i) => { if (h.approach && !isWalkable(r.navigation, h.approach)) add(`rooms.${ri}.hotspots.${i}.approach.x`, `Place the approach point for ${h.name} on walkable ground.`, h.id); });
    r.exits.forEach((e, i) => {
      if (!e.targetRoomId || !e.targetEntranceId) add(`rooms.${ri}.exits.${i}.targetRoomId`, `Connect exit ${e.name} to a room and entrance.`, e.id);
      if (!isWalkable(r.navigation, e.approach)) add(`rooms.${ri}.exits.${i}.approach.x`, `Place the approach point for exit ${e.name} on walkable ground.`, e.id);
    });
  });
  return diagnostics.length ? { ok: false, diagnostics } : base;
}
export function requireProject(input: unknown): Project { const r = validateProject(input); if (!r.ok) throw new Error(r.diagnostics.map(d => d.message).join('\n')); return r.project; }
export function requirePlayableProject(input: unknown): Project { const r = validatePlayableProject(input); if (!r.ok) throw new Error(r.diagnostics.map(d => d.message).join('\n')); return r.project; }
export function createRoom(name = 'New room'): Room {
  const roomId = `room_${crypto.randomUUID()}`, entry = `entry_${crypto.randomUUID()}`;
  return { id: roomId, name, width: 960, height: 540, backgroundAssetId: null, layers: [], navigation: { walkable: [{ id: `ground_${crypto.randomUUID()}`, name: 'Floor', x: 0, y: 370, width: 960, height: 170 }], obstacles: [] }, entrances: [{ id: entry, name: 'Entrance', x: 160, y: 460, facing: 'right' }], defaultEntranceId: entry, exits: [], hotspots: [] };
}
export function addStarterCharacter(project: Project) {
  const assetId = `character_${crypto.randomUUID()}`;
  project.assets.push({ id: assetId, name: 'Starter explorer sprite sheet', dataUrl: starter.dataUrl });
  const mapping = (frames: number[], fps: number) => ({ assetId, frameWidth: 48, frameHeight: 80, frames, fps });
  project.protagonist = { id: 'player', name: 'Alex', speed: 180, height: 100, feetX: .5, feetY: 1, animations: { idle: mapping([0], 1), walk: mapping([1, 2, 3, 4], 8), talk: mapping([5, 6, 7], 6) } };
}
export function createProject(): Project {
  const room = createRoom('First room');
  const project: Project = { formatVersion: FORMAT_VERSION, id: `project_${crypto.randomUUID()}`, name: 'Untitled adventure', startRoomId: room.id, assets: [], protagonist: null, rooms: [room] };
  addStarterCharacter(project); return project;
}
