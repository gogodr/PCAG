import Phaser from 'phaser';
import { AdventureSession } from '../../adventure-core/src/index';
import { type Project, type Point, type Hotspot } from '../../project-format/src/index';
import './player.css';

export interface PlayerHandle { dispose(): void }

export function mountPlayer(host: HTMLElement, project: Project): PlayerHandle {
  const session = new AdventureSession(project), actor = session.project.protagonist!;
  let disposed = false, selected: 'walk' | 'inspect' = 'walk', focused: Hotspot | null = null, wasWalking = false;
  let audio: AudioContext | undefined, activeRoom = '', scene: RoomScene | undefined, marker: Point = { ...session.position };
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  const button = (text: string, action: () => void, className = '') => { const b = el('button', className, text); b.type = 'button'; b.onclick = action; return b; };
  const root = el('section', 'pcag-player'); root.setAttribute('aria-label', 'Adventure player');
  const heading = el('div', 'pcag-player-heading'), title = el('strong'), hint = el('span', '', 'Click to walk · Choose View to observe'); heading.append(title, hint);
  const viewport = el('div', 'pcag-viewport'), canvasHost = el('div', 'pcag-canvas'), targets = el('div', 'pcag-hotspots');
  // Establish parent dimensions before Phaser measures it during boot.
  viewport.style.aspectRatio = `${session.room.width} / ${session.room.height}`;
  viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Walk destination. Use arrow keys to move the marker, then Enter to walk.');
  const actorStatus = el('span', 'pcag-actor-status'); actorStatus.setAttribute('aria-label', `Playable character ${actor.name}`);
  const destination = el('span', 'pcag-destination', '＋'); destination.hidden = true;
  viewport.append(canvasHost, targets, actorStatus, destination);
  const sentence = el('div', 'pcag-sentence');
  const command = el('span', 'pcag-command', 'Walk to…'); command.setAttribute('role', 'status');
  const cancel = button('Cancel', () => { session.cancel(); selected = 'walk'; focused = null; updateControls(); }); sentence.append(command, cancel);
  const hud = el('div', 'pcag-hud'), verbs = el('div', 'pcag-verbs'), inventory = el('div', 'pcag-inventory');
  const walk = button('Walk to', () => choose('walk'));
  const view = button('View', () => choose('inspect'));
  const quick = button('View focused object', () => { if (focused) inspect(focused); }); quick.hidden = true;
  verbs.append(walk, view, quick);
  inventory.append(el('strong', '', 'Inventory'), el('p', '', 'No items yet.'));
  hud.append(verbs, inventory);
  const caption = el('p', 'pcag-caption'); caption.setAttribute('role', 'status');
  const controls = el('div', 'pcag-player-controls');
  const sound = button('Test sound', () => { void testSound(); });
  const clear = button('Clear response', () => { session.speech = 'Look around. Every object has a story.'; sync(); });
  controls.append(sound, clear);
  root.append(heading, viewport, sentence, hud, caption, controls); host.append(root);

  function choose(verb: 'walk' | 'inspect') { session.cancel(); selected = verb; updateControls(); }
  function updateControls() {
    walk.setAttribute('aria-pressed', String(selected === 'walk')); view.setAttribute('aria-pressed', String(selected === 'inspect'));
    command.textContent = `${selected === 'walk' ? 'Walk to' : 'View'} ${focused?.name ?? '…'}`;
    quick.hidden = !focused || selected !== 'walk';
    if (focused) quick.textContent = `View ${focused.name}`;
    for (const target of targets.querySelectorAll<HTMLButtonElement>('[data-hotspot]')) target.setAttribute('aria-label', `${selected === 'walk' ? 'Walk to' : 'View'} ${target.dataset.name}`);
  }
  function inspect(h: Hotspot) {
    session.act({ actorId: 'player', action: 'inspect', targetId: h.id }); selected = 'walk'; focused = null; updateControls(); sync();
  }
  function groundPoint(event: MouseEvent): Point {
    const rect = viewport.getBoundingClientRect();
    return { x: Math.max(0, Math.min(session.room.width, (event.clientX - rect.left) / rect.width * session.room.width)), y: Math.max(0, Math.min(session.room.height, (event.clientY - rect.top) / rect.height * session.room.height)) };
  }
  viewport.addEventListener('click', event => {
    if ((event.target as HTMLElement).closest('button')) return;
    selected = 'walk'; focused = null; updateControls(); session.walkTo(groundPoint(event)); sync();
  });
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport) return;
    const deltas: Record<string, Point> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
    if (deltas[event.key]) {
      event.preventDefault(); const d = deltas[event.key]; marker = { x: Math.max(0, Math.min(session.room.width, marker.x + d.x)), y: Math.max(0, Math.min(session.room.height, marker.y + d.y)) };
      destination.hidden = false; destination.style.left = `${marker.x / session.room.width * 100}%`; destination.style.top = `${marker.y / session.room.height * 100}%`;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); selected = 'walk'; focused = null; updateControls(); session.walkTo(marker); sync();
    }
  });
  root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); session.cancel(); selected = 'walk'; focused = null; updateControls(); sync(); } });

  function renderRoom() {
    const room = session.room; activeRoom = room.id; title.textContent = room.name;
    root.dataset.roomId = room.id; viewport.style.aspectRatio = `${room.width} / ${room.height}`;
    targets.replaceChildren(); marker = { ...session.position }; destination.hidden = true; focused = null; selected = 'walk';
    for (const h of room.hotspots.filter(h => h.enabled)) {
      const b = button('', () => { if (selected === 'inspect') inspect(h); else { session.walkToTarget(h.id); sync(); } }, 'pcag-hotspot');
      b.dataset.hotspot = h.id; b.dataset.name = h.name;
      b.style.left = `${h.x / room.width * 100}%`; b.style.top = `${h.y / room.height * 100}%`; b.style.width = `${h.width / room.width * 100}%`; b.style.height = `${h.height / room.height * 100}%`;
      const label = el('span', '', h.name); b.append(label);
      const focus = () => { focused = h; updateControls(); };
      b.onmouseenter = focus; b.onfocus = focus;
      // Retain the last focused target while moving to its visible quick action.
      // Clearing on mouseleave would remove that button before it can be clicked.
      b.oncontextmenu = event => { event.preventDefault(); if (selected !== 'walk') { choose('walk'); } else inspect(h); };
      targets.append(b);
    }
    for (const exit of room.exits) {
      const b = button(exit.name + ' →', () => { selected = 'walk'; focused = null; updateControls(); session.walkToTarget(exit.id); sync(); }, 'pcag-exit');
      b.setAttribute('aria-label', `Exit ${exit.name}`); b.style.left = `${exit.x / room.width * 100}%`; b.style.top = `${exit.y / room.height * 100}%`; b.style.width = `${exit.width / room.width * 100}%`; b.style.height = `${exit.height / room.height * 100}%`; targets.append(b);
    }
    updateControls();
  }
  function sync() {
    if (disposed) return;
    if (activeRoom !== session.roomId) { renderRoom(); scene?.buildRoom(); }
    actorStatus.dataset.x = session.position.x.toFixed(2); actorStatus.dataset.y = session.position.y.toFixed(2); actorStatus.dataset.mode = session.mode;
    actorStatus.style.left = `${session.position.x / session.room.width * 100}%`; actorStatus.style.top = `${session.position.y / session.room.height * 100}%`;
    caption.textContent = `${actor.name}: ${session.speech}`;
    if (session.isWalking) command.textContent = session.command;
    else if (wasWalking) updateControls();
    wasWalking = session.isWalking;
  }
  const resizeObserver = new ResizeObserver(() => {
    if (!disposed && scene) { scene.scale.getParentBounds(); scene.scale.refresh(); }
  });
  resizeObserver.observe(viewport);
  async function testSound() {
    try {
      audio ??= new AudioContext(); await audio.resume(); if (disposed) return;
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.frequency.value = 440; gain.gain.setValueAtTime(.06, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .25);
      oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .25);
      session.speech = audio.state === 'running' ? 'Sound is ready.' : 'Sound is unavailable in this browser.'; sync();
    } catch { if (!disposed) { session.speech = 'Sound is unavailable. You can still play with text.'; sync(); } }
  }

  class RoomScene extends Phaser.Scene {
    sprite?: Phaser.GameObjects.Sprite;
    constructor() { super('room'); }
    preload() {
      for (const asset of session.project.assets) this.load.image(asset.id, asset.dataUrl);
      for (const mode of ['idle', 'walk', 'talk'] as const) {
        const mapping = actor.animations[mode], asset = session.project.assets.find(a => a.id === mapping.assetId)!;
        this.load.spritesheet(`actor-${mode}`, asset.dataUrl, { frameWidth: mapping.frameWidth, frameHeight: mapping.frameHeight });
      }
    }
    create() {
      if (disposed) return;
      scene = this;
      for (const mode of ['idle', 'walk', 'talk'] as const) {
        const map = actor.animations[mode];
        this.anims.create({ key: mode, frames: map.frames.map(frame => ({ key: `actor-${mode}`, frame })), frameRate: map.fps, repeat: -1 });
      }
      this.buildRoom(); renderRoom(); sync();
      canvasHost.querySelector('canvas')?.setAttribute('aria-hidden', 'true'); root.dataset.ready = 'true';
    }
    buildRoom() {
      this.children.removeAll(true);
      const room = session.room; this.scale.setGameSize(room.width, room.height);
      this.scale.getParentBounds(); this.scale.refresh();
      if (room.backgroundAssetId && this.textures.exists(room.backgroundAssetId)) this.add.image(0, 0, room.backgroundAssetId).setOrigin(0).setDisplaySize(room.width, room.height);
      else {
        this.add.rectangle(0, 0, room.width, room.height, 0x20343b).setOrigin(0);
        this.add.rectangle(0, room.height * .68, room.width, room.height * .32, 0x33464b).setOrigin(0);
        this.add.text(room.width / 2, room.height * .3, room.name, { fontFamily: 'Georgia, serif', fontSize: '32px', color: '#b3c6c9' }).setOrigin(.5);
      }
      this.sprite = this.add.sprite(session.position.x, session.position.y, 'actor-idle', actor.animations.idle.frames[0]).setOrigin(actor.feetX, actor.feetY);
      this.sprite.setDepth(1);
      for (const layer of room.layers) this.add.image(layer.x, layer.y, layer.assetId).setOrigin(0).setDisplaySize(layer.width, layer.height).setDepth(layer.depth === 'front' ? 2 : 0);
    }
    update(_time: number, delta: number) {
      if (disposed) return;
      session.update(Math.min(delta, 100)); sync();
      if (this.sprite) {
        this.sprite.setPosition(session.position.x, session.position.y).setFlipX(session.facing === 'left');
        this.sprite.play(session.mode, true);
        const mapping = actor.animations[session.mode]; this.sprite.setDisplaySize(actor.height * mapping.frameWidth / mapping.frameHeight, actor.height);
      }
    }
  }
  const game = new Phaser.Game({ type: Phaser.CANVAS, parent: canvasHost, width: session.room.width, height: session.room.height, backgroundColor: '#20343b', banner: false, audio: { noAudio: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER }, scene: RoomScene });
  return { dispose() { if (disposed) return; disposed = true; resizeObserver.disconnect(); session.dispose(); if (audio && audio.state !== 'closed') void audio.close(); game.destroy(true); root.remove(); } };
}
