import { requirePlayableProject, findPath, distance, isWalkable, type Point, type Project, type Room } from '../../project-format/src/index';

export interface ActionRequest { actorId: 'player'; action: 'inspect'; targetId: string }
export interface ActionResult { ok: boolean; text: string; targetId?: string }
export interface ArrivalEvent { action: 'use' | 'pick_up'; targetId: string; roomId: string }
type Pending = { roomId: string; targetId: string; action: 'exit' | 'walk' | 'use' | 'pick_up'; destination: Point };

/** Frame-stepped movement keeps pending actions independent of renderer callbacks. */
export class AdventureSession {
  readonly project: Project;
  readonly inspected = new Set<string>();
  roomId: string;
  position: Point;
  facing: 'left' | 'right';
  mode: 'idle' | 'walk' | 'talk' = 'idle';
  speech = 'Look around. Every object has a story.';
  command = 'Walk to…';
  private disposed = false;
  private route: Point[] = [];
  private pending: Pending | null = null;
  private speechTime = 0;
  private arrivals: ArrivalEvent[] = [];

  constructor(project: Project) {
    this.project = requirePlayableProject(structuredClone(project));
    this.roomId = this.project.startRoomId;
    const entrance = this.room.entrances.find(e => e.id === this.room.defaultEntranceId)!;
    this.position = { x: entrance.x, y: entrance.y }; this.facing = entrance.facing;
  }
  get room(): Room { return this.project.rooms.find(r => r.id === this.roomId)!; }
  get isWalking() { return this.route.length > 0; }
  get path(): readonly Point[] { return this.route; }
  private say(text: string): ActionResult {
    this.speech = text; this.speechTime = 2500; this.mode = 'talk'; return { ok: true, text };
  }
  cancel() {
    this.route = []; this.pending = null; this.mode = 'idle'; this.speechTime = 0; this.command = 'Walk to…';
  }
  act(request: ActionRequest): ActionResult {
    if (this.disposed) return { ok: false, text: 'This play session has ended.' };
    this.cancel();
    if (request.actorId !== 'player' || request.action !== 'inspect') return { ok: false, text: 'That action is not available.' };
    const hotspot = this.room.hotspots.find(h => h.id === request.targetId && h.enabled);
    if (!hotspot) return { ok: false, text: 'That object is no longer available.' };
    this.inspected.add(hotspot.id); this.command = `View ${hotspot.name}`;
    return { ...this.say(hotspot.inspection), targetId: hotspot.id };
  }
  walkTo(destination: Point): ActionResult {
    if (this.disposed) return { ok: false, text: 'This play session has ended.' };
    this.cancel(); this.command = 'Walk to destination';
    return this.startRoute(destination);
  }
  walkToTarget(targetId: string): ActionResult {
    const exit = this.room.exits.find(e => e.id === targetId);
    return this.startApproach(targetId, exit ? 'exit' : 'walk');
  }
  /** M1 service boundary for the later physical-action runner; no inventory effects yet. */
  approach(targetId: string, action: 'use' | 'pick_up'): ActionResult { return this.startApproach(targetId, action); }
  private startApproach(targetId: string, action: Pending['action']): ActionResult {
    if (this.disposed) return { ok: false, text: 'This play session has ended.' };
    this.cancel();
    const target = action === 'exit' ? this.room.exits.find(e => e.id === targetId) : this.room.hotspots.find(h => h.id === targetId && h.enabled);
    if (!target) return { ok: false, text: 'That object is no longer available.' };
    if (!target.approach) return { ...this.say("I don't know where to stand to reach that."), ok: false };
    this.command = `${action === 'use' ? 'Use' : action === 'pick_up' ? 'Pick up' : 'Walk to'} ${target.name}`;
    const result = this.startRoute(target.approach);
    if (!result.ok) return result;
    this.pending = { roomId: this.roomId, targetId, action, destination: { ...target.approach } };
    if (!this.route.length) this.arrive();
    return result;
  }
  private startRoute(destination: Point): ActionResult {
    const path = findPath(this.room.navigation, this.position, destination);
    if (!path) return { ...this.say("I can't reach that."), ok: false };
    this.route = distance(this.position, destination) <= .01 ? [] : path;
    this.mode = this.route.length ? 'walk' : 'idle';
    this.speech = this.route.length ? 'On my way.' : 'I am already here.';
    return { ok: true, text: this.speech };
  }
  private arrive() {
    const pending = this.pending; this.pending = null; this.mode = 'idle'; this.command = 'Walk to…';
    if (!pending) { this.speech = 'I am here.'; return; }
    if (pending.roomId !== this.roomId || distance(this.position, pending.destination) > 1) return;
    const target = pending.action === 'exit' ? this.room.exits.find(e => e.id === pending.targetId) : this.room.hotspots.find(h => h.id === pending.targetId && h.enabled);
    if (!target?.approach || distance(target.approach, pending.destination) > .01 || !isWalkable(this.room.navigation, this.position)) { this.say('That is no longer available.'); return; }
    this.facing = target.approach.facing;
    if (pending.action === 'exit') {
      const room = this.project.rooms.find(r => r.id === this.room.exits.find(e => e.id === pending.targetId)?.targetRoomId);
      const exit = this.room.exits.find(e => e.id === pending.targetId)!;
      if (room && exit.targetEntranceId) this.changeRoom(room.id, exit.targetEntranceId);
      else this.say('That exit is no longer available.');
    } else if (pending.action === 'use' || pending.action === 'pick_up') {
      this.arrivals.push({ action: pending.action, targetId: target.id, roomId: this.roomId });
    } else this.speech = 'I am here.';
  }
  drainArrivals(): ArrivalEvent[] { const events = this.arrivals; this.arrivals = []; return events; }
  changeRoom(roomId: string, entranceId: string): boolean {
    if (this.disposed) return false;
    const room = this.project.rooms.find(r => r.id === roomId), entrance = room?.entrances.find(e => e.id === entranceId);
    if (!room || !entrance || !isWalkable(room.navigation, entrance)) { this.cancel(); this.say("I can't enter there."); return false; }
    this.cancel(); this.arrivals = []; this.roomId = room.id; this.position = { x: entrance.x, y: entrance.y }; this.facing = entrance.facing;
    this.speech = `I have arrived in ${room.name}.`; return true;
  }
  update(deltaMs: number) {
    if (this.disposed || !Number.isFinite(deltaMs) || deltaMs < 0) return;
    if (!this.route.length) { this.speechTime = Math.max(0, this.speechTime - deltaMs); if (!this.speechTime) this.mode = 'idle'; return; }
    let remaining = this.project.protagonist!.speed * deltaMs / 1000;
    while (this.route.length && remaining > 0) {
      const next = this.route[0], length = distance(this.position, next);
      if (Math.abs(next.x - this.position.x) > .01) this.facing = next.x < this.position.x ? 'left' : 'right';
      if (length <= remaining) { this.position = { ...next }; this.route.shift(); remaining -= length; }
      else { const factor = remaining / length; this.position = { x: this.position.x + (next.x - this.position.x) * factor, y: this.position.y + (next.y - this.position.y) * factor }; remaining = 0; }
    }
    if (!this.route.length) this.arrive();
  }
  dispose() { this.cancel(); this.arrivals = []; this.disposed = true; this.inspected.clear(); }
}
