import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import sample from '../../examples/foundation/project.json';
import { createProject, requireProject, validateProject } from '../../packages/project-format/src/index';
import { AdventureSession } from '../../packages/adventure-core/src/index';
import { buildPlayableArchive, loadProject, parseProject, saveProject, serializeProject, STORAGE_KEY } from '../../packages/project-io/src/index';
import { historyReducer } from '../../apps/creator/src/history';

const fixture = () => requireProject(structuredClone(sample));

describe('project model and diagnostics', () => {
  it('round trips new and populated projects with stable identity', () => {
    for (const project of [createProject(), fixture()]) expect(parseProject(serializeProject(project))).toEqual(project);
  });
  it('locates broken background and starting-room references', () => {
    const project = fixture();
    project.startRoomId = 'missing_room';
    project.rooms[0].backgroundAssetId = 'missing_asset';
    const result = validateProject(project);
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-room', path: 'startRoomId' }),
      expect.objectContaining({ code: 'missing-asset', path: 'rooms.0.backgroundAssetId', entityId: 'room_study' }),
    ]));
  });
  it('rejects duplicate identities and hotspot bounds outside the room', () => {
    const project = fixture();
    project.rooms[0].hotspots[1].id = project.rooms[0].hotspots[0].id;
    project.rooms[0].hotspots[0].x = 959;
    const result = validateProject(project);
    expect(result.diagnostics.map(d => d.code)).toEqual(expect.arrayContaining(['duplicate-id', 'out-of-bounds']));
  });
  it('fails unsupported versions, executable fields and malformed image URLs', () => {
    expect(validateProject({ ...fixture(), formatVersion: 999 }).diagnostics[0].code).toBe('unsupported-version');
    expect(validateProject({ ...fixture(), script: 'alert(1)' }).ok).toBe(false);
    const project = fixture();
    project.assets[0].dataUrl = 'https://external.example/background.png';
    expect(validateProject(project).ok).toBe(false);
    expect(() => parseProject('{bad')).toThrow('readable project');
  });
});

describe('isolated adventure sessions', () => {
  it('inspects by stable ID after rename, without mutating authored content', () => {
    const project = fixture();
    project.rooms[0].hotspots[0].name = 'Renamed note';
    const before = serializeProject(project);
    const session = new AdventureSession(project);
    const result = session.act({ actorId: 'player', action: 'inspect', targetId: 'hotspot_note' });
    expect(result.text).toBe(project.rooms[0].hotspots[0].inspection);
    expect(session.inspected.has('hotspot_note')).toBe(true);
    expect(serializeProject(project)).toBe(before);
    project.rooms[0].hotspots[0].inspection = 'Changed while playing';
    expect(session.act({ actorId: 'player', action: 'inspect', targetId: 'hotspot_note' })).toEqual(result);
  });
  it('rejects stale targets and disposed work, and restarts without visited state', () => {
    const project = fixture();
    const session = new AdventureSession(project);
    expect(session.act({ actorId: 'player', action: 'inspect', targetId: 'missing' }).ok).toBe(false);
    session.act({ actorId: 'player', action: 'inspect', targetId: 'hotspot_note' });
    session.dispose();
    expect(session.act({ actorId: 'player', action: 'inspect', targetId: 'hotspot_note' }).ok).toBe(false);
    expect(new AdventureSession(project).inspected.size).toBe(0);
  });
});

describe('persistence, export, and undo', () => {
  it('restores the saved project and retains the last good value on failed save', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    expect(loadProject(storage)).toBeNull();
    saveProject(storage, fixture());
    const lastGood = data.get(STORAGE_KEY);
    const broken = fixture(); broken.rooms[0].backgroundAssetId = 'missing';
    expect(() => saveProject(storage, broken)).toThrow();
    expect(data.get(STORAGE_KEY)).toBe(lastGood);
    const full = { ...storage, setItem: () => { throw new Error('Quota exceeded'); } };
    expect(() => saveProject(full, createProject())).toThrow('Quota');
    expect(loadProject(storage)).toEqual(fixture());
  });
  it('packages validated content and a standalone player with portable file names', () => {
    const project = fixture();
    const archive = buildPlayableArchive(project, { html: '<main></main>', script: new TextEncoder().encode('player'), style: new Uint8Array() });
    const files = unzipSync(archive);
    expect(Object.keys(files).sort()).toEqual(['README.txt', 'index.html', 'player.css', 'player.js', 'project.json']);
    expect(parseProject(strFromU8(files['project.json']))).toEqual(project);
  });
  it('preserves identities through edit, delete, undo, and redo', () => {
    const original = fixture();
    let history = { past: [] as typeof original[], present: original, future: [] as typeof original[] };
    history = historyReducer(history, { type: 'edit', update: p => { p.rooms[0].hotspots[0].name = 'A different name'; } });
    expect(history.present.rooms[0].hotspots[0].id).toBe('hotspot_note');
    history = historyReducer(history, { type: 'edit', update: p => { p.rooms[0].hotspots.splice(0, 1); } });
    expect(history.present.rooms[0].hotspots).toHaveLength(1);
    history = historyReducer(history, { type: 'undo' });
    expect(history.present.rooms[0].hotspots[0].name).toBe('A different name');
    history = historyReducer(history, { type: 'redo' });
    expect(history.present.rooms[0].hotspots).toHaveLength(1);
    expect(original).toEqual(fixture());
  });
});
