export interface WalkablePixels { width: number; height: number; sceneWidth?: number; sceneHeight?: number; data: Uint8ClampedArray; minScale: number; maxScale: number }

export async function loadWalkablePixels(url: string, backgroundUrl: string, sceneWidth: number, sceneHeight: number, minScale: number, maxScale: number): Promise<WalkablePixels> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  try {
    const background = new Image();
    background.src = backgroundUrl;
    await background.decode();
    if (bitmap.width !== background.naturalWidth || bitmap.height !== background.naturalHeight) throw new Error(`Walkable Area image must be exactly ${background.naturalWidth} × ${background.naturalHeight} pixels, matching the background.`);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, sceneWidth, sceneHeight, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, minScale, maxScale };
  } finally { bitmap.close(); }
}

export function walkableScale(mask: WalkablePixels | null, x: number, y: number): number | null {
  if (!mask) return 1;
  const px = Math.round(x * (mask.width - 1) / ((mask.sceneWidth ?? mask.width) - 1 || 1));
  const py = Math.round(y * (mask.height - 1) / ((mask.sceneHeight ?? mask.height) - 1 || 1));
  if (px < 0 || py < 0 || px >= mask.width || py >= mask.height) return null;
  const index = (py * mask.width + px) * 4;
  if (mask.data[index + 3] === 0) return null;
  const luminance = (0.2126 * mask.data[index]! + 0.7152 * mask.data[index + 1]! + 0.0722 * mask.data[index + 2]!) / 255;
  return mask.maxScale + (mask.minScale - mask.maxScale) * luminance;
}

/** Follow the direct line only while every sampled foot position is walkable. */
export function walkableDestination(mask: WalkablePixels | null, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } | null {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y));
  if (!steps) return null;
  let last = from;
  for (let step = 1; step <= steps; step++) {
    const point = { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps };
    if (walkableScale(mask, point.x, point.y) === null) break;
    last = point;
  }
  return last === from ? null : last;
}

export function walkablePath(mask: WalkablePixels | null, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  if (walkableScale(mask, to.x, to.y) === null) return [];
  const clear = (a: typeof from, b: typeof to) => {
    const last = walkableDestination(mask, a, b);
    return !!last && Math.hypot(last.x - b.x, last.y - b.y) < 0.5;
  };
  if (clear(from, to)) return [to];
  if (!mask) return [];
  const width = mask.sceneWidth ?? mask.width, height = mask.sceneHeight ?? mask.height;
  const step = Math.max(1, Math.round(Math.min(width, height) / 150));
  const columns = Math.ceil(width / step), rows = Math.ceil(height / step), total = columns * rows;
  const point = (index: number) => ({ x: Math.min(width - 1, (index % columns + 0.5) * step), y: Math.min(height - 1, (Math.floor(index / columns) + 0.5) * step) });
  const index = (x: number, y: number) => Math.min(rows - 1, Math.floor(y / step)) * columns + Math.min(columns - 1, Math.floor(x / step));
  const start = index(from.x, from.y);
  const previous = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total);
  let head = 0, tail = 0, reached = -1;
  queue[tail++] = start;
  previous[start] = start;
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (head < tail) {
    const current = queue[head++]!;
    const center = point(current);
    if (Math.hypot(center.x - to.x, center.y - to.y) <= step * 2 && clear(center, to)) { reached = current; break; }
    const column = current % columns, row = Math.floor(current / columns);
    for (const [dx, dy] of directions) {
      const nx = column + dx!, ny = row + dy!;
      if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue;
      const next = ny * columns + nx;
      if (previous[next] !== -1 || walkableScale(mask, point(next).x, point(next).y) === null || !clear(center, point(next))) continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (reached < 0) return [];
  const cells: number[] = [];
  for (let current = reached; current !== start; current = previous[current]!) cells.push(current);
  const raw = [from, ...cells.reverse().map(point), to];
  const result: typeof raw = [];
  for (let at = 0; at < raw.length - 1;) {
    let next = raw.length - 1;
    while (next > at + 1 && !clear(raw[at]!, raw[next]!)) next--;
    result.push(raw[next]!);
    at = next;
  }
  let last = from;
  for (const next of result) { if (!clear(last, next)) return []; last = next; }
  return result;
}
