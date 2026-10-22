export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export interface Navigation { walkable: Rect[]; obstacles: Rect[] }
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const contains = (r: Rect, p: Point) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.width && p.y <= r.y + r.height;
export const isWalkable = (nav: Navigation, p: Point) => nav.walkable.some(r => contains(r, p)) && !nav.obstacles.some(r => contains(r, p));

/** Test every interval delimited by rectangle boundaries, not pixel samples. */
export function canTraverse(nav: Navigation, a: Point, b: Point): boolean {
  if (!isWalkable(nav, a) || !isWalkable(nav, b)) return false;
  const cuts = [0, 1];
  for (const r of [...nav.walkable, ...nav.obstacles]) {
    if (a.x !== b.x) for (const x of [r.x, r.x + r.width]) { const t = (x - a.x) / (b.x - a.x); if (t > 0 && t < 1) cuts.push(t); }
    if (a.y !== b.y) for (const y of [r.y, r.y + r.height]) { const t = (y - a.y) / (b.y - a.y); if (t > 0 && t < 1) cuts.push(t); }
  }
  cuts.sort((x, y) => x - y);
  const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  for (let i = 0; i < cuts.length; i++) {
    if (!isWalkable(nav, at(cuts[i]))) return false;
    if (i && !isWalkable(nav, at((cuts[i - 1] + cuts[i]) / 2))) return false;
  }
  return true;
}

/** Coordinate-compressed orthogonal graph, followed by line-of-sight smoothing. */
export function findPath(nav: Navigation, start: Point, goal: Point): Point[] | null {
  if (!isWalkable(nav, start) || !isWalkable(nav, goal)) return null;
  if (canTraverse(nav, start, goal)) return [{ ...goal }];
  const xs = new Set([start.x, goal.x]), ys = new Set([start.y, goal.y]);
  for (const r of nav.walkable) { xs.add(r.x); xs.add(r.x + r.width); ys.add(r.y); ys.add(r.y + r.height); }
  for (const r of nav.obstacles) { xs.add(r.x - 0.5); xs.add(r.x + r.width + 0.5); ys.add(r.y - 0.5); ys.add(r.y + r.height + 0.5); }
  const x = [...xs].sort((a, b) => a - b), y = [...ys].sort((a, b) => a - b);
  const key = (xi: number, yi: number) => yi * x.length + xi;
  const point = (k: number) => ({ x: x[k % x.length], y: y[Math.floor(k / x.length)] });
  const first = key(x.indexOf(start.x), y.indexOf(start.y)), last = key(x.indexOf(goal.x), y.indexOf(goal.y));
  const open = new Set([first]), costs = new Map([[first, 0]]), previous = new Map<number, number>(), closed = new Set<number>();
  while (open.size) {
    let current = first, best = Infinity;
    for (const k of open) { const score = costs.get(k)! + distance(point(k), goal); if (score < best) { best = score; current = k; } }
    if (current === last) {
      const path: Point[] = [point(last)];
      while (current !== first) { current = previous.get(current)!; path.unshift(point(current)); }
      const result: Point[] = []; let from = 0;
      while (from < path.length - 1) { let to = path.length - 1; while (to > from + 1 && !canTraverse(nav, path[from], path[to])) to--; result.push(path[to]); from = to; }
      return result;
    }
    open.delete(current); closed.add(current);
    const xi = current % x.length, yi = Math.floor(current / x.length);
    for (const [nx, ny] of [[xi - 1, yi], [xi + 1, yi], [xi, yi - 1], [xi, yi + 1]]) {
      if (nx < 0 || ny < 0 || nx >= x.length || ny >= y.length) continue;
      const next = key(nx, ny);
      if (closed.has(next) || !canTraverse(nav, point(current), point(next))) continue;
      const cost = costs.get(current)! + distance(point(current), point(next));
      if (cost < (costs.get(next) ?? Infinity)) { costs.set(next, cost); previous.set(next, current); open.add(next); }
    }
  }
  return null;
}
