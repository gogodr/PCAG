import Phaser from 'phaser';
import type { Element, PlayerAction, Project, Room } from '../../project-format/src/index';
import { animationAtlasFromDataUrl } from '../../animation-atlas/src/index';
import { eventFunctionName, matchingEvents, playerActionLabels, stateChangeTriggers } from '../../scene-events/src/index';
import type { FiredTrigger } from '../../scene-events/src/index';
import { createLatestEventQueue } from '../../scene-events/src/latest-event-queue';
import { createInitialSessionState } from './state';
import { applyScriptResult, sceneContext } from './scene-script-state';
import { characterFrames } from './character-frames';
import { loadWalkablePixels, walkablePath, walkableScale } from './player-navigation';
import type { WalkablePixels } from './player-navigation';
import { actionChoices, cycleAction, loadActionCursors } from './action-cursors';
import type { CursorKey } from './action-cursors';
import SceneScriptWorker from './scene-script.worker?worker';

export interface RuntimeOptions {
  project: Project;
  assetUrls: ReadonlyMap<string, string>;
  stage: HTMLElement;
  onInspect: (text: string | null) => void;
  onError: (message: string) => void;
  onSceneLoaded?: () => void | Promise<void>;
  onReady?: () => void;
  onActionHint?: (text: string | null) => void;
}

interface AnimationControl { play: () => Promise<void>; stop: () => void; cancel: () => void }
interface AnimationState { uri: string; loop: boolean; reverse: boolean; phase: 'first' | 'playing' | 'last' | 'loop' }

/** Future player controls can emit the same action payload used by SceneManager triggers. */
export function emitPlayerAction(stage: HTMLElement, action: PlayerAction, target: string, item?: string): void {
  stage.dispatchEvent(new CustomEvent<FiredTrigger>('pcag:player-action', { detail: { action: `player_${action}`, target, ...(item ? { item } : {}) } }));
}

export function setPlayerDebugging(stage: HTMLElement, enabled: boolean): void {
  stage.dispatchEvent(new CustomEvent<boolean>('pcag:debug-walk-path', { detail: enabled }));
}

/** A fresh, disposable room session. Call destroy before mounting another session. */
export function mountRoom(options: RuntimeOptions): () => void {
  const { project, assetUrls, stage, onInspect, onError, onSceneLoaded, onReady, onActionHint } = options;
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
  const animationControls = new Map<string, AnimationControl>();
  const animationStates = new Map<string, AnimationState>();
  const renderedElements = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  const elementHitAreas = new Map<string, Phaser.GameObjects.Zone>();
  const playerCharacter = project.characters?.find(character => character.id === room.player?.characterId);
  const playerAnimations = new Map<string, { frames: string[]; fps: number; height: number; mirrorX: boolean }>();
  let walkMask: WalkablePixels | null = null;
  let playerPosition = { ...(room.player?.position ?? { x: room.width / 2, y: room.height / 2 }) };
  const worker = authoredEvents.length ? new SceneScriptWorker() : null;
  let currentScene: Phaser.Scene | null = null;
  let game: Phaser.Game | null = null;
  let disposed = false;
  let started = false;
  let eventError = false;
  let nextRequestId = 0;
  let hoveredElement: Element | null = null;
  let selectedAction: PlayerAction = 'move_to';
  let pointerWalkable = true;
  let actionCursors: Record<CursorKey, string> | null = null;
  let lastWheel = 0;
  let debugging = false;
  let debugPath: Phaser.GameObjects.Graphics | null = null;
  let execution: Promise<void> = Promise.resolve();
  let positionTimer: number | null = null;
  let positionMoving = false;
  let sceneRebuilding = false;
  const sceneReadyWaiters = new Set<{ resolve: () => void; reject: (error: Error) => void; timer: number }>();
  const waitForSceneReady = () => sceneRebuilding ? new Promise<void>((resolve, reject) => {
    const waiter = { resolve, reject, timer: 0 };
    waiter.timer = window.setTimeout(() => { sceneReadyWaiters.delete(waiter); reject(new Error('The scene did not finish loading its animations.')); }, 10_000);
    sceneReadyWaiters.add(waiter);
  }) : Promise.resolve();
  const pending = new Map<number, { resolve: (result: { scene: unknown; game: unknown }) => void; reject: (error: Error) => void; timer: number | null; animationCommands: number }>();
  const armScriptTimer = (id: number) => window.setTimeout(() => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    worker?.terminate();
    request.reject(new Error('The script took too long and was stopped.'));
  }, 1500);
  const commitRoomElements = (nextRoom: Room, changed: boolean) => {
    const flagsOnly = changed && activeRoom.elements.length === nextRoom.elements.length && activeRoom.elements.every((element, index) =>
      JSON.stringify({ ...element, enabled: true, visible: true }) === JSON.stringify({ ...nextRoom.elements[index], enabled: true, visible: true }));
    activeRoom = nextRoom;
    if (!changed || !currentScene || disposed) return;
    if (flagsOnly) {
      for (const element of activeRoom.elements) {
        renderedElements.get(element.game_id)?.setVisible(element.visible !== false && (element.type !== 'overlay' || element.enabled !== false));
        const area = elementHitAreas.get(element.game_id);
        if (area) {
          if (element.visible !== false && element.enabled !== false) area.setInteractive();
          else area.disableInteractive();
        }
      }
      if (hoveredElement) {
        const current = activeRoom.elements.find(element => element.game_id === hoveredElement?.game_id);
        if (!current || current.visible === false || current.enabled === false) hoverElement(null);
      }
      return;
    }
    endPositionSampling();
    sceneRebuilding = true;
    currentScene.scene.restart();
  };

  if (worker) {
    worker.onmessage = (message: MessageEvent<{ type?: 'animation_command'; id: number; commandId?: number; elementId?: string; action?: 'play' | 'stop'; elements?: unknown; scene?: unknown; game?: unknown; error?: string }>) => {
      if (message.data.type === 'animation_command') {
        const request = pending.get(message.data.id);
        if (!request || message.data.commandId === undefined) return;
        if (request.timer !== null) window.clearTimeout(request.timer);
        request.timer = null;
        request.animationCommands++;
        const { id, commandId, elementId, action, elements } = message.data;
        void (async () => {
          await waitForSceneReady();
          if (elements) {
            const currentState = session.sceneStates[activeRoom.id] ?? {};
            const applied = applyScriptResult(activeRoom, currentState, session.gameState, { state: currentState, elements }, { state: session.gameState }, assetUrls);
            if (applied.elementsChanged) {
              commitRoomElements(applied.room, true);
              await waitForSceneReady();
            }
          }
          const control = elementId && animationControls.get(elementId);
          const element = activeRoom.elements.find(item => item.game_id === elementId);
          if (!element || element.type !== 'image' || element.media?.kind !== 'animation' || !element.media.path) throw new Error(`Element ${elementId ?? ''} has no playable animation.`);
          if (!control) throw new Error(`The animation for element ${elementId} could not be loaded. Check its atlas JSON and companion PNG.`);
          if (action === 'play') await control.play();
          else if (action === 'stop') control.stop();
          else throw new Error('Unknown animation command.');
        })().then(() => worker.postMessage({ type: 'animation_result', id, commandId }), error => worker.postMessage({ type: 'animation_result', id, commandId, error: error instanceof Error ? error.message : 'Animation command failed.' })).finally(() => {
          request.animationCommands--;
          if (pending.has(id) && request.animationCommands === 0) request.timer = armScriptTimer(id);
        });
        return;
      }
      const request = pending.get(message.data.id);
      if (!request) return;
      pending.delete(message.data.id);
      if (request.timer !== null) window.clearTimeout(request.timer);
      if (message.data.error) request.reject(new Error(message.data.error));
      else request.resolve({ scene: message.data.scene, game: message.data.game });
    };
    worker.onerror = () => {
      for (const request of pending.values()) { if (request.timer !== null) window.clearTimeout(request.timer); request.reject(new Error('The script worker stopped.')); }
      pending.clear();
    };
  }
  const runScript = (name: string, script: string, fired: FiredTrigger) => new Promise<{ scene: unknown; game: unknown }>((resolve, reject) => {
    if (!worker) { reject(new Error('The script worker is unavailable.')); return; }
    const id = ++nextRequestId;
    pending.set(id, { resolve, reject, timer: armScriptTimer(id), animationCommands: 0 });
    worker.postMessage({ id, name, script, scene: sceneContext(activeRoom, session.sceneStates[activeRoom.id] ?? {}), game: { state: { ...session.gameState } }, trigger: fired });
  });
  const eventQueue = createLatestEventQueue<{ fired: FiredTrigger; budget: { remaining: number; warned: boolean } }>(
    async (eventId, { fired, budget }) => {
      const event = authoredEvents.find(item => item.id === eventId);
      if (!event) return;
      const task = execution.then(async () => {
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
        commitRoomElements(next.room, next.elementsChanged);
        session.sceneStates[activeRoom.id] = next.sceneState;
        session.gameState = next.gameState;
        for (const change of [...stateChangeTriggers('scene', beforeSceneState, next.sceneState), ...stateChangeTriggers('game', beforeGameState, next.gameState)]) dispatch(change, budget);
      });
      execution = task.catch(() => {});
      await task;
    },
    (eventId, error) => { if (!disposed) { eventError = true; onError(`Event "${authoredEvents.find(item => item.id === eventId)?.name ?? eventId}": ${error instanceof Error ? error.message : 'Script failed.'}`); } },
  );
  const dispatch = (fired: FiredTrigger, budget = { remaining: 64, warned: false }) => {
    for (const event of matchingEvents(authoredEvents, fired)) eventQueue.signal(event.id, { fired, budget });
  };
  const endPositionSampling = () => {
    if (!positionMoving) return;
    positionMoving = false;
    if (positionTimer !== null) { window.clearInterval(positionTimer); positionTimer = null; }
    dispatch({ type: 'character_position', x: playerPosition.x, y: playerPosition.y, phase: 'end' });
  };
  const onPlayerAction = (event: Event) => {
    const fired = (event as CustomEvent<FiredTrigger>).detail;
    if (fired && 'action' in fired && typeof fired.action === 'string' && typeof fired.target === 'string') dispatch(fired);
  };
  stage.addEventListener('pcag:player-action', onPlayerAction);
  const onDebugging = (event: Event) => {
    debugging = (event as CustomEvent<boolean>).detail === true;
    if (!debugging) debugPath?.clear();
  };
  stage.addEventListener('pcag:debug-walk-path', onDebugging);
  stage.setAttribute('aria-label', activeRoom.name);
  onInspect(null);
  const showAction = () => {
    const blocked = hoveredElement ? !actionChoices(hoveredElement.availableActions ?? ['view']).length : !pointerWalkable;
    const text = blocked ? null : hoveredElement ? `${playerActionLabels[selectedAction].replace('Player: ', '')} ${hoveredElement.name ?? hoveredElement.element_id}` : 'Move to here';
    onActionHint?.(text);
    const cursor = actionCursors?.[blocked ? 'empty' : selectedAction] ?? (blocked ? 'not-allowed' : selectedAction === 'move_to' ? 'crosshair' : 'pointer');
    stage.style.cursor = cursor;
    if (game?.canvas) game.canvas.style.cursor = cursor;
  };
  const hoverElement = (element: Element | null) => {
    hoveredElement = element;
    selectedAction = element ? actionChoices(element.availableActions ?? ['view'])[0] ?? 'move_to' : 'move_to';
    showAction();
  };
  const onWheel = (event: WheelEvent) => {
    if (!hoveredElement || !event.deltaY) return;
    const choices = actionChoices(hoveredElement.availableActions ?? ['view']);
    if (choices.length < 2) return;
    event.preventDefault();
    if (performance.now() - lastWheel < 120) return;
    lastWheel = performance.now();
    selectedAction = cycleAction(choices, selectedAction, event.deltaY);
    showAction();
  };
  stage.addEventListener('wheel', onWheel, { passive: false });
  const onPointerLeave = () => hoverElement(null);
  stage.addEventListener('pointerleave', onPointerLeave);
  const cursorsReady = loadActionCursors().then(cursors => { if (!disposed) { actionCursors = cursors; showAction(); } }).catch(() => {});
  showAction();

  class RoomScene extends Phaser.Scene {
    preload() {
      if (!this.textures.exists('background')) {
        if (asset!.path.toLowerCase().endsWith('.svg')) this.load.svg('background', backgroundUrl, { width: activeRoom.width, height: activeRoom.height });
        else this.load.image('background', backgroundUrl);
      }
      atlases.clear();
      for (const [name, animation] of playerAnimations) animation.frames.forEach((url, index) => {
        const key = `player-${name}-${index}`;
        if (!this.textures.exists(key)) this.load.image(key, url);
      });
      for (const element of activeRoom.elements) {
        if (element.type !== 'image' && element.type !== 'overlay' || !element.media?.path) continue;
        const key = `element-${element.game_id}`;
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
          atlases.set(element.game_id, { image, width: info.frameWidth, height: info.frameHeight, count: info.frames.length, fps: info.fps });
          this.load.spritesheet(key, image, { frameWidth: info.frameWidth, frameHeight: info.frameHeight });
        }
      }
      this.load.once('loaderror', () => { if (!disposed) onError('A scene image could not be loaded.'); });
    }

    create() {
      if (!this.textures.exists('background')) return;
      for (const control of animationControls.values()) control.cancel();
      animationControls.clear();
      renderedElements.clear();
      elementHitAreas.clear();
      currentScene = this;
      debugPath = null;
      this.registry.set('pcag-state', session);
      this.add.image(activeRoom.width / 2, activeRoom.height / 2, 'background').setDisplaySize(activeRoom.width, activeRoom.height).setDepth(0);
      const authoredPlayer = activeRoom.player;
      const playerLayer = authoredPlayer?.layer ?? activeRoom.elements.length;
      let playerSprite: Phaser.GameObjects.Sprite | null = null;
      let playerTween: Phaser.Tweens.Tween | null = null;
      let journey = 0;
      const playCharacter = (name: string) => {
        if (!playerSprite) return;
        const animation = playerAnimations.get(name);
        if (!animation?.frames.length) return;
        const key = `player-animation-${name}`;
        if (animation.frames.length > 1) {
          if (!this.anims.exists(key)) this.anims.create({ key, frames: animation.frames.map((_, index) => ({ key: `player-${name}-${index}` })), frameRate: animation.fps, repeat: -1 });
          playerSprite.play(key);
        } else { playerSprite.stop(); playerSprite.setTexture(`player-${name}-0`); }
        playerSprite.setFlipX(animation.mirrorX);
        playerSprite.setData('displayHeight', animation.height);
      };
      const updatePlayerScale = () => {
        if (!playerSprite || !authoredPlayer) return;
        const factor = walkableScale(walkMask, playerSprite.x, playerSprite.y) ?? 1;
        playerSprite.setScale((Number(playerSprite.getData('displayHeight')) || 160) * authoredPlayer.scale * factor / playerSprite.frame.height);
      };
      const idle = playerAnimations.get('idle') ?? playerAnimations.values().next().value;
      if (authoredPlayer && idle?.frames.length && this.textures.exists(`player-${playerAnimations.has('idle') ? 'idle' : [...playerAnimations.keys()][0]}-0`)) {
        const firstName = playerAnimations.has('idle') ? 'idle' : [...playerAnimations.keys()][0]!;
        playerSprite = this.add.sprite(playerPosition.x, playerPosition.y, `player-${firstName}-0`).setOrigin(authoredPlayer.anchor?.x ?? 0.5, authoredPlayer.anchor?.y ?? 1).setDepth(playerLayer + 1);
        playCharacter(firstName);
        updatePlayerScale();
      }
      const walkTo = (pointer: Phaser.Input.Pointer) => {
        if (!playerSprite || !authoredPlayer || disposed) return;
        if (walkableScale(walkMask, pointer.worldX, pointer.worldY) === null) return;
        const route = walkablePath(walkMask, playerPosition, { x: Math.max(0, Math.min(activeRoom.width - 1, pointer.worldX)), y: Math.max(0, Math.min(activeRoom.height - 1, pointer.worldY)) });
        if (!route.length) return;
        if (debugging) {
          const points = [playerPosition, ...route];
          const end = route.at(-1)!;
          const graphics = debugPath ??= this.add.graphics().setDepth(activeRoom.elements.length + 20);
          graphics.clear();
          for (const [width, color] of [[6, 0x081321], [3, 0xf4d178]]) {
            graphics.lineStyle(width!, color!, 1).beginPath().moveTo(points[0]!.x, points[0]!.y);
            for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
            graphics.strokePath();
          }
          graphics.fillStyle(0x081321).fillCircle(points[0]!.x, points[0]!.y, 10).fillCircle(end.x, end.y, 10);
          graphics.fillStyle(0x48dbc3).fillCircle(points[0]!.x, points[0]!.y, 7);
          graphics.fillStyle(0xffc76a).fillCircle(end.x, end.y, 7);
        }
        const activeJourney = ++journey;
        if (playerTween) { playerTween.stop(); endPositionSampling(); }
        positionMoving = true;
        dispatch({ type: 'character_position', x: playerPosition.x, y: playerPosition.y, phase: 'start' });
        positionTimer = window.setInterval(() => dispatch({ type: 'character_position', x: playerPosition.x, y: playerPosition.y, phase: 'move' }), 60);
        const walk = (index: number) => {
          const destination = route[index]!;
          const dx = destination.x - playerPosition.x, dy = destination.y - playerPosition.y;
          const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'walk right' : 'walk left' : dy > 0 ? 'walk front' : 'walk back';
          if (playerAnimations.has(direction)) playCharacter(direction);
          const distance = Math.hypot(dx, dy);
          playerTween = this.tweens.add({ targets: playerSprite, x: destination.x, y: destination.y, duration: Math.max(80, distance / 180 * 1000), onUpdate: () => { if (playerSprite) { playerPosition = { x: playerSprite.x, y: playerSprite.y }; updatePlayerScale(); } }, onComplete: () => {
            if (activeJourney !== journey) return;
            playerPosition = destination;
            if (index + 1 < route.length) walk(index + 1);
            else { playCharacter('idle'); updatePlayerScale(); playerTween = null; endPositionSampling(); }
          } });
        };
        walk(0);
      };
      pointerWalkable = true;
      hoverElement(null);
      this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
        const next = walkableScale(walkMask, pointer.worldX, pointer.worldY) !== null;
        if (pointerWalkable !== next) { pointerWalkable = next; showAction(); }
      });
      for (const [index, element] of activeRoom.elements.entries()) {
        const { x, y, width, height } = element.bounds;
        const key = `element-${element.game_id}`;
        if (element.type === 'overlay') {
          // Overlay artwork never owns an input hit area, regardless of its layer.
          if (this.textures.exists(key)) renderedElements.set(element.game_id, this.add.image(activeRoom.width / 2, activeRoom.height / 2, key).setDisplaySize(activeRoom.width, activeRoom.height).setDepth(index + 1 + Number(index >= playerLayer)).setVisible(element.visible !== false && element.enabled !== false).disableInteractive());
          continue;
        }
        if (element.type === 'image' && this.textures.exists(key)) {
          const atlas = atlases.get(element.game_id);
          if (atlas) {
            const frames = Array.from({ length: atlas.count }, (_, frame) => frame);
            if (element.media?.reverse) frames.reverse();
            const animationKey = `animation-${element.game_id}`;
            if (this.anims.exists(animationKey)) this.anims.remove(animationKey);
            this.anims.create({ key: animationKey, frames: frames.map(frame => ({ key, frame })), frameRate: atlas.fps, repeat: element.media?.loop ? -1 : 0, skipMissedFrames: false });
            const sprite = this.add.sprite(x + width / 2, y + height / 2, key, frames[0]).setDisplaySize(width, height).setDepth(index + 1 + Number(index >= playerLayer)).setVisible(element.visible !== false);
            renderedElements.set(element.game_id, sprite);
            const media = element.media!;
            const previous = animationStates.get(element.game_id);
            const state: AnimationState = previous && previous.uri === media.path && previous.loop === media.loop && previous.reverse === media.reverse
              ? previous : { uri: media.path, loop: media.loop, reverse: media.reverse, phase: media.loop ? 'loop' : 'first' };
            animationStates.set(element.game_id, state);
            let resolveRun: (() => void) | null = null;
            let onComplete: (() => void) | null = null;
            const cancel = () => {
              if (onComplete) sprite.off(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
              onComplete = null;
              resolveRun?.();
              resolveRun = null;
            };
            const stop = () => { cancel(); sprite.stop(); sprite.setFrame(frames[0]!); state.phase = 'first'; };
            const play = (): Promise<void> => {
              if (media.loop) {
                if (!sprite.anims.isPlaying) sprite.play(animationKey);
                state.phase = 'loop';
                return Promise.resolve();
              }
              stop();
              if (frames.length < 2) { sprite.setFrame(frames.at(-1)!); state.phase = 'last'; return Promise.resolve(); }
              state.phase = 'playing';
              return new Promise(resolve => {
                resolveRun = resolve;
                onComplete = () => { onComplete = null; sprite.setFrame(frames.at(-1)!); state.phase = 'last'; resolveRun?.(); resolveRun = null; };
                sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
                sprite.play(animationKey);
              });
            };
            animationControls.set(element.game_id, { play, stop, cancel });
            if (state.phase === 'loop' && media.loop) sprite.play(animationKey);
            else if (state.phase === 'last' && !media.loop) sprite.setFrame(frames.at(-1)!);
          } else renderedElements.set(element.game_id, this.add.image(x + width / 2, y + height / 2, key).setDisplaySize(width, height).setDepth(index + 1 + Number(index >= playerLayer)).setVisible(element.visible !== false));
        }
        const area = element.type === 'shape' && element.vertices
          ? this.add.zone(activeRoom.width / 2, activeRoom.height / 2, activeRoom.width, activeRoom.height).setDepth(index + 1 + Number(index >= playerLayer)).setInteractive(new Phaser.Geom.Polygon(element.vertices), Phaser.Geom.Polygon.Contains)
          : this.add.zone(x + width / 2, y + height / 2, width, height).setDepth(index + 1 + Number(index >= playerLayer)).setInteractive();
        elementHitAreas.set(element.game_id, area);
        if (element.visible === false || element.enabled === false) area.disableInteractive();
        area.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => hoverElement(element));
        area.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => { if (hoveredElement?.game_id === element.game_id) hoverElement(null); });
        area.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, (pointer: Phaser.Input.Pointer, _x: unknown, _y: unknown, inputEvent: { stopPropagation: () => void }) => {
          inputEvent.stopPropagation();
          if (disposed) return;
          const action = hoveredElement?.game_id === element.game_id ? selectedAction : actionChoices(element.availableActions ?? ['view'])[0];
          if (!action || !(element.availableActions ?? ['view']).includes(action)) return;
          onInspect(action === 'view' ? `You see ${element.name ?? element.element_id}.` : null);
          dispatch({ action: `player_${action}`, target: element.game_id });
          if (action === 'move_to') walkTo(pointer);
        });
      }
      this.input.on(Phaser.Input.Events.POINTER_DOWN, walkTo);
      // A loaded texture can still incur its first GPU upload during rendering. Warm every
      // scene texture behind the background, including hidden elements and character frames.
      const warmKeys = new Set<string>();
      for (const element of activeRoom.elements) if (element.media?.path) warmKeys.add(`element-${element.game_id}`);
      for (const [name, animation] of playerAnimations) animation.frames.forEach((_, index) => warmKeys.add(`player-${name}-${index}`));
      const warmImages = [...warmKeys].filter(key => this.textures.exists(key)).map(key => this.add.image(0, 0, key).setOrigin(0).setDisplaySize(1, 1).setDepth(-1000));
      this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
        for (const image of warmImages) image.destroy();
        this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
          if (disposed) return;
          sceneRebuilding = false;
          for (const waiter of sceneReadyWaiters) { window.clearTimeout(waiter.timer); waiter.resolve(); }
          sceneReadyWaiters.clear();
          if (!started) {
            started = true;
            void (async () => {
              await onSceneLoaded?.();
              if (disposed) return;
              dispatch({ action: 'game_load' });
              dispatch({ action: 'scene_load' });
              let observed: Promise<void>;
              do { observed = execution; await eventQueue.whenIdle(); } while (execution !== observed);
              if (!disposed && !eventError) onReady?.();
            })().catch(error => { if (!disposed) onError(error instanceof Error ? error.message : 'Could not present the scene.'); });
          }
        });
      });
    }
  }
  void (async () => {
    if (room.walkableArea?.path) {
      const url = assetUrls.get(room.walkableArea.path);
      if (!url) throw new Error('The Walkable Area image is unavailable.');
      walkMask = await loadWalkablePixels(url, backgroundUrl, room.width, room.height, room.walkableArea.minScale, room.walkableArea.maxScale);
    }
    for (const animation of playerCharacter?.animations.filter(item => ['idle', 'walk front', 'walk back', 'walk right', 'walk left'].includes(item.key.toLowerCase())) ?? []) {
      const url = assetUrls.get(animation.path);
      if (!url) continue;
      const decoded = await characterFrames(url);
      playerAnimations.set(animation.key.toLowerCase(), { ...decoded, height: animation.height, mirrorX: animation.mirrorX });
    }
    await cursorsReady;
    if (disposed) return;
    game = new Phaser.Game({
      type: Phaser.AUTO, parent: stage, width: activeRoom.width, height: activeRoom.height,
      backgroundColor: '#14263c', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      audio: { noAudio: true }, banner: false, scene: RoomScene,
    });
  })().catch(reason => { if (!disposed) onError(reason instanceof Error ? reason.message : 'Could not load the player or Walkable Area.'); });
  return () => {
    if (disposed) return;
    endPositionSampling();
    dispatch({ action: 'scene_close' });
    dispatch({ action: 'game_close' });
    disposed = true;
    for (const waiter of sceneReadyWaiters) { window.clearTimeout(waiter.timer); waiter.reject(new Error('The scene was closed before its animations loaded.')); }
    sceneReadyWaiters.clear();
    stage.removeEventListener('pcag:player-action', onPlayerAction);
    stage.removeEventListener('pcag:debug-walk-path', onDebugging);
    stage.removeEventListener('wheel', onWheel);
    stage.removeEventListener('pointerleave', onPointerLeave);
    stage.style.removeProperty('cursor');
    onActionHint?.(null);
    game?.destroy(true);
    stage.replaceChildren();
    void eventQueue.whenIdle().finally(() => worker?.terminate());
  };
}
