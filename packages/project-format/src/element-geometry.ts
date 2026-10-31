import type { Bounds, Point } from './index';

export function polygonBounds(vertices: readonly Point[]): Bounds {
  const xs = vertices.map(point => point.x);
  const ys = vertices.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(1, Math.max(...xs) - x), height: Math.max(1, Math.max(...ys) - y) };
}

export function movePolygon(vertices: readonly Point[], dx: number, dy: number, width: number, height: number): Point[] {
  const bounds = polygonBounds(vertices);
  const x = Math.max(-bounds.x, Math.min(dx, width - bounds.x - bounds.width));
  const y = Math.max(-bounds.y, Math.min(dy, height - bounds.y - bounds.height));
  return vertices.map(point => ({ x: point.x + x, y: point.y + y }));
}
