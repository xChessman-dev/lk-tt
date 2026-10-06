export function swipeTarget(index: number, count: number, height: number, distance: number, velocity: number) {
  if (height <= 0 || count <= 0 || !Number.isFinite(distance) || !Number.isFinite(velocity)) return index;
  const threshold = Math.min(120, height * 0.2);
  const farEnough = Math.abs(distance) >= threshold;
  const quickFlick = Math.abs(distance) >= 24 && Math.abs(velocity) >= 0.5 && Math.sign(distance) === Math.sign(velocity);
  if (!farEnough && !quickFlick) return index;
  return Math.max(0, Math.min(count - 1, index + (distance < 0 ? 1 : -1)));
}

export function dragOffset(index: number, count: number, height: number, distance: number) {
  if (height <= 0 || !Number.isFinite(distance)) return 0;
  const atEdge = (index === 0 && distance > 0) || (index === count - 1 && distance < 0);
  return Math.max(-height, Math.min(height, distance)) * (atEdge ? 0.2 : 1);
}

// A completed animation may select a page only while its transition is still current.
// System focus/size changes cancel the transition and keep the committed page.
export class VideoPager {
  index: number;
  private generation = 0;
  private pending: { token: number; target: number } | null = null;

  constructor(index: number) { this.index = index; }

  start(target: number, count: number) {
    if (this.pending || !Number.isInteger(target) || target < 0 || target >= count) return null;
    const token = ++this.generation;
    this.pending = { token, target };
    return token;
  }

  finish(token: number) {
    if (this.pending?.token !== token) return null;
    this.index = this.pending.target;
    this.pending = null;
    return this.index;
  }

  cancel() { this.generation++; this.pending = null; }
}
