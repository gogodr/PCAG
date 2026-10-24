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
      schemaVersion: 1, id: projectId, name, startRoomId: sceneId,
      assets: [{ id: backgroundId, name: 'Blank background', kind: 'image', path }],
      rooms: [{ id: sceneId, name: 'Scene 1', width: 1600, height: 900, backgroundAssetId: backgroundId, hotspots: [] }],
    },
    folders: [...ROOT_FOLDERS],
    files: [{ id: backgroundId, path, mime: 'image/png', dataUrl: `data:image/png;base64,${blankPng}` }],
  };
}
