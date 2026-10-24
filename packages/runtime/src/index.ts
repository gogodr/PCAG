import Phaser from 'phaser';
import type { Project } from '../../project-format/src/index';

export interface RuntimeOptions {
  project: Project;
  assetUrls: ReadonlyMap<string, string>;
  stage: HTMLElement;
  onInspect: (text: string | null) => void;
  onError: (message: string) => void;
  onReady?: () => void;
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
  const activeRoom = room;
  stage.setAttribute('aria-label', activeRoom.name);
  onInspect(null);
  let disposed = false;
  class RoomScene extends Phaser.Scene {
    preload() {
      if (asset!.path.toLowerCase().endsWith('.svg')) this.load.svg('background', backgroundUrl, { width: activeRoom.width, height: activeRoom.height });
      else this.load.image('background', backgroundUrl);
      this.load.once('loaderror', () => {
        if (!disposed) onError('The room background could not be loaded.');
      });
    }

    create() {
      if (!this.textures.exists('background')) return;
      this.add.image(activeRoom.width / 2, activeRoom.height / 2, 'background').setDisplaySize(activeRoom.width, activeRoom.height).setDepth(0);
      for (const [index, hotspot] of activeRoom.hotspots.entries()) {
        const { x, y, width, height } = hotspot.bounds;
        const area = this.add.zone(x + width / 2, y + height / 2, width, height).setDepth(index + 1).setInteractive({ useHandCursor: true });
        area.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          if (!disposed) onInspect(hotspot.inspect || `You see ${hotspot.name}.`);
        });
      }
      if (!disposed) onReady?.();
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: stage,
    width: activeRoom.width,
    height: activeRoom.height,
    backgroundColor: '#14263c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    banner: false,
    scene: RoomScene,
  });
  return () => {
    disposed = true;
    game.destroy(true);
    stage.replaceChildren();
  };
}
