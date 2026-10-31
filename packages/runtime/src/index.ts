import Phaser from 'phaser';
import type { PlayerAction, Project } from '../../project-format/src/index';
import { animationAtlasFromDataUrl } from '../../animation-atlas/src/index';
import { eventFunctionName, matchingEvents, stateChangeTriggers } from '../../scene-events/src/index';
import type { FiredTrigger } from '../../scene-events/src/index';
import { createInitialSessionState } from './state';
import { applyScriptResult, sceneContext } from './scene-script-state';
import SceneScriptWorker from './scene-script.worker?worker';

export interface RuntimeOptions {
  project: Project;
  assetUrls: ReadonlyMap<string, string>;
  stage: HTMLElement;
  onInspect: (text: string | null) => void;
  onError: (message: string) => void;
  onReady?: () => void;
}

/** Future player controls can emit the same action payload used by SceneManager triggers. */
export function emitPlayerAction(stage: HTMLElement, action: PlayerAction, target: string, item?: string): void {
  stage.dispatchEvent(new CustomEvent<FiredTrigger>('pcag:player-action', { detail: { action: `player_${action}`, target, ...(item ? { item } : {}) } }));
}

/** A fresh, disposable room session. Call destroy before mounting another session. */
export function mountRoom(options: RuntimeOptions): () => void {
  const { project, assetUrls, stage, onInspect, onError, onReady } = options;
  const room = project.rooms.find(candidate => candidate.id === project.startRoomId);
  const asset = project.assets.find(candidate => candidate.id === room?.backgroundAssetId);
  const backgroundUrl = asset ? assetUrls.get(asset.path) : undefined;
  if (!room || !backgroundUrl) {
    onError('The room background file is unavailable. Check its asset path.');
    return () => {};
  }
  let activeRoom = structuredClone(room);
  const authoredEvents = room.sceneManager?.events ?? [];
  const session = createInitialSessionState(project);
  const atlases = new Map<string, { image: string; width: number; height: number; count: number; fps: number }>();
  const worker = authoredEvents.length ? new SceneScriptWorker() : null;
  let currentScene: Phaser.Scene | null = null;
  let game: Phaser.Game | null = null;
  let disposed = false;
  let started = false;
  let eventError = false;
  let nextRequestId = 0;
  let queue: Promise<void> = Promise.resolve();
  const pending = new Map<number, { resolve: (result: { scene: unknown; game: unknown }) => void; reject: (error: Error) => void; timer: number }>();

  if (worker) {
    worker.onmessage = (message: MessageEvent<{ id: number; scene?: unknown; game?: unknown; error?: string }>) => {
      const request = pending.get(message.data.id);
      if (!request) return;
      pending.delete(message.data.id);
      window.clearTimeout(request.timer);
      if (message.data.error) request.reject(new Error(message.data.error));
      else request.resolve({ scene: message.data.scene, game: message.data.game });
    };
    worker.onerror = () => {
      for (const request of pending.values()) { window.clearTimeout(request.timer); request.reject(new Error('The script worker stopped.')); }
      pending.clear();
    };
  }
  const runScript = (name: string, script: string, fired: FiredTrigger) => new Promise<{ scene: unknown; game: unknown }>((resolve, reject) => {
    if (!worker) { reject(new Error('The script worker is unavailable.')); return; }
    const id = ++nextRequestId;
    const timer = window.setTimeout(() => { pending.delete(id); worker.terminate(); reject(new Error('The script took too long and was stopped.')); }, 1500);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, name, script, scene: sceneContext(activeRoom, session.sceneStates[activeRoom.id] ?? {}), game: { state: { ...session.gameState } }, trigger: fired });
  });
  const dispatch = (fired: FiredTrigger, budget = { remaining: 64, warned: false }) => {
    for (const event of matchingEvents(authoredEvents, fired)) {
      queue = queue.then(async () => {
        if (budget.remaining <= 0) {
          if (!budget.warned && !disposed) { eventError = true; onError('SceneManager stopped an event chain after 64 script runs.'); }
          budget.warned = true;
          return;
        }
        budget.remaining--;
        const beforeSceneState = session.sceneStates[activeRoom.id] ?? {};
        const beforeGameState = session.gameState;
        const result = await runScript(eventFunctionName(event.id), event.script, fired);
        const next = applyScriptResult(activeRoom, beforeSceneState, beforeGameState, result.scene, result.game, assetUrls);
        activeRoom = next.room;
        session.sceneStates[activeRoom.id] = next.sceneState;
        session.gameState = next.gameState;
        if (!disposed && next.elementsChanged && currentScene) currentScene.scene.restart();
        for (const change of [...stateChangeTriggers('scene', beforeSceneState, next.sceneState), ...stateChangeTriggers('game', beforeGameState, next.gameState)]) dispatch(change, budget);
      }).catch((error: unknown) => { if (!disposed) { eventError = true; onError(`Event "${event.name}": ${error instanceof Error ? error.message : 'Script failed.'}`); } });
    }
  };
  const onPlayerAction = (event: Event) => {
    const fired = (event as CustomEvent<FiredTrigger>).detail;
    if (fired && 'action' in fired && typeof fired.action === 'string' && typeof fired.target === 'string') dispatch(fired);
  };
  stage.addEventListener('pcag:player-action', onPlayerAction);
  stage.setAttribute('aria-label', activeRoom.name);
  onInspect(null);

  class RoomScene extends Phaser.Scene {
    preload() {
      if (!this.textures.exists('background')) {
        if (asset!.path.toLowerCase().endsWith('.svg')) this.load.svg('background', backgroundUrl, { width: activeRoom.width, height: activeRoom.height });
        else this.load.image('background', backgroundUrl);
      }
      atlases.clear();
      for (const element of activeRoom.elements) {
        if (element.type !== 'image' || !element.media?.path) continue;
        const key = `element-${element.id}`;
        if (this.textures.exists(key)) this.textures.remove(key);
        if (element.media.kind === 'image') {
          const url = assetUrls.get(element.media.path);
          if (url) {
            if (element.media.path.toLowerCase().endsWith('.svg')) this.load.svg(key, url);
            else this.load.image(key, url);
          }
        } else {
          const info = animationAtlasFromDataUrl(assetUrls.get(element.media.path));
          const image = info && assetUrls.get(`${element.media.path.slice(0, element.media.path.lastIndexOf('/'))}/${info.image}`);
          if (!info || !image) continue;
          atlases.set(element.id, { image, width: info.frameWidth, height: info.frameHeight, count: info.frames.length, fps: info.fps });
          this.load.spritesheet(key, image, { frameWidth: info.frameWidth, frameHeight: info.frameHeight });
        }
      }
      this.load.once('loaderror', () => { if (!disposed) onError('A scene image could not be loaded.'); });
    }

    create() {
      if (!this.textures.exists('background')) return;
      currentScene = this;
      this.registry.set('pcag-state', session);
      this.add.image(activeRoom.width / 2, activeRoom.height / 2, 'background').setDisplaySize(activeRoom.width, activeRoom.height).setDepth(0);
      for (const [index, element] of activeRoom.elements.entries()) {
        const { x, y, width, height } = element.bounds;
        const key = `element-${element.id}`;
        if (element.visible !== false && element.type === 'image' && this.textures.exists(key)) {
          const atlas = atlases.get(element.id);
          if (atlas) {
            const frames = Array.from({ length: atlas.count }, (_, frame) => frame);
            if (element.media?.reverse) frames.reverse();
            const animationKey = `animation-${element.id}`;
            if (this.anims.exists(animationKey)) this.anims.remove(animationKey);
            this.anims.create({ key: animationKey, frames: frames.map(frame => ({ key, frame })), frameRate: atlas.fps, repeat: element.media?.loop ? -1 : 0 });
            this.add.sprite(x + width / 2, y + height / 2, key).setDisplaySize(width, height).setDepth(index + 1).play(animationKey);
          } else this.add.image(x + width / 2, y + height / 2, key).setDisplaySize(width, height).setDepth(index + 1);
        }
        if (element.visible === false || element.enabled === false) continue;
        const area = element.type === 'shape' && element.vertices
          ? this.add.zone(activeRoom.width / 2, activeRoom.height / 2, activeRoom.width, activeRoom.height).setDepth(index + 1).setInteractive(new Phaser.Geom.Polygon(element.vertices), Phaser.Geom.Polygon.Contains)
          : this.add.zone(x + width / 2, y + height / 2, width, height).setDepth(index + 1).setInteractive({ useHandCursor: true });
        area.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          if (disposed) return;
          onInspect(`You see ${element.name}.`);
          dispatch({ action: 'player_view', target: element.id });
        });
      }
      if (!started) {
        started = true;
        dispatch({ action: 'game_load' });
        dispatch({ action: 'scene_load' });
        void (async () => {
          let observed: Promise<void>;
          do { observed = queue; await observed; } while (queue !== observed);
          if (!disposed && !eventError) onReady?.();
        })();
      }
    }
  }
  game = new Phaser.Game({
    type: Phaser.AUTO, parent: stage, width: activeRoom.width, height: activeRoom.height,
    backgroundColor: '#14263c', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true }, banner: false, scene: RoomScene,
  });
  return () => {
    if (disposed) return;
    dispatch({ action: 'scene_close' });
    dispatch({ action: 'game_close' });
    disposed = true;
    stage.removeEventListener('pcag:player-action', onPlayerAction);
    game?.destroy(true);
    stage.replaceChildren();
    void queue.finally(() => worker?.terminate());
  };
}
