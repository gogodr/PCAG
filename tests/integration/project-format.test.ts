import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createId, parseProject, validateProject } from '../../packages/project-format/src/index.ts';
import { createInitialSessionState } from '../../packages/runtime/src/state.ts';
import { parseAnimationAtlas } from '../../packages/animation-atlas/src/index.ts';
import { initialEventScript, matchingEvents, positionTriggerWarning, stateChangeTriggers, withPositionTriggerWarning } from '../../packages/scene-events/src/index.ts';
import { createLatestEventQueue } from '../../packages/scene-events/src/latest-event-queue.ts';
import { walkableDestination, walkablePath, walkableScale } from '../../packages/runtime/src/player-navigation.ts';
import type { Diagnostic, Project } from '../../packages/project-format/src/index.ts';

const json = readFileSync(new URL('../../examples/reference-adventure/project.json', import.meta.url), 'utf8');
const sample = (): Project => {
  const parsed = parseProject(json);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const project = parsed.project;
  project.rooms[0]!.elements.push({ game_id: 'element_fixture', element_id: 'Fixture element', name: 'Fixture element', bounds: { x: 100, y: 100, width: 100, height: 100 } });
  return project;
};
function failure(value: unknown, code: Diagnostic['code'], path: string) {
  const before = JSON.stringify(value);
  const result = validateProject(value);
  assert.equal(result.ok, false);
  assert.ok(!('project' in result), 'invalid data must not expose a usable project');
  assert.equal(JSON.stringify(value), before, 'validation must not mutate input');
  const diagnostic = result.diagnostics.find(item => item.code === code && item.path === path);
  assert.ok(diagnostic, JSON.stringify(result));
  return diagnostic;
}

test('valid sample loads its start room and survives a JSON round trip', () => {
  const result = parseProject(json);
  assert.ok(result.ok);
  const room = result.project.rooms.find(item => item.id === result.project.startRoomId);
  assert.equal(room?.name, 'Test 1');
  assert.ok(result.project.assets.some(asset => asset.id === room?.backgroundAssetId));
  assert.deepEqual(parseProject(JSON.stringify(result.project)), result);
});

test('legacy element IDs and names migrate to game_id, element_id, and name', () => {
  const project = sample();
  const old = project.rooms[0]!.elements.at(-1)!;
  const { game_id, element_id, name: _name, ...rest } = old;
  const legacy = { ...rest, id: game_id, name: element_id };
  const input = structuredClone(project) as unknown as { rooms: { elements: unknown[] }[] };
  input.rooms[0]!.elements[input.rooms[0]!.elements.length - 1] = legacy;
  const result = validateProject(input);
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  const migrated = result.project.rooms[0]!.elements.at(-1)!;
  assert.deepEqual([migrated.game_id, migrated.element_id, migrated.name], [game_id, element_id, element_id]);
  assert.equal(Object.hasOwn(migrated, 'id'), false);
  assert.deepEqual(input.rooms[0]!.elements.at(-1), legacy);
});

test('Player anchor and editor lock round trip; invalid anchors are rejected', () => {
  const project = sample();
  project.rooms[0]!.player = { characterId: '', position: { x: 300, y: 400 }, anchor: { x: 0.25, y: 0.75 }, scale: 1, layer: 0, locked: true };
  const result = validateProject(project);
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.project.rooms[0]!.player?.anchor, { x: 0.25, y: 0.75 });
  assert.equal(result.project.rooms[0]!.player?.locked, true);
  assert.ok(parseProject(JSON.stringify(result.project)).ok);
  project.rooms[0]!.player!.anchor!.x = 1.1;
  failure(project, 'invalid_value', '/rooms/0/player/anchor/x');
});

test('Overlay fills its scene, uses image media, and cannot have player actions', () => {
  const project = sample();
  const room = project.rooms[0]!;
  room.elements.push({ game_id: 'overlay_fixture', element_id: 'Foreground', type: 'overlay', bounds: { x: 0, y: 0, width: room.width, height: room.height }, media: { path: 'images/foreground.png', kind: 'image', width: 1376, height: 768, preserveAspectRatio: true, loop: true, reverse: false } });
  const result = validateProject(project);
  assert.ok(result.ok, JSON.stringify(result.diagnostics));
  assert.deepEqual(result.project.rooms[0]!.elements.at(-1)!.availableActions, []);
  assert.equal(Object.hasOwn(result.project.rooms[0]!.elements.at(-1)!, 'name'), false);
  assert.ok(parseProject(JSON.stringify(result.project)).ok);
  const wrongBounds = structuredClone(project);
  wrongBounds.rooms[0]!.elements.at(-1)!.bounds.x = 1;
  failure(wrongBounds, 'invalid_value', `/rooms/0/elements/${room.elements.length - 1}/bounds`);
  const wrongMedia = structuredClone(project);
  wrongMedia.rooms[0]!.elements.at(-1)!.media!.kind = 'animation';
  failure(wrongMedia, 'invalid_value', `/rooms/0/elements/${room.elements.length - 1}/media/kind`);
  const actions = structuredClone(project);
  actions.rooms[0]!.elements.at(-1)!.availableActions = ['view'];
  failure(actions, 'invalid_value', `/rooms/0/elements/${room.elements.length - 1}/availableActions`);
});

test('older hotspot lists load as elements without changing the source', () => {
  const legacy = JSON.parse(json);
  legacy.rooms[0].hotspots = legacy.rooms[0].elements;
  delete legacy.rooms[0].elements;
  const before = JSON.stringify(legacy);
  const result = validateProject(legacy);
  assert.ok(result.ok);
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(result.project.rooms[0]!.elements.length, legacy.rooms[0].hotspots.length);
  assert.equal('hotspots' in result.project.rooms[0]!, false);
  assert.ok(parseProject(JSON.stringify(result.project)).ok);
});

test('element available actions normalize, round trip, and reject unsupported or duplicate actions', () => {
  const legacy = sample();
  const normalized = validateProject(legacy);
  assert.ok(normalized.ok);
  assert.deepEqual(normalized.project.rooms[0]!.elements.at(-1)!.availableActions, ['view']);
  assert.equal(legacy.rooms[0]!.elements.at(-1)!.availableActions, undefined);
  const project = sample();
  project.rooms[0]!.elements.at(-1)!.availableActions = ['view', 'open', 'use'];
  const parsed = validateProject(project);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.project.rooms[0]!.elements.at(-1)!.availableActions, ['view', 'open', 'use']);
  assert.deepEqual(parseProject(JSON.stringify(parsed.project)), parsed);
  const invalid = structuredClone(project);
  invalid.rooms[0]!.elements.at(-1)!.availableActions = ['view', 'view'];
  failure(invalid, 'invalid_value', `/rooms/0/elements/${invalid.rooms[0]!.elements.length - 1}/availableActions/1`);
  invalid.rooms[0]!.elements.at(-1)!.availableActions = ['view', 'dance' as 'view'];
  failure(invalid, 'invalid_value', `/rooms/0/elements/${invalid.rooms[0]!.elements.length - 1}/availableActions/1`);
});

test('Player and Walkable Area normalize, validate, and round trip per scene', () => {
  const old = sample();
  delete old.rooms[0]!.player;
  delete old.rooms[0]!.walkableArea;
  const normalized = validateProject(old);
  assert.ok(normalized.ok);
  assert.equal(normalized.project.rooms[0]!.player?.layer, old.rooms[0]!.elements.length);
  assert.deepEqual(normalized.project.rooms[0]!.walkableArea, { path: '', minScale: 0.5, maxScale: 1.5 });
  const project = sample();
  project.characters = [{ id: 'character_player', name: 'Player', referenceAssetId: project.assets[0]!.id, animations: [] }];
  project.rooms[0]!.player = { characterId: 'character_player', position: { x: 123, y: 456 }, scale: 1.2, layer: 0 };
  project.rooms[0]!.walkableArea = { path: 'images/walkable.png', minScale: 0.6, maxScale: 1.4 };
  const parsed = validateProject(project);
  assert.ok(parsed.ok);
  assert.deepEqual(parseProject(JSON.stringify(parsed.project)), parsed);
  const missing = structuredClone(project);
  missing.rooms[0]!.player!.characterId = 'missing';
  failure(missing, 'missing_reference', '/rooms/0/player/characterId');
  const badLayer = structuredClone(project);
  badLayer.rooms[0]!.player!.layer = 99;
  failure(badLayer, 'invalid_value', '/rooms/0/player/layer');
  const badScale = structuredClone(project);
  badScale.rooms[0]!.walkableArea!.minScale = 2;
  failure(badScale, 'invalid_value', '/rooms/0/walkableArea/maxScale');
});

test('Walkable Area alpha blocks movement and grayscale controls player scale', () => {
  const mask = { width: 4, height: 1, minScale: 0.5, maxScale: 1.5, data: new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 0, 0, 0, 0]) };
  assert.equal(walkableScale(mask, 0, 0), 1.5);
  assert.ok(Math.abs(walkableScale(mask, 1, 0)! - 1) < 0.01);
  assert.ok(Math.abs(walkableScale(mask, 2, 0)! - 0.5) < 0.001);
  assert.equal(walkableScale(mask, 3, 0), null);
  assert.equal(walkableScale({ ...mask, sceneWidth: 8 }, 7, 0), null);
  const destination = walkableDestination(mask, { x: 0, y: 0 }, { x: 3, y: 0 });
  assert.ok(destination && destination.x >= 2 && destination.x < 2.5);
  const data = new Uint8ClampedArray(5 * 5 * 4);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) data[(y * 5 + x) * 4 + 3] = x === 2 && y < 4 ? 0 : 255;
  const barrier = { width: 5, height: 5, minScale: 1, maxScale: 1, data };
  const route = walkablePath(barrier, { x: 0, y: 0 }, { x: 4, y: 0 });
  assert.ok(route.length > 1);
  assert.deepEqual(route.at(-1), { x: 4, y: 0 });
  let previous = { x: 0, y: 0 };
  for (const next of route) { assert.deepEqual(walkableDestination(barrier, previous, next), next); previous = next; }
});

test('SceneManager events round trip and validate player targets', () => {
  const legacy = parseProject(json);
  assert.ok(legacy.ok);
  assert.deepEqual(legacy.project.rooms[0]!.sceneManager, { events: [] });
  const project = sample();
  const targetId = project.rooms[0]!.elements.at(-1)!.game_id;
  project.rooms[0]!.sceneManager = { events: [{
    id: 'event_fixture', name: 'Open door',
    triggers: [{ kind: 'scene_load' }, { kind: 'player_action', action: 'use', targetId, itemId: 'inventory_key' }, { kind: 'character_position' }],
    script: 'function on_event_fixture(scene, game, trigger) { game.state.open = true; }',
  }] };
  const result = validateProject(project);
  assert.ok(result.ok);
  assert.deepEqual(result.project.rooms[0]!.sceneManager, project.rooms[0]!.sceneManager);
  assert.deepEqual(parseProject(JSON.stringify(result.project)), result);
  assert.deepEqual(matchingEvents(result.project.rooms[0]!.sceneManager!.events, { type: 'character_position', x: 12, y: 34, phase: 'move' }).map(event => event.id), ['event_fixture']);
  assert.match(initialEventScript('event_fixture'), /\nasync function on_event_fixture\(/);
  const warned = withPositionTriggerWarning('event_fixture', initialEventScript('event_fixture'));
  assert.ok(warned.includes(positionTriggerWarning));
  assert.equal(withPositionTriggerWarning('event_fixture', warned), warned);
  assert.doesNotThrow(() => new Function(withPositionTriggerWarning('event_fixture', 'function on_event_fixture(scene, game, trigger) { if (trigger.phase === "end") scene.state.open = true; }')));
  const invalid = structuredClone(project);
  (invalid.rooms[0]!.sceneManager!.events[0]!.triggers[1] as { targetId: string }).targetId = 'missing';
  failure(invalid, 'missing_reference', '/rooms/0/sceneManager/events/0/triggers/1/targetId');
});

test('each event retains only its latest pending signal while another event can run', async () => {
  const calls: string[] = [];
  let releaseFirst!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const eventQueue = createLatestEventQueue<string>(async (id, value) => {
    calls.push(`${id}:${value}`);
    if (id === 'a' && value === 'first') await first;
  }, (_id, error) => { throw error; });
  eventQueue.signal('a', 'first');
  eventQueue.signal('a', 'second');
  eventQueue.signal('a', 'latest');
  eventQueue.signal('b', 'independent');
  releaseFirst();
  await eventQueue.whenIdle();
  assert.deepEqual(calls, ['a:first', 'b:independent', 'a:latest']);
});

test('state-change triggers match their declared scope and carry old and new values', () => {
  const project = sample();
  project.rooms[0]!.sceneState = { doorOpen: { value: false, defaultValue: false } };
  project.gameState = { score: { value: 3, defaultValue: 3 } };
  project.rooms[0]!.sceneManager = { events: [
    { id: 'event_scene', name: 'Door changed', triggers: [{ kind: 'scene_variable_change', variableName: 'doorOpen' }], script: '' },
    { id: 'event_game', name: 'Score changed', triggers: [{ kind: 'game_variable_change', variableName: 'score' }], script: '' },
  ] };
  const parsed = validateProject(project);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.project.rooms[0]!.sceneManager, project.rooms[0]!.sceneManager);
  assert.deepEqual(parseProject(JSON.stringify(parsed.project)), parsed);
  const sceneChanges = stateChangeTriggers('scene', { doorOpen: false }, { doorOpen: true });
  const gameChanges = stateChangeTriggers('game', { score: 3 }, { score: 4 });
  assert.deepEqual(sceneChanges, [{ type: 'scene_variable_change', target: 'doorOpen', old_value: false, value: true }]);
  assert.deepEqual(gameChanges, [{ type: 'game_variable_change', target: 'score', old_value: 3, value: 4 }]);
  assert.deepEqual(stateChangeTriggers('game', { score: 3 }, { score: 3 }), []);
  assert.deepEqual(matchingEvents(project.rooms[0]!.sceneManager!.events, sceneChanges[0]!).map(event => event.id), ['event_scene']);
  assert.deepEqual(matchingEvents(project.rooms[0]!.sceneManager!.events, gameChanges[0]!).map(event => event.id), ['event_game']);
  const missing = structuredClone(project);
  delete missing.gameState.score;
  failure(missing, 'missing_reference', '/rooms/0/sceneManager/events/1/triggers/0/variableName');
  const unselected = structuredClone(project);
  (unselected.rooms[0]!.sceneManager!.events[0]!.triggers[0] as { variableName: string }).variableName = '';
  failure(unselected, 'invalid_value', '/rooms/0/sceneManager/events/0/triggers/0/variableName');
});

test('game and scene state maps retain typed values and older projects get empty maps', () => {
  const legacy = parseProject(json);
  assert.ok(legacy.ok);
  assert.deepEqual(legacy.project.gameState, {});
  assert.deepEqual(legacy.project.rooms.map(room => room.sceneState), legacy.project.rooms.map(() => ({})));
  const oldValues = JSON.parse(json);
  oldValues.gameState = { hasKey: true, attempts: 2, note: 'shared' };
  oldValues.rooms[0].sceneState = { doorOpen: false, score: 3.5, clue: 'moon' };
  const migrated = validateProject(oldValues);
  assert.ok(migrated.ok);
  assert.deepEqual(migrated.project.gameState.hasKey, { value: true, defaultValue: true });
  assert.deepEqual(migrated.project.rooms[0]!.sceneState.clue, { value: 'moon', defaultValue: 'moon' });
  const project = legacy.project;
  project.gameState = { hasKey: { value: false, defaultValue: true }, attempts: { value: 4, defaultValue: 2 }, note: { value: 'now', defaultValue: 'shared' } };
  project.rooms[0]!.sceneState = { doorOpen: { value: true, defaultValue: false }, score: { value: 9, defaultValue: 3.5 }, clue: { value: 'sun', defaultValue: 'moon' } };
  const result = validateProject(project);
  assert.ok(result.ok);
  assert.deepEqual(result.project.gameState, project.gameState);
  assert.deepEqual(result.project.rooms[0]!.sceneState, project.rooms[0]!.sceneState);
  assert.deepEqual(parseProject(JSON.stringify(result.project)), result);
  const initial = createInitialSessionState(result.project);
  assert.deepEqual(initial.gameState, { hasKey: true, attempts: 2, note: 'shared' });
  assert.deepEqual(initial.sceneStates[project.rooms[0]!.id], { doorOpen: false, score: 3.5, clue: 'moon' });
  assert.notEqual(initial.gameState.attempts, project.gameState.attempts!.value);
  failure({ ...project, gameState: { 'bad name': true } }, 'invalid_value', '/gameState/bad name');
  failure({ ...project, rooms: [{ ...project.rooms[0], sceneState: { broken: [] } }] }, 'invalid_type', '/rooms/0/sceneState/broken');
  failure({ ...project, gameState: { score: Infinity } }, 'invalid_type', '/gameState/score');
  failure({ ...project, gameState: { score: { value: 4, defaultValue: 'four' } } }, 'invalid_value', '/gameState/score/defaultValue');
  failure({ ...project, gameState: { score: { value: 4 } } }, 'invalid_type', '/gameState/score/defaultValue');
});

test('successful validation owns a copy, including nested element data', () => {
  const input = sample();
  const result = validateProject(input);
  assert.ok(result.ok);
  result.project.rooms[0]!.elements[0]!.bounds.x = 250;
  assert.notEqual(result.project.rooms[0]!.elements[0]!.bounds.x, input.rooms[0]!.elements[0]!.bounds.x);
});

test('older element View text is accepted but removed from authored data', () => {
  const input = sample() as Project & { rooms: Array<{ elements: Array<{ inspect?: string }> }> };
  input.rooms[0]!.elements[0]!.inspect = 'Legacy observation';
  const result = validateProject(input);
  assert.ok(result.ok);
  assert.equal('inspect' in result.project.rooms[0]!.elements[0]!, false);
  assert.equal(input.rooms[0]!.elements[0]!.inspect, 'Legacy observation');
});

test('element control flags round trip and reject invalid values', () => {
  const project = sample();
  const legacy = validateProject(project);
  assert.ok(legacy.ok);
  assert.equal(legacy.project.rooms[0]!.elements[0]!.enabled, undefined);
  Object.assign(project.rooms[0]!.elements[0]!, { enabled: false, visible: false, locked: true });
  const result = validateProject(project);
  assert.ok(result.ok);
  assert.equal(result.project.rooms[0]!.elements[0]!.enabled, false);
  assert.equal(result.project.rooms[0]!.elements[0]!.visible, false);
  assert.equal(result.project.rooms[0]!.elements[0]!.locked, true);
  for (const flag of ['enabled', 'visible', 'locked'] as const) {
    failure({ ...project, rooms: [{ ...project.rooms[0], elements: [{ ...project.rooms[0]!.elements[0], [flag]: 'yes' }] }] }, 'invalid_type', `/rooms/0/elements/0/${flag}`);
  }
});

test('characters retain references, named animation slots, display heights, and mirroring', () => {
  const project = sample();
  project.characters = [{ id: 'character_hero', name: 'Hero', referenceAssetId: project.assets[0]!.id, animations: [
    { key: 'idle', path: 'animation/hero_idle.gif', height: 160, mirrorX: false },
    { key: 'punch', path: 'images/hero_punch.png', height: 180, mirrorX: true },
  ] }];
  const result = validateProject(project);
  assert.ok(result.ok);
  assert.deepEqual(result.project.characters, project.characters);
  failure({ ...project, characters: [{ ...project.characters[0], referenceAssetId: 'image_missing' }] }, 'missing_reference', '/characters/0/referenceAssetId');
  failure({ ...project, characters: [{ ...project.characters[0], animations: [{ key: 'idle', path: 'animation/hero_idle.gif', height: 0, mirrorX: false }] }] }, 'invalid_value', '/characters/0/animations/0/height');
});

test('previous character sprite widths load as editable heights', () => {
  const project = sample();
  const legacy = { ...project, characters: [{ id: 'character_old', name: 'Old', referenceAssetId: project.assets[0]!.id, animations: [{ key: 'idle', path: 'animation/old.gif', width: 96 }] }] };
  const result = validateProject(legacy);
  assert.ok(result.ok);
  assert.deepEqual(result.project.characters?.[0]?.animations[0], { key: 'idle', path: 'animation/old.gif', height: 96, mirrorX: false });
});

test('sparse input lists cannot become null records after serialization', () => {
  const project = sample(); project.rooms.length = 3;
  failure(project, 'invalid_type', '/rooms/2');
});

test('reference diagnostics identify the affected entity and field', () => {
  const bad = JSON.parse(readFileSync(new URL('../fixtures/missing-background.json', import.meta.url), 'utf8')) as unknown;
  const diagnostic = failure(bad, 'missing_reference', '/rooms/0/backgroundAssetId');
  assert.deepEqual(diagnostic.target, { kind: 'room', id: 'room_lake', roomId: null, field: 'backgroundAssetId' });
  const missingStart = JSON.parse(readFileSync(new URL('../fixtures/missing-start-room.json', import.meta.url), 'utf8')) as unknown;
  failure(missingStart, 'missing_reference', '/startRoomId');
});

test('renaming and reordering preserve reference meaning and stable IDs', () => {
  const project = sample();
  project.assets.push({ id: 'image_other', name: 'Other image', kind: 'image', path: 'assets/other.png' });
  project.rooms.push({ ...project.rooms[0]!, id: 'room_other', elements: [] });
  project.assets.reverse();
  project.rooms.reverse();
  project.rooms.find(room => room.id === 'room_lake')!.name = 'Renamed first scene';
  const backgroundId = project.rooms.find(room => room.id === 'room_lake')!.backgroundAssetId;
  project.assets.find(asset => asset.id === backgroundId)!.name = 'Renamed background';
  const result = validateProject(project);
  assert.ok(result.ok);
  const room = result.project.rooms.find(item => item.id === result.project.startRoomId)!;
  assert.equal(room.id, 'room_lake');
  assert.equal(room.name, 'Renamed first scene');
  assert.equal(room.backgroundAssetId, backgroundId);
});

test('deleting an asset exposes its reference instead of choosing another', () => {
  const project = sample(); project.assets = [];
  failure(project, 'missing_reference', '/rooms/0/backgroundAssetId');
});

test('duplicate IDs across entity kinds are rejected', () => {
  const project = sample(); project.rooms[0]!.elements[0]!.game_id = project.assets[0]!.id;
  const diagnostic = failure(project, 'duplicate_id', '/rooms/0/elements/0/game_id');
  assert.equal(diagnostic.target.roomId, 'room_lake');
});

test('prototype-like IDs use value identity without prototype lookup', () => {
  const project = sample(); project.assets[0]!.id = 'constructor'; project.rooms[0]!.backgroundAssetId = 'constructor';
  assert.ok(validateProject(project).ok);
  project.assets = [];
  failure(project, 'missing_reference', '/rooms/0/backgroundAssetId');
});

test('element geometry points to the affected field and owner', () => {
  const project = sample(); project.rooms[0]!.elements[0]!.bounds.width = 1600;
  const diagnostic = failure(project, 'out_of_bounds', '/rooms/0/elements/0/bounds/width');
  assert.deepEqual(diagnostic.target, { kind: 'element', id: 'element_fixture', roomId: 'room_lake', field: 'bounds.width' });
});

test('legacy boxes and authored shape and image elements round trip', () => {
  const project = sample();
  const room = project.rooms[0]!;
  room.elements.push({ game_id: 'shape_fixture', element_id: 'Shape', name: 'Shape', type: 'shape', bounds: { x: 200, y: 200, width: 100, height: 100 }, vertices: [{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 300 }] });
  room.elements.push({ game_id: 'image_fixture', element_id: 'Image', name: 'Image', type: 'image', bounds: { x: 400, y: 200, width: 100, height: 100 }, media: { path: 'images/sign.png', kind: 'image', width: 100, height: 100, scale: 1, preserveAspectRatio: true, loop: true, reverse: false } });
  const result = validateProject(project);
  assert.ok(result.ok);
  assert.equal(result.project.rooms[0]!.elements[0]!.type, 'box');
  assert.equal(result.project.rooms[0]!.elements[2]!.media?.scale, undefined);
  assert.deepEqual(parseProject(JSON.stringify(result.project)), result);
  const legacyImage = JSON.parse(JSON.stringify(project));
  delete legacyImage.rooms[0].elements[2].media.preserveAspectRatio;
  const upgraded = validateProject(legacyImage);
  assert.ok(upgraded.ok);
  assert.equal(upgraded.project.rooms[0]!.elements[2]!.media?.preserveAspectRatio, true);
  assert.equal(upgraded.project.rooms[0]!.elements[2]!.media?.scale, undefined);
  const editedLegacy = structuredClone(project);
  editedLegacy.rooms[0]!.elements[2]!.bounds = { x: 400, y: 200, width: 140, height: 60 };
  editedLegacy.rooms[0]!.elements.push({ ...structuredClone(editedLegacy.rooms[0]!.elements[2]!), game_id: 'image_fixture_2', bounds: { x: 600, y: 200, width: 80, height: 120 } });
  const migrated = validateProject(editedLegacy);
  assert.ok(migrated.ok);
  assert.deepEqual(migrated.project.rooms[0]!.elements.slice(-2).map(element => element.bounds), editedLegacy.rooms[0]!.elements.slice(-2).map(element => element.bounds));
  assert.ok(migrated.project.rooms[0]!.elements.slice(-2).every(element => element.media?.scale === undefined));
  const stretched = structuredClone(result.project);
  stretched.rooms[0]!.elements[2]!.bounds.height = 60;
  stretched.rooms[0]!.elements[2]!.media!.preserveAspectRatio = false;
  assert.ok(validateProject(stretched).ok);
  failure({ ...project, rooms: [{ ...room, elements: [room.elements[1], { ...room.elements[2], media: { ...room.elements[2]!.media, path: '../sign.png' } }] }] }, 'invalid_value', '/rooms/0/elements/1/media/path');
  failure({ ...project, rooms: [{ ...room, elements: [{ ...room.elements[1], vertices: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] }] }, 'invalid_value', '/rooms/0/elements/0/vertices');
});

test('animation atlas metadata has validated frame geometry', () => {
  const atlas = { format: 'pcag-animation-atlas', image: 'flash.png', gif: 'flash.gif', fps: 5, frameWidth: 2, frameHeight: 3, frames: [{ rect: { x: 0, y: 0, width: 2, height: 3 } }, { rect: { x: 2, y: 0, width: 2, height: 3 } }] };
  assert.equal(parseAnimationAtlas(atlas)?.frames.length, 2);
  assert.equal(parseAnimationAtlas({ ...atlas, frames: [{ rect: { x: 1, y: 0, width: 2, height: 3 } }] }), null);
  assert.equal(parseAnimationAtlas({ ...atlas, fps: 0 }), null);
});

for (const [label, mutate, code, path] of [
  ['missing rooms', (p: Record<string, unknown>) => { delete p.rooms; }, 'invalid_type', '/rooms'],
  ['wrong list type', (p: Record<string, unknown>) => { p.assets = {}; }, 'invalid_type', '/assets'],
  ['unknown field', (p: Record<string, unknown>) => { p.script = 'alert(1)'; }, 'unknown_field', '/script'],
  ['future schema', (p: Record<string, unknown>) => { p.schemaVersion = 2; }, 'unsupported_version', '/schemaVersion'],
  ['missing schema', (p: Record<string, unknown>) => { delete p.schemaVersion; }, 'unsupported_version', '/schemaVersion'],
] as const) test(label, () => {
  const project = JSON.parse(json) as Record<string, unknown>; mutate(project); failure(project, code, path);
});

for (const path of ['../image.png', '/image.png', 'https://host/image.png', 'assets//image.png', 'assets/./image.png', 'assets\\image.png', 'assets/%2e%2e/image.png', 'assets/image.png?x=1']) test(`reject unsafe asset path: ${path}`, () => {
  const project = sample(); project.assets[0]!.path = path;
  failure(project, 'invalid_value', '/assets/0/path');
});

for (const value of [-1, 0, Infinity, NaN]) test(`reject invalid room width: ${value}`, () => {
  const project = sample(); project.rooms[0]!.width = value;
  failure(project, Number.isFinite(value) ? 'invalid_value' : 'invalid_type', '/rooms/0/width');
});

test('malformed JSON and primitive roots return diagnostics instead of throwing', () => {
  const result = parseProject('{broken');
  assert.equal(result.diagnostics[0]?.code, 'invalid_json');
  for (const value of [null, [], true, 42, 'project']) failure(value, 'invalid_type', '');
});

test('new entity IDs remain valid and distinct; validation does not allocate IDs', () => {
  const project = sample();
  const first = createId(); const second = createId();
  assert.notEqual(first, second);
  project.id = first;
  assert.ok(validateProject(project).ok);
  project.rooms[0]!.id = '';
  failure(project, 'invalid_value', '/rooms/0/id');
});
