import type { PlayerAction } from '../../project-format/src/index';
import actionCursorSheetUrl from '../assets/action-cursors.png';
import emptyCrosshairUrl from '../assets/empty-crosshair.png';

const cells: Record<PlayerAction, number> = { view: 0, move_to: 1, talk_to: 2, push: 3, pull: 4, open: 5, close: 6, give: 7, use: 8 };
export type CursorKey = PlayerAction | 'empty';
let cursors: Promise<Record<CursorKey, string>> | null = null;

export function actionChoices(available: readonly PlayerAction[]): PlayerAction[] {
  const first = available.includes('view') ? 'view' : available.includes('move_to') ? 'move_to' : available[0];
  return first ? [first, ...available.filter(action => action !== first)] : [];
}

export function cycleAction(choices: readonly PlayerAction[], current: PlayerAction, direction: number): PlayerAction {
  if (!choices.length) return current;
  const index = Math.max(0, choices.indexOf(current));
  return choices[(index + (direction > 0 ? 1 : choices.length - 1)) % choices.length]!;
}

/** Crop the generated sprite sheet to native CSS cursors once per player page. */
export function loadActionCursors(): Promise<Record<CursorKey, string>> {
  cursors ??= Promise.all([actionCursorSheetUrl, emptyCrosshairUrl].map(url => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Cursor artwork could not be loaded.'));
    image.src = url;
  }))).then(([image, crosshair]) => {
      const output = {} as Record<CursorKey, string>;
      const canvas = document.createElement('canvas');
      canvas.width = 48; canvas.height = 40;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Cursor artwork could not be prepared.');
      context.imageSmoothingEnabled = false;
      for (const [action, cell] of Object.entries(cells) as [PlayerAction, number][]) {
        context.clearRect(0, 0, 48, 40);
        context.drawImage(image!, cell % 3 * image!.width / 3, Math.floor(cell / 3) * image!.height / 3, image!.width / 3, image!.height / 3, 0, 0, 48, 40);
        output[action] = `url("${canvas.toDataURL('image/png')}") 24 20, pointer`;
      }
      context.clearRect(0, 0, 48, 40);
      const crop = crosshair!.width * 0.76;
      context.drawImage(crosshair!, (crosshair!.width - crop) / 2, (crosshair!.height - crop) / 2, crop, crop, 4, 0, 40, 40);
      output.empty = `url("${canvas.toDataURL('image/png')}") 24 20, not-allowed`;
      return output;
  });
  return cursors;
}
