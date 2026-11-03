import { validateProject } from '../../../../packages/project-format/src/index';
import type { Workspace } from '../../../../packages/editor-workspace/src/index';
import { animationAtlasFiles } from '../../../../packages/editor-workspace/src/index';

export function workspaceReadiness(workspace: Workspace | null) {
  if (!workspace) return { projectResult: null, filesPresent: false, resolutionValid: false, ready: false };

  const projectResult = validateProject(workspace.project);
  const filePaths = new Set(workspace.files.map(file => file.path));
  const filesPresent = workspace.project.assets.every(asset => filePaths.has(asset.path))
    && (workspace.project.characters ?? []).every(character => character.animations.every(animation => filePaths.has(animation.path)))
    && workspace.project.rooms.every(room => !room.walkableArea?.path || filePaths.has(room.walkableArea.path))
    && workspace.project.rooms.every(room => room.elements.every(element => {
      if (element.type !== 'image' && element.type !== 'overlay' || !element.media?.path) return true;
      if (!filePaths.has(element.media.path)) return false;
      if (element.media.kind !== 'animation') return true;
      const atlas = workspace.files.find(file => file.path === element.media!.path);
      const companions = atlas && animationAtlasFiles(atlas);
      return !!companions && filePaths.has(companions.image);
    }));
  const resolutionValid = Number.isSafeInteger(workspace.targetWidth) && Number.isSafeInteger(workspace.targetHeight)
    && workspace.targetWidth > 0 && workspace.targetHeight > 0
    && workspace.targetWidth <= 8192 && workspace.targetHeight <= 8192;

  return { projectResult, filesPresent, resolutionValid, ready: projectResult.ok && filesPresent && resolutionValid };
}
