/** Authored data only. No editor workspace or live session state belongs here. */
export interface ImageAsset { id: string; name: string; kind: 'image'; path: string }
export interface Bounds { x: number; y: number; width: number; height: number }
export interface Point { x: number; y: number }
export interface ElementMedia { path: string; kind: 'image' | 'animation'; width: number; height: number; preserveAspectRatio: boolean; loop: boolean; reverse: boolean; scale?: number }
export const playerActions = ['view', 'move_to', 'talk_to', 'push', 'pull', 'open', 'close', 'give', 'use'] as const;
export type PlayerAction = typeof playerActions[number];
export interface Element { game_id: string; element_id: string; name?: string; type?: 'box' | 'shape' | 'image' | 'overlay'; enabled?: boolean; visible?: boolean; locked?: boolean; availableActions?: PlayerAction[]; bounds: Bounds; vertices?: Point[]; media?: ElementMedia }
export type SceneTrigger = { kind: 'game_load' | 'game_close' | 'scene_load' | 'scene_close' | 'character_position' }
  | { kind: 'player_action'; action: PlayerAction; targetId: string; itemId?: string }
  | { kind: 'scene_variable_change' | 'game_variable_change'; variableName: string };
export interface SceneEvent { id: string; name: string; triggers: SceneTrigger[]; script: string }
export interface SceneManager { events: SceneEvent[] }
export interface ScenePlayer { characterId: string; position: Point; anchor?: Point; scale: number; layer: number; locked?: boolean }
export interface WalkableArea { path: string; minScale: number; maxScale: number }
export type StateValue = boolean | number | string;
export interface StateVariable { value: StateValue; defaultValue: StateValue }
export type StateVariables = Record<string, StateVariable>;
export interface Room { id: string; name: string; width: number; height: number; backgroundAssetId: string; elements: Element[]; player?: ScenePlayer; walkableArea?: WalkableArea; sceneState: StateVariables; sceneManager?: SceneManager }
export interface CharacterAnimation { key: string; path: string; height: number; mirrorX: boolean }
export interface Character { id: string; name: string; referenceAssetId: string; animations: CharacterAnimation[] }
export interface Project { schemaVersion: 1; id: string; name: string; startRoomId: string; assets: ImageAsset[]; rooms: Room[]; gameState: StateVariables; characters?: Character[] }
export type EntityKind = 'project' | 'asset' | 'room' | 'element' | 'character' | 'event';
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
const variablePattern = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
export function validStateVariableName(name: string): boolean { return variablePattern.test(name); }
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
  // Read older v1 rooms without mutating their source records. New saves use `elements`.
  if (isRecord(input) && Array.isArray(input.rooms) && input.rooms.some(room => isRecord(room) && 'hotspots' in room && !('elements' in room))) {
    input = { ...input, rooms: input.rooms.map(room => {
      if (!isRecord(room) || !('hotspots' in room) || 'elements' in room) return room;
      const { hotspots, ...fields } = room;
      return { ...fields, elements: hotspots };
    }) };
  }
  // Older projects stored the stable UUID as `id` and the script key as `name`.
  if (isRecord(input) && Array.isArray(input.rooms)) input = { ...input, rooms: input.rooms.map(room => {
    if (!isRecord(room) || !Array.isArray(room.elements)) return room;
    return { ...room, elements: room.elements.map(element => {
      if (!isRecord(element) || !('id' in element) || 'game_id' in element) return element;
      const { id: oldId, name: oldName, ...fields } = element;
      return { ...fields, game_id: oldId, element_id: oldName, name: oldName };
    }) };
  }) };
  const diagnostics: Diagnostic[] = [];
  const issue = (code: Diagnostic['code'], path: string, context: Context, field: string, message: string) => {
    diagnostics.push({ severity: 'error', code, path, target: { ...context, field }, message });
  };
  const context = (kind: EntityKind, value: RecordValue, roomId: string | null = null): Context => {
    const valueId = kind === 'element' ? value.game_id : value.id;
    return { kind, id: typeof valueId === 'string' ? valueId : null, roomId };
  };
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
  const stateVariables = (value: unknown, path: string, ctx: Context, field: string) => {
    if (value === undefined) return; // Version 1 projects created before state authoring load as empty maps.
    if (!isRecord(value)) { issue('invalid_type', path, ctx, field, `${field} must be a map of named variables.`); return; }
    for (const [name, entry] of Object.entries(value)) {
      const variablePath = `${path}/${pointer(name)}`;
      if (!validStateVariableName(name)) issue('invalid_value', variablePath, ctx, `${field}.${name}`, 'Variable names must start with a letter and contain up to 64 letters, numbers, or underscores.');
      if (typeof entry === 'boolean' || typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry))) continue; // Older v1 variable value.
      if (!object(entry, variablePath, ctx, `${field}.${name}`, ['value', 'defaultValue'])) continue;
      const validValue = (item: unknown) => typeof item === 'boolean' || typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item));
      if (!validValue(entry.value)) issue('invalid_type', `${variablePath}/value`, ctx, `${field}.${name}.value`, 'Current value must be Boolean, finite Number, or Text.');
      if (!validValue(entry.defaultValue)) issue('invalid_type', `${variablePath}/defaultValue`, ctx, `${field}.${name}.defaultValue`, 'Default value must be Boolean, finite Number, or Text.');
      if (validValue(entry.value) && validValue(entry.defaultValue) && typeof entry.value !== typeof entry.defaultValue) issue('invalid_value', `${variablePath}/defaultValue`, ctx, `${field}.${name}.defaultValue`, 'Current and default values must have the same type.');
    }
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
  object(input, '', root, '', ['schemaVersion', 'id', 'name', 'startRoomId', 'assets', 'rooms', 'gameState', 'characters']);
  id(input.id, '/id', root, 'id');
  text(input.name, '/name', root, 'name');
  id(input.startRoomId, '/startRoomId', root, 'startRoomId');
  stateVariables(input.gameState, '/gameState', root, 'gameState');
  if (list(input.assets, '/assets', root, 'assets')) input.assets.forEach((asset, i) => {
    const path = `/assets/${i}`;
    const ctx = isRecord(asset) ? context('asset', asset) : root;
    if (!object(asset, path, ctx, '', ['id', 'name', 'kind', 'path'])) return;
    id(asset.id, `${path}/id`, ctx, 'id');
    text(asset.name, `${path}/name`, ctx, 'name');
    if (asset.kind !== 'image') issue('invalid_value', `${path}/kind`, ctx, 'kind', 'Only image asset declarations are supported in version 1.');
    text(asset.path, `${path}/path`, ctx, 'path');
    if (typeof asset.path === 'string' && (!/^[A-Za-z0-9_./() -]+\.(png|jpg|jpeg|webp|svg|gif)$/i.test(asset.path) || asset.path.split('/').some(segment => !segment || segment === '.' || segment === '..'))) {
      issue('invalid_value', `${path}/path`, ctx, 'path', 'Use a relative image path with plain filename characters, no URL, traversal, or empty segments.');
    }
  });
  if (list(input.rooms, '/rooms', root, 'rooms')) {
    if (!input.rooms.length) issue('invalid_value', '/rooms', root, 'rooms', 'Add at least one room.');
    input.rooms.forEach((room, i) => {
      const path = `/rooms/${i}`;
      const ctx = isRecord(room) ? context('room', room) : root;
      if (!object(room, path, ctx, '', ['id', 'name', 'width', 'height', 'backgroundAssetId', 'elements', 'player', 'walkableArea', 'sceneState', 'sceneManager'])) return;
      id(room.id, `${path}/id`, ctx, 'id');
      text(room.name, `${path}/name`, ctx, 'name');
      number(room.width, `${path}/width`, ctx, 'width', true);
      number(room.height, `${path}/height`, ctx, 'height', true);
      id(room.backgroundAssetId, `${path}/backgroundAssetId`, ctx, 'backgroundAssetId');
      stateVariables(room.sceneState, `${path}/sceneState`, ctx, 'sceneState');
      if (room.player !== undefined && object(room.player, `${path}/player`, ctx, 'player', ['characterId', 'position', 'anchor', 'scale', 'layer', 'locked'])) {
        text(room.player.characterId, `${path}/player/characterId`, ctx, 'player.characterId', true);
        if (object(room.player.position, `${path}/player/position`, ctx, 'player.position', ['x', 'y'])) {
          number(room.player.position.x, `${path}/player/position/x`, ctx, 'player.position.x', false);
          number(room.player.position.y, `${path}/player/position/y`, ctx, 'player.position.y', false);
        }
        if (room.player.anchor !== undefined && object(room.player.anchor, `${path}/player/anchor`, ctx, 'player.anchor', ['x', 'y'])) {
          number(room.player.anchor.x, `${path}/player/anchor/x`, ctx, 'player.anchor.x', false);
          number(room.player.anchor.y, `${path}/player/anchor/y`, ctx, 'player.anchor.y', false);
          if (typeof room.player.anchor.x === 'number' && room.player.anchor.x > 1) issue('invalid_value', `${path}/player/anchor/x`, ctx, 'player.anchor.x', 'Anchor X must be between 0 and 1.');
          if (typeof room.player.anchor.y === 'number' && room.player.anchor.y > 1) issue('invalid_value', `${path}/player/anchor/y`, ctx, 'player.anchor.y', 'Anchor Y must be between 0 and 1.');
        }
        number(room.player.scale, `${path}/player/scale`, ctx, 'player.scale', true);
        number(room.player.layer, `${path}/player/layer`, ctx, 'player.layer', false);
        if (typeof room.player.layer === 'number' && (!Number.isInteger(room.player.layer) || Array.isArray(room.elements) && room.player.layer > room.elements.length)) issue('invalid_value', `${path}/player/layer`, ctx, 'player.layer', 'Place Player between scene elements.');
        if (room.player.locked !== undefined && typeof room.player.locked !== 'boolean') issue('invalid_type', `${path}/player/locked`, ctx, 'player.locked', 'locked must be true or false.');
      }
      if (room.walkableArea !== undefined && object(room.walkableArea, `${path}/walkableArea`, ctx, 'walkableArea', ['path', 'minScale', 'maxScale'])) {
        text(room.walkableArea.path, `${path}/walkableArea/path`, ctx, 'walkableArea.path', true);
        number(room.walkableArea.minScale, `${path}/walkableArea/minScale`, ctx, 'walkableArea.minScale', true);
        number(room.walkableArea.maxScale, `${path}/walkableArea/maxScale`, ctx, 'walkableArea.maxScale', true);
        if (typeof room.walkableArea.minScale === 'number' && typeof room.walkableArea.maxScale === 'number' && room.walkableArea.minScale > room.walkableArea.maxScale) issue('invalid_value', `${path}/walkableArea/maxScale`, ctx, 'walkableArea.maxScale', 'Max scale must be at least min scale.');
      }
      if (list(room.elements, `${path}/elements`, ctx, 'elements')) room.elements.forEach((element, j) => {
        const hp = `${path}/elements/${j}`;
        const hc = isRecord(element) ? context('element', element, ctx.id) : ctx;
        if (!object(element, hp, hc, '', ['game_id', 'element_id', 'name', 'type', 'enabled', 'visible', 'locked', 'availableActions', 'bounds', 'inspect', 'vertices', 'media'])) return;
        id(element.game_id, `${hp}/game_id`, hc, 'game_id');
        text(element.element_id, `${hp}/element_id`, hc, 'element_id');
        if (element.type !== 'overlay' || element.name !== undefined) text(element.name, `${hp}/name`, hc, 'name');
        for (const flag of ['enabled', 'visible', 'locked'] as const) if (element[flag] !== undefined && typeof element[flag] !== 'boolean') issue('invalid_type', `${hp}/${flag}`, hc, flag, `${flag} must be true or false.`);
        if (element.availableActions !== undefined && list(element.availableActions, `${hp}/availableActions`, hc, 'availableActions')) {
          const seen = new Set<string>();
          element.availableActions.forEach((action, index) => {
            if (!playerActions.includes(action as PlayerAction)) issue('invalid_value', `${hp}/availableActions/${index}`, hc, 'availableActions', 'Choose a supported player action.');
            else if (seen.has(action as string)) issue('invalid_value', `${hp}/availableActions/${index}`, hc, 'availableActions', 'Each action can appear only once.');
            seen.add(action as string);
          });
        }
        if (element.inspect !== undefined) text(element.inspect, `${hp}/inspect`, hc, 'inspect', true); // Legacy v1 field.
        const kind = element.type ?? 'box';
        if (!['box', 'shape', 'image', 'overlay'].includes(kind as string)) issue('invalid_value', `${hp}/type`, hc, 'type', 'Choose Box, Shape, Image, or Overlay.');
        if (object(element.bounds, `${hp}/bounds`, hc, 'bounds', ['x', 'y', 'width', 'height'])) {
          for (const key of ['x', 'y', 'width', 'height']) number(element.bounds[key], `${hp}/bounds/${key}`, hc, `bounds.${key}`, key === 'width' || key === 'height');
          if (kind === 'overlay' && (element.bounds.x !== 0 || element.bounds.y !== 0 || element.bounds.width !== room.width || element.bounds.height !== room.height)) issue('invalid_value', `${hp}/bounds`, hc, 'bounds', 'Overlay bounds must match the scene background.');
        }
        if (kind === 'overlay' && element.availableActions !== undefined && Array.isArray(element.availableActions) && element.availableActions.length) issue('invalid_value', `${hp}/availableActions`, hc, 'availableActions', 'Overlays cannot have player actions.');
        if (kind === 'shape') {
          if (list(element.vertices, `${hp}/vertices`, hc, 'vertices')) {
            if (element.vertices.length < 3) issue('invalid_value', `${hp}/vertices`, hc, 'vertices', 'A shape needs at least three vertices.');
            element.vertices.forEach((vertex, k) => {
              const vp = `${hp}/vertices/${k}`;
              if (object(vertex, vp, hc, 'vertices', ['x', 'y'])) {
                number(vertex.x, `${vp}/x`, hc, `vertices.${k}.x`, false);
                number(vertex.y, `${vp}/y`, hc, `vertices.${k}.y`, false);
              }
            });
          }
        } else if (element.vertices !== undefined) issue('invalid_value', `${hp}/vertices`, hc, 'vertices', 'Only Shape elements have vertices.');
        if (kind === 'image' || kind === 'overlay') {
          const mp = `${hp}/media`;
          if (object(element.media, mp, hc, 'media', ['path', 'kind', 'width', 'height', 'scale', 'preserveAspectRatio', 'loop', 'reverse'])) {
            text(element.media.path, `${mp}/path`, hc, 'media.path', true);
            if (element.media.kind !== 'image' && element.media.kind !== 'animation') issue('invalid_value', `${mp}/kind`, hc, 'media.kind', 'Choose an image or animation.');
            if (kind === 'overlay' && element.media.kind !== 'image') issue('invalid_value', `${mp}/kind`, hc, 'media.kind', 'An Overlay needs an image source.');
            for (const key of ['width', 'height']) number(element.media[key], `${mp}/${key}`, hc, `media.${key}`, true);
            if (element.media.scale !== undefined) number(element.media.scale, `${mp}/scale`, hc, 'media.scale', true);
            if (element.media.preserveAspectRatio !== undefined && typeof element.media.preserveAspectRatio !== 'boolean') issue('invalid_type', `${mp}/preserveAspectRatio`, hc, 'media.preserveAspectRatio', 'Preserve aspect ratio must be true or false.');
            if (typeof element.media.loop !== 'boolean') issue('invalid_type', `${mp}/loop`, hc, 'media.loop', 'Loop must be true or false.');
            if (typeof element.media.reverse !== 'boolean') issue('invalid_type', `${mp}/reverse`, hc, 'media.reverse', 'Reverse must be true or false.');
          }
        } else if (element.media !== undefined) issue('invalid_value', `${hp}/media`, hc, 'media', 'Only Image and Overlay elements have media.');
      });
      if (room.sceneManager !== undefined && object(room.sceneManager, `${path}/sceneManager`, ctx, 'sceneManager', ['events'])
        && list(room.sceneManager.events, `${path}/sceneManager/events`, ctx, 'sceneManager.events')) room.sceneManager.events.forEach((event, j) => {
        const ep = `${path}/sceneManager/events/${j}`;
        const ec = isRecord(event) ? context('event', event, ctx.id) : ctx;
        if (!object(event, ep, ec, '', ['id', 'name', 'triggers', 'script'])) return;
        id(event.id, `${ep}/id`, ec, 'id');
        text(event.name, `${ep}/name`, ec, 'name');
        text(event.script, `${ep}/script`, ec, 'script', true);
        if (typeof event.script === 'string' && event.script.length > 100_000) issue('invalid_value', `${ep}/script`, ec, 'script', 'Event scripts must be 100,000 characters or fewer.');
        if (list(event.triggers, `${ep}/triggers`, ec, 'triggers')) {
          if (!event.triggers.length) issue('invalid_value', `${ep}/triggers`, ec, 'triggers', 'Add at least one trigger.');
          event.triggers.forEach((trigger, k) => {
            const tp = `${ep}/triggers/${k}`;
            if (!isRecord(trigger)) { issue('invalid_type', tp, ec, 'triggers', 'A trigger must be a record.'); return; }
            if (trigger.kind === 'player_action') {
              object(trigger, tp, ec, 'triggers', ['kind', 'action', 'targetId', 'itemId']);
              if (!playerActions.includes(trigger.action as PlayerAction)) issue('invalid_value', `${tp}/action`, ec, 'triggers.action', 'Choose a supported player action.');
              text(trigger.targetId, `${tp}/targetId`, ec, 'triggers.targetId', true);
              if (trigger.itemId !== undefined) text(trigger.itemId, `${tp}/itemId`, ec, 'triggers.itemId', true);
            } else if (trigger.kind === 'scene_variable_change' || trigger.kind === 'game_variable_change') {
              object(trigger, tp, ec, 'triggers', ['kind', 'variableName']);
              text(trigger.variableName, `${tp}/variableName`, ec, 'triggers.variableName');
              if (typeof trigger.variableName === 'string' && trigger.variableName && !validStateVariableName(trigger.variableName)) issue('invalid_value', `${tp}/variableName`, ec, 'triggers.variableName', 'Choose a valid state variable.');
            } else {
              object(trigger, tp, ec, 'triggers', ['kind']);
              if (!['game_load', 'game_close', 'scene_load', 'scene_close', 'character_position'].includes(trigger.kind as string)) issue('invalid_value', `${tp}/kind`, ec, 'triggers.kind', 'Choose a supported trigger.');
            }
          });
        }
      });
    });
  }
  if (input.characters !== undefined && list(input.characters, '/characters', root, 'characters')) input.characters.forEach((character, i) => {
    const path = `/characters/${i}`;
    const ctx = isRecord(character) ? context('character', character) : root;
    if (!object(character, path, ctx, '', ['id', 'name', 'referenceAssetId', 'animations'])) return;
    id(character.id, `${path}/id`, ctx, 'id');
    text(character.name, `${path}/name`, ctx, 'name');
    id(character.referenceAssetId, `${path}/referenceAssetId`, ctx, 'referenceAssetId');
    if (list(character.animations, `${path}/animations`, ctx, 'animations')) character.animations.forEach((animation, j) => {
      const slot = `${path}/animations/${j}`;
      if (!object(animation, slot, ctx, 'animations', ['key', 'path', 'height', 'mirrorX', 'width'])) return;
      text(animation.key, `${slot}/key`, ctx, 'animations.key');
      text(animation.path, `${slot}/path`, ctx, 'animations.path');
      const legacy = animation.height === undefined && animation.width !== undefined;
      const dimension = legacy ? 'width' : 'height';
      number(animation[dimension], `${slot}/${dimension}`, ctx, `animations.${dimension}`, true);
      if (typeof animation[dimension] === 'number' && animation[dimension] > 2048) issue('invalid_value', `${slot}/${dimension}`, ctx, `animations.${dimension}`, 'Sprite size must be 2048 pixels or less.');
      if (!legacy && typeof animation.mirrorX !== 'boolean') issue('invalid_type', `${slot}/mirrorX`, ctx, 'animations.mirrorX', 'Horizontal mirror must be true or false.');
    });
  });
  if (diagnostics.length) return { ok: false, diagnostics };

  // Every field and nested record has passed the structural checks above.
  const project = input as unknown as Project;
  const ids = new Map<string, string>();
  const unique = (value: string, path: string, ctx: Context) => {
    const previous = ids.get(value);
    if (previous !== undefined) issue('duplicate_id', path, ctx, ctx.kind === 'element' ? 'game_id' : 'id', `ID "${value}" is already used at ${previous}. Give the new entity its own ID.`);
    else ids.set(value, path);
  };
  unique(project.id, '/id', root);
  project.assets.forEach((asset, i) => unique(asset.id, `/assets/${i}/id`, { kind: 'asset', id: asset.id, roomId: null }));
  const assets = new Set(project.assets.map(asset => asset.id));
  project.characters?.forEach((character, i) => {
    const path = `/characters/${i}`;
    const ctx: Context = { kind: 'character', id: character.id, roomId: null };
    unique(character.id, `${path}/id`, ctx);
    if (!assets.has(character.referenceAssetId)) issue('missing_reference', `${path}/referenceAssetId`, ctx, 'referenceAssetId', 'Choose an existing image reference.');
    const keys = new Set<string>();
    character.animations.forEach((animation, j) => {
      const slot = `${path}/animations/${j}`;
      const key = animation.key.trim().toLowerCase();
      if (keys.has(key)) issue('duplicate_id', `${slot}/key`, ctx, 'animations.key', 'Animation names must be unique within a character.');
      keys.add(key);
      if (!/^(animation|images)\/[A-Za-z0-9_./() -]+\.(png|jpg|jpeg|webp|gif)$/i.test(animation.path) || animation.path.split('/').some(part => !part || part === '.' || part === '..')) issue('invalid_value', `${slot}/path`, ctx, 'animations.path', 'Choose a project sprite or GIF.');
    });
  });
  if (!project.rooms.some(room => room.id === project.startRoomId)) issue('missing_reference', '/startRoomId', root, 'startRoomId', 'The starting room no longer exists. Choose an existing room.');
  project.rooms.forEach((room, i) => {
    const path = `/rooms/${i}`;
    const rc: Context = { kind: 'room', id: room.id, roomId: null };
    unique(room.id, `${path}/id`, rc);
    if (room.player?.characterId && !project.characters?.some(character => character.id === room.player!.characterId)) issue('missing_reference', `${path}/player/characterId`, rc, 'player.characterId', 'Choose a character in this project.');
    if (room.player && (room.player.position.x > room.width || room.player.position.y > room.height)) issue('out_of_bounds', `${path}/player/position`, rc, 'player.position', 'Place Player inside the scene.');
    if (room.walkableArea?.path && (!/^images\/[A-Za-z0-9_./() -]+\.png$/i.test(room.walkableArea.path) || room.walkableArea.path.split('/').some(part => !part || part === '.' || part === '..'))) issue('invalid_value', `${path}/walkableArea/path`, rc, 'walkableArea.path', 'Choose a project PNG from images.');
    room.sceneManager?.events.forEach((event, j) => {
      const ep = `${path}/sceneManager/events/${j}`;
      const ec: Context = { kind: 'event', id: event.id, roomId: room.id };
      unique(event.id, `${ep}/id`, ec);
      event.triggers.forEach((trigger, k) => {
        if (trigger.kind === 'player_action' && trigger.targetId && !room.elements.some(element => element.game_id === trigger.targetId)) issue('missing_reference', `${ep}/triggers/${k}/targetId`, ec, 'triggers.targetId', 'Choose an element in this scene.');
        if (trigger.kind === 'scene_variable_change' && trigger.variableName && !Object.hasOwn(room.sceneState ?? {}, trigger.variableName)) issue('missing_reference', `${ep}/triggers/${k}/variableName`, ec, 'triggers.variableName', 'Choose a SceneState variable in this scene.');
        if (trigger.kind === 'game_variable_change' && trigger.variableName && !Object.hasOwn(project.gameState ?? {}, trigger.variableName)) issue('missing_reference', `${ep}/triggers/${k}/variableName`, ec, 'triggers.variableName', 'Choose a GameState variable.');
      });
    });
    if (!assets.has(room.backgroundAssetId)) issue('missing_reference', `${path}/backgroundAssetId`, rc, 'backgroundAssetId', `Background "${room.backgroundAssetId}" is missing. Choose an existing image for "${room.name}".`);
    room.elements.forEach((element, j) => {
      const hp = `${path}/elements/${j}`;
      const hc: Context = { kind: 'element', id: element.game_id, roomId: room.id };
      unique(element.game_id, `${hp}/game_id`, hc);
      const b = element.bounds;
      if (b.x > room.width) issue('out_of_bounds', `${hp}/bounds/x`, hc, 'bounds.x', 'Move the element inside the room width.');
      else if (b.width > room.width - b.x) issue('out_of_bounds', `${hp}/bounds/width`, hc, 'bounds.width', 'The element extends past the right edge of the room.');
      if (b.y > room.height) issue('out_of_bounds', `${hp}/bounds/y`, hc, 'bounds.y', 'Move the element inside the room height.');
      else if (b.height > room.height - b.y) issue('out_of_bounds', `${hp}/bounds/height`, hc, 'bounds.height', 'The element extends past the bottom edge of the room.');
      if (element.type === 'shape') element.vertices?.forEach((vertex, k) => {
        if (vertex.x > room.width) issue('out_of_bounds', `${hp}/vertices/${k}/x`, hc, `vertices.${k}.x`, 'Move the vertex inside the room width.');
        if (vertex.y > room.height) issue('out_of_bounds', `${hp}/vertices/${k}/y`, hc, `vertices.${k}.y`, 'Move the vertex inside the room height.');
      });
      if ((element.type === 'image' || element.type === 'overlay') && element.media) {
        const media = element.media;
        if (media.path && (!/^(images|backgrounds|animation)\/[A-Za-z0-9_./() -]+\.(png|jpg|jpeg|webp|svg|gif|json)$/i.test(media.path) || media.path.split('/').some(part => !part || part === '.' || part === '..') || (media.kind === 'animation' ? !/^animation\/.*\.json$/i.test(media.path) : /\.json$/i.test(media.path)))) issue('invalid_value', `${hp}/media/path`, hc, 'media.path', 'Choose a project image or animation atlas.');
      }
    });
  });
  if (diagnostics.length) return { ok: false, diagnostics };
  const copy = JSON.parse(JSON.stringify(project)) as Project;
  copy.gameState ??= {};
  copy.rooms.forEach(room => { room.sceneState ??= {}; room.sceneManager ??= { events: [] }; room.player ??= { characterId: '', position: { x: Math.round(room.width / 2), y: Math.round(room.height * 0.85) }, scale: 1, layer: room.elements.length }; room.walkableArea ??= { path: '', minScale: 0.5, maxScale: 1.5 }; });
  copy.rooms.forEach(room => room.elements.forEach(element => {
    element.type ??= 'box';
    element.availableActions ??= element.type === 'overlay' ? [] : ['view'];
    delete (element as Element & { inspect?: string }).inspect;
    if (element.media) { element.media.preserveAspectRatio ??= true; delete element.media.scale; }
  }));
  const normalizeState = (variables: StateVariables) => {
    for (const [name, variable] of Object.entries(variables) as [string, StateVariable | StateValue][]) {
      if (typeof variable !== 'object') variables[name] = { value: variable, defaultValue: variable };
    }
  };
  normalizeState(copy.gameState);
  copy.rooms.forEach(room => normalizeState(room.sceneState));
  copy.characters?.forEach(character => character.animations.forEach(animation => {
    const old = animation as CharacterAnimation & { width?: number };
    if (old.height === undefined && old.width !== undefined) old.height = old.width;
    delete old.width;
    old.mirrorX ??= false;
  }));
  return { ok: true, project: copy, diagnostics: [] };
}
