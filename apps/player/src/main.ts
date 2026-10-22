import Phaser from 'phaser';
import backgroundUrl from './background.svg?no-inline';
import './styles.css';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
if (!stage || !status) throw new Error('Player shell elements are missing.');

// Presentation sample only; project loading and shared runtime belong to F03/F04.
class BootScene extends Phaser.Scene {
  preload() {
    this.load.svg('background', backgroundUrl, { width: 1600, height: 900 });
  }

  create() {
    this.add.image(800, 450, 'background');
    status!.textContent = 'Game view ready.';
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: stage,
  width: 1600,
  height: 900,
  backgroundColor: '#14263c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
  banner: false,
  scene: BootScene,
});

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
