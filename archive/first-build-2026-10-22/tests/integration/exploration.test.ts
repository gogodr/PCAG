import { describe, expect, it } from 'vitest';
import sample from '../../examples/foundation/project.json';
import legacy from '../../examples/foundation/project-v1.json';
import { canTraverse, createProject, findPath, isWalkable, requireProject, requirePlayableProject, validateProject, validatePlayableProject, type Navigation, type Point } from '../../packages/project-format/src/index';
import { AdventureSession } from '../../packages/adventure-core/src/index';
import { LEGACY_STORAGE_KEY, STORAGE_KEY, loadProject, saveProject, parseProject, serializeProject } from '../../packages/project-io/src/index';
import { duplicateRoom } from '../../apps/creator/src/world';

const nav: Navigation = { walkable: [{ x: 0, y: 0, width: 600, height: 400 }], obstacles: [{ x: 250, y: 80, width: 100, height: 240 }] };
const validSegments = (navigation: Navigation, from: Point, path: Point[]) => {
  for (const point of path) { expect(isWalkable(navigation, point)).toBe(true); expect(canTraverse(navigation, from, point)).toBe(true); from = point; }
};
function movementProject() {
  const p = createProject(), r = p.rooms[0];
  r.navigation = { walkable: [{ id: 'ground', name: 'Ground', x: 0, y: 0, width: 960, height: 540 }], obstacles: [{ id: 'block', name: 'Block', x: 300, y: 100, width: 150, height: 400 }] };
  Object.assign(r.entrances[0], { x: 100, y: 300 });
  r.hotspots.push({ id: 'target', name: 'Target', x: 800, y: 250, width: 50, height: 50, inspection: 'A distant target.', approach: { x: 750, y: 300, facing: 'left' }, enabled: true });
  return p;
}

describe('constrained navigation', () => {
  it('routes around an obstacle and smooths only traversable segments', () => {
    const from = { x: 50, y: 200 }, goal = { x: 550, y: 200 }, path = findPath(nav, from, goal)!;
    expect(path.length).toBeGreaterThan(1); expect(path.at(-1)).toEqual(goal); validSegments(nav, from, path);
  });
  it('rejects blocked targets, outside points, and disconnected walkable regions', () => {
    expect(findPath(nav, { x: 50, y: 200 }, { x: 300, y: 200 })).toBeNull();
    expect(findPath(nav, { x: -1, y: 200 }, { x: 50, y: 200 })).toBeNull();
    const separated = { walkable: [{ x: 0, y: 0, width: 100, height: 100 }, { x: 150, y: 0, width: 100, height: 100 }], obstacles: [] };
    expect(findPath(separated, { x: 50, y: 50 }, { x: 200, y: 50 })).toBeNull();
  });
  it('crosses overlapping walk rectangles without cutting an uncovered corner', () => {
    const shape = { walkable: [{ x: 0, y: 0, width: 100, height: 250 }, { x: 0, y: 150, width: 250, height: 100 }], obstacles: [] };
    const from = { x: 50, y: 50 }, goal = { x: 220, y: 200 }, path = findPath(shape, from, goal)!;
    expect(canTraverse(shape, from, goal)).toBe(false); validSegments(shape, from, path); expect(path.at(-1)).toEqual(goal);
  });
  it('cannot tunnel through a thin obstacle or walk on its edge', () => {
    const thin = { walkable: [{ x: 0, y: 0, width: 100, height: 100 }], obstacles: [{ x: 50, y: 0, width: .01, height: 100 }] };
    expect(canTraverse(thin, { x: 1, y: 50 }, { x: 99, y: 50 })).toBe(false);
    expect(findPath(thin, { x: 1, y: 50 }, { x: 99, y: 50 })).toBeNull();
  });
});

describe('actor movement and pending action boundaries', () => {
  it('moves continuously at authored speed and arrives without crossing the obstacle', () => {
    const s = new AdventureSession(movementProject()), before = { ...s.position };
    expect(s.walkTo({ x: 750, y: 300 }).ok).toBe(true); s.update(100);
    expect(s.position).not.toEqual(before); expect(s.isWalking).toBe(true);
    // One tick can traverse a route corner; its start/end chord is not the route.
    for (let i = 0; i < 100; i++) { const old = { ...s.position }; s.update(100); expect(isWalkable(s.room.navigation, s.position)).toBe(true); expect(Math.hypot(s.position.x - old.x, s.position.y - old.y)).toBeLessThanOrEqual(18.00001); }
    expect(s.position).toEqual({ x: 750, y: 300 }); expect(s.mode).toBe('idle');
  });
  it('View stops an approach and speaks from the current position even with unreachable approach', () => {
    const p = movementProject(), r = p.rooms[0];
    r.navigation.obstacles[0].y = 0; r.navigation.obstacles[0].height = 540;
    const s = new AdventureSession(p), at = { ...s.position };
    expect(s.approach('target', 'use').ok).toBe(false);
    expect(s.act({ actorId: 'player', action: 'inspect', targetId: 'target' }).text).toBe('A distant target.');
    s.update(10000); expect(s.position).toEqual(at); expect(s.drainArrivals()).toEqual([]);
  });
  it('emits one validated physical arrival after reaching the target, including already-in-range', () => {
    const s = new AdventureSession(movementProject());
    s.approach('target', 'use'); expect(s.drainArrivals()).toEqual([]); s.update(20000);
    expect(s.drainArrivals()).toEqual([{ action: 'use', targetId: 'target', roomId: s.roomId }]); expect(s.facing).toBe('left');
    s.update(20000); expect(s.drainArrivals()).toEqual([]);
    s.approach('target', 'pick_up'); expect(s.isWalking).toBe(false); expect(s.drainArrivals()).toHaveLength(1);
  });
  it('cancellation and replacement prevent old arrival effects', () => {
    const s = new AdventureSession(movementProject());
    s.approach('target', 'use'); s.update(100); s.cancel(); s.update(20000); expect(s.drainArrivals()).toEqual([]);
    s.approach('target', 'pick_up'); s.walkTo({ x: 70, y: 300 }); s.update(20000); expect(s.position.x).toBe(70); expect(s.drainArrivals()).toEqual([]);
    s.approach('target', 'use'); s.update(100); const at = { ...s.position };
    s.act({ actorId: 'player', action: 'inspect', targetId: 'target' }); s.update(20000); expect(s.position).toEqual(at); expect(s.drainArrivals()).toEqual([]);
  });
  it('rechecks target availability and approach position after movement', () => {
    for (const change of ['disable', 'move', 'delete']) {
      const s = new AdventureSession(movementProject()); s.approach('target', 'use');
      if (change === 'disable') s.room.hotspots[0].enabled = false;
      else if (change === 'move') s.room.hotspots[0].approach!.x = 740;
      else s.room.hotspots = [];
      s.update(20000); expect(s.drainArrivals()).toEqual([]);
    }
  });
  it('transitions through exits at arrival and cancels work on room changes/disposal', () => {
    const p = requireProject(sample), s = new AdventureSession(p);
    s.walkToTarget('exit_study'); expect(s.roomId).toBe('room_study'); s.update(10000); expect(s.roomId).toBe('room_hall');
    expect(s.position).toEqual({ x: 150, y: 465 }); s.walkToTarget('exit_hall'); s.update(10000); expect(s.roomId).toBe('room_study');
    s.approach('hotspot_note', 'use'); s.changeRoom('room_hall', 'entry_hall'); s.update(10000); expect(s.drainArrivals()).toEqual([]);
    s.walkTo({ x: 800, y: 450 }); s.dispose(); const at = { ...s.position }; s.update(10000); expect(s.position).toEqual(at);
  });
});

describe('project compatibility and room editing', () => {
  it('migrates v1 without changing IDs/content or inventing artwork/ground', () => {
    const before = JSON.stringify(legacy), migrated = requireProject(legacy);
    expect(migrated.formatVersion).toBe(2); expect(migrated.protagonist).toBeNull(); expect(migrated.rooms[0].navigation.walkable).toEqual([]);
    expect(migrated.rooms[0].hotspots.map(h => [h.id, h.inspection])).toEqual(legacy.rooms[0].hotspots.map(h => [h.id, h.inspection]));
    expect(validateProject(migrated).ok).toBe(true); expect(validatePlayableProject(migrated).ok).toBe(false);
    expect(parseProject(serializeProject(migrated))).toEqual(migrated); expect(JSON.stringify(legacy)).toBe(before);
  });
  it('retains the original v1 browser save when saving an upgraded draft', () => {
    const data = new Map([[LEGACY_STORAGE_KEY, JSON.stringify(legacy)]]), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
    const p = loadProject(storage)!; saveProject(storage, p); expect(data.has(STORAGE_KEY)).toBe(true); expect(data.get(LEGACY_STORAGE_KEY)).toBe(JSON.stringify(legacy));
  });
  it('distinguishes editable drafts from playable setup and validates destinations', () => {
    const p = requireProject(sample); p.rooms[0].entrances[0].y = 20;
    expect(validateProject(p).ok).toBe(true); expect(validatePlayableProject(p).ok).toBe(false);
    p.rooms[0].entrances[0].y = 460; p.rooms[0].exits[0].targetEntranceId = 'missing';
    expect(validateProject(p).diagnostics.some(d => d.code === 'missing-entry')).toBe(true);
  });
  it('duplicates all local identities and keeps external links/assets intact', () => {
    const p = requirePlayableProject(sample), source = p.rooms[0], copy = duplicateRoom(source);
    p.rooms.push(copy); expect(validateProject(p).ok).toBe(true); expect(copy.id).not.toBe(source.id);
    expect(copy.hotspots[0].id).not.toBe(source.hotspots[0].id); expect(copy.exits[0].targetRoomId).toBe('room_hall'); expect(copy.backgroundAssetId).toBe(source.backgroundAssetId);
  });
});
