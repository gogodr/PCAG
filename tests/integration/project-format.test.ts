import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createId, parseProject, validateProject } from '../../packages/project-format/src/index.ts';
import type { Diagnostic, Project } from '../../packages/project-format/src/index.ts';

const json = readFileSync(new URL('../../examples/reference-adventure/project.json', import.meta.url), 'utf8');
const sample = (): Project => {
  const project = JSON.parse(json) as Project;
  project.rooms[0]!.hotspots.push({ id: 'hotspot_fixture', name: 'Fixture hotspot', bounds: { x: 100, y: 100, width: 100, height: 100 }, inspect: 'A test hotspot.' });
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

test('successful validation owns a copy, including nested hotspot data', () => {
  const input = sample();
  const result = validateProject(input);
  assert.ok(result.ok);
  result.project.rooms[0]!.hotspots[0]!.inspect = 'Changed outside authored input';
  assert.notEqual(result.project.rooms[0]!.hotspots[0]!.inspect, input.rooms[0]!.hotspots[0]!.inspect);
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
  project.rooms.push({ ...project.rooms[0]!, id: 'room_other', hotspots: [] });
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
  const project = sample(); project.rooms[0]!.hotspots[0]!.id = project.assets[0]!.id;
  const diagnostic = failure(project, 'duplicate_id', '/rooms/0/hotspots/0/id');
  assert.equal(diagnostic.target.roomId, 'room_lake');
});

test('prototype-like IDs use value identity without prototype lookup', () => {
  const project = sample(); project.assets[0]!.id = 'constructor'; project.rooms[0]!.backgroundAssetId = 'constructor';
  assert.ok(validateProject(project).ok);
  project.assets = [];
  failure(project, 'missing_reference', '/rooms/0/backgroundAssetId');
});

test('hotspot geometry points to the affected field and owner', () => {
  const project = sample(); project.rooms[0]!.hotspots[0]!.bounds.width = 1600;
  const diagnostic = failure(project, 'out_of_bounds', '/rooms/0/hotspots/0/bounds/width');
  assert.deepEqual(diagnostic.target, { kind: 'hotspot', id: 'hotspot_fixture', roomId: 'room_lake', field: 'bounds.width' });
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
