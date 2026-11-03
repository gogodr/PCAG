import { createId } from '../../project-format/src/index';
import { ROOT_FOLDERS } from './index';
import type { Workspace } from './index';

const blankPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=';

export function starterWorkspace(name: string): Workspace {
  const projectId = createId();
  const backgroundId = createId();
  const sceneId = createId();
  const path = 'backgrounds/blank.png';
  return {
    format: 'pcag-workspace', version: 1, targetWidth: 1600, targetHeight: 900,
    project: {
      schemaVersion: 1, id: projectId, name, startRoomId: sceneId, gameState: {},
      assets: [{ id: backgroundId, name: 'Blank background', kind: 'image', path }],
      rooms: [{ id: sceneId, name: 'Scene 1', width: 1600, height: 900, backgroundAssetId: backgroundId, elements: [], player: { characterId: '', position: { x: 800, y: 765 }, anchor: { x: 0.5, y: 1 }, scale: 1, layer: 0 }, walkableArea: { path: '', minScale: 0.5, maxScale: 1.5 }, sceneState: {}, sceneManager: { events: [] } }],
    },
    folders: [...ROOT_FOLDERS],
    files: [{ id: backgroundId, path, mime: 'image/png', dataUrl: `data:image/png;base64,${blankPng}` }],
  };
}
