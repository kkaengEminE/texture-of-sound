import { BrushStroke, Segment } from '../types';

export function activeStrokesAt(strokes: BrushStroke[], time: number): BrushStroke[] {
  return strokes.filter((s) => time >= s.t0 && time <= s.t1);
}

export function segmentAtTime(segments: Segment[], time: number): Segment {
  if (segments.length === 0) throw new Error('segmentAtTime: segments must not be empty');
  for (const s of segments) if (time >= s.t0 && time < s.t1) return s;
  return segments[segments.length - 1];
}

export function strokeNearPoint(
  strokes: BrushStroke[],
  x: number,
  y: number
): BrushStroke | null {
  let best: BrushStroke | null = null;
  let bestD = Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}
