import Phaser from 'phaser';
import './styles.css';

const stage = document.getElementById('stage');
const status = document.getElementById('status');
if (!stage || !status) throw new Error('Player shell elements are missing.');

// A boot probe only. The shared adventure presentation belongs to F04.
class BootScene extends Phaser.Scene {
  create() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x344854);
    for (let x = 0; x <= 960; x += 48) graphics.lineBetween(x, 0, x, 360);
    for (let y = 0; y <= 360; y += 48) graphics.lineBetween(0, y, 960, y);
    graphics.fillStyle(0xcba76b);
    graphics.fillTriangle(480, 120, 452, 168, 508, 168);
    graphics.fillStyle(0x769a94);
    graphics.fillTriangle(452, 176, 508, 176, 480, 224);
    status!.textContent = 'Ready for a story. No adventure is loaded yet.';
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: stage,
  width: 960,
  height: 360,
  backgroundColor: '#1e2b35',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
  banner: false,
  scene: BootScene,
});

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
