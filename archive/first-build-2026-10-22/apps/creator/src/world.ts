import type { Project, Room } from '../../../packages/project-format/src/index';
export type Edit = (update: (project: Project) => void) => void;
export type Tool = 'select' | 'hotspot' | 'walkable' | 'obstacle' | 'exit' | 'spawn' | 'approach';
export type RoomEntity = Room['hotspots'][number] | Room['exits'][number] | Room['entrances'][number] | Room['navigation']['walkable'][number] | Room['layers'][number];
export function roomEntities(room: Room): RoomEntity[] {
  return [...room.hotspots, ...room.exits, ...room.entrances, ...room.navigation.walkable, ...room.navigation.obstacles, ...room.layers];
}
export function duplicateRoom(source: Room): Room {
  const copy = structuredClone(source), ids = new Map<string, string>();
  for (const entity of [copy, ...roomEntities(copy)]) { const old = entity.id; entity.id = `copy_${crypto.randomUUID()}`; ids.set(old, entity.id); }
  copy.name = `${source.name} copy`; copy.defaultEntranceId = ids.get(source.defaultEntranceId)!;
  for (const exit of copy.exits) if (exit.targetRoomId === source.id) { exit.targetRoomId = copy.id; exit.targetEntranceId = ids.get(exit.targetEntranceId!) ?? null; }
  return copy;
}
