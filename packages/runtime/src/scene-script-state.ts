import type { Element, Room, StateValue } from '../../project-format/src/index';
import { animationAtlasFromDataUrl } from '../../animation-atlas/src/index';
import { polygonBounds } from '../../project-format/src/element-geometry';

type Values = Record<string, StateValue>;
export interface SceneElementContext {
  disabled: boolean;
  visible: boolean;
  source: { type: 'IMAGE' | 'ANIMATION' | 'BOX' | 'SHAPE'; uri: string };
  position: { x: number; y: number };
  scale: { width: number; height: number };
  playback: { run: 'LOOP' | 'ONCE'; reverse: boolean };
}
export interface SceneContext { state: Values; elements: Record<string, SceneElementContext> }
export interface GameContext { state: Values }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function sceneContext(room: Room, sceneState: Values): SceneContext {
  const elements: Record<string, SceneElementContext> = Object.create(null);
  const names = new Map<string, number>();
  for (const element of room.elements) names.set(element.element_id, (names.get(element.element_id) ?? 0) + 1);
  for (const element of room.elements) {
    const contextElement: SceneElementContext = {
      disabled: element.enabled === false, visible: element.visible !== false,
      source: { type: element.type === 'image' || element.type === 'overlay' ? element.media?.kind === 'animation' ? 'ANIMATION' : 'IMAGE' : element.type === 'shape' ? 'SHAPE' : 'BOX', uri: element.media?.path ?? '' },
      position: { x: element.bounds.x, y: element.bounds.y },
      scale: { width: element.bounds.width, height: element.bounds.height },
      playback: { run: element.media?.loop === false ? 'ONCE' : 'LOOP', reverse: element.media?.reverse === true },
    };
    elements[element.game_id] = contextElement;
  }
  for (const element of room.elements) {
    if (names.get(element.element_id) === 1 && !Object.hasOwn(elements, element.element_id)) elements[element.element_id] = elements[element.game_id]!;
  }
  return { state: { ...sceneState }, elements };
}

function applyValues(current: Values, proposed: unknown, scope: string): Values {
  if (!record(proposed)) throw new Error(`${scope}.state must remain a map of variables.`);
  const result = { ...current };
  for (const [name, value] of Object.entries(current)) {
    if (!Object.hasOwn(proposed, name)) continue;
    const next = proposed[name];
    if (typeof next !== typeof value || typeof next === 'number' && !Number.isFinite(next)) throw new Error(`${scope}.state.${name} must keep its declared type.`);
    result[name] = next as StateValue;
  }
  return result;
}

function applyElement(element: Element, value: unknown, room: Room, urls: ReadonlyMap<string, string>): void {
  if (!record(value) || !record(value.source) || !record(value.position) || !record(value.scale) || !record(value.playback)) throw new Error(`Element ${element.name ?? element.element_id} has invalid script values.`);
  const { disabled, visible, source, position, scale, playback } = value;
  const x = position.x, y = position.y, width = scale.width, height = scale.height;
  if (typeof disabled !== 'boolean' || typeof visible !== 'boolean' || typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number'
    || ![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0
    || x + width > room.width || y + height > room.height) throw new Error(`Element ${element.name ?? element.element_id} must stay inside the scene.`);
  if (playback.run !== 'LOOP' && playback.run !== 'ONCE' || typeof playback.reverse !== 'boolean') throw new Error(`Element ${element.name ?? element.element_id} has invalid playback settings.`);
  if (element.type === 'overlay' && (x !== 0 || y !== 0 || width !== room.width || height !== room.height || source.type !== 'IMAGE' || source.uri !== element.media?.path)) throw new Error(`Overlay ${element.name ?? element.element_id} must stay aligned with the background and keep its image source.`);
  if (element.type === 'image' || element.type === 'overlay') {
    if (source.type !== 'IMAGE' && source.type !== 'ANIMATION' || typeof source.uri !== 'string') throw new Error(`Element ${element.name ?? element.element_id} needs an image or animation source.`);
    if (source.uri) {
      const url = urls.get(source.uri);
      if (!url || source.type === 'IMAGE' && !url.startsWith('data:image/') || source.type === 'ANIMATION' && (!source.uri.toLowerCase().endsWith('.json') || !animationAtlasFromDataUrl(url))) throw new Error(`Source ${source.uri} is unavailable or has the wrong type.`);
      if (source.type === 'ANIMATION') {
        const atlas = animationAtlasFromDataUrl(url)!;
        if (!urls.has(`${source.uri.slice(0, source.uri.lastIndexOf('/'))}/${atlas.image}`)) throw new Error(`The atlas image for ${source.uri} is missing.`);
      }
    }
    const media = element.media ?? { path: '', kind: 'image', width, height, preserveAspectRatio: false, loop: true, reverse: false };
    media.path = source.uri;
    media.kind = source.type === 'ANIMATION' ? 'animation' : 'image';
    media.loop = playback.run === 'LOOP';
    media.reverse = playback.reverse;
    element.media = media;
  } else if (source.type !== (element.type === 'shape' ? 'SHAPE' : 'BOX') || source.uri !== '') throw new Error(`Element ${element.name ?? element.element_id} does not have a media source.`);
  if (element.type === 'shape' && element.vertices && (element.bounds.x !== x || element.bounds.y !== y || element.bounds.width !== width || element.bounds.height !== height)) {
    const original = element.bounds;
    element.vertices = element.vertices.map(point => ({ x: x + (point.x - original.x) * width / original.width, y: y + (point.y - original.y) * height / original.height }));
    element.bounds = polygonBounds(element.vertices);
  } else if (element.type !== 'shape') element.bounds = { x, y, width, height };
  if (disabled !== (element.enabled === false)) element.enabled = !disabled;
  if (visible !== (element.visible !== false)) element.visible = visible;
}

export function applyScriptResult(room: Room, sceneState: Values, gameState: Values, scene: unknown, game: unknown, urls: ReadonlyMap<string, string>) {
  if (!record(scene) || !record(game) || !record(scene.elements)) throw new Error('The script context is invalid.');
  const nextRoom = structuredClone(room);
  const nextSceneState = applyValues(sceneState, scene.state, 'scene');
  const nextGameState = applyValues(gameState, game.state, 'game');
  for (const element of nextRoom.elements) applyElement(element, scene.elements[element.game_id], nextRoom, urls);
  return { room: nextRoom, sceneState: nextSceneState, gameState: nextGameState, elementsChanged: JSON.stringify(room.elements) !== JSON.stringify(nextRoom.elements) };
}
