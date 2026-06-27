import { BrushStroke, CompositionMap, Layer, Segment, VisualLanguage } from '../types';
import { mulberry32 } from '../util/determinism';

export function dominantLayer(band: { bass: number; mid: number; high: number }): Layer {
  if (band.bass >= band.mid && band.bass >= band.high) return 'bass';
  if (band.high >= band.mid && band.high >= band.bass) return 'high';
  return 'mid';
}

// 프레임 N개당 스트로크 1개
const STROKE_EVERY = 3;

export function buildBrushPaths(
  vl: VisualLanguage,
  comp: CompositionMap,
  segments: Segment[],
  seed: number
): BrushStroke[] {
  const rnd = mulberry32(seed);
  const { width, height } = comp.canvas;
  const strokes: BrushStroke[] = [];

  for (let i = 0; i < vl.frames.length; i += STROKE_EVERY) {
    const f = vl.frames[i];
    const seg = segmentAt(segments, f.time);
    const region = comp.regions.find((r) => r.segmentIndex === seg.index) ?? comp.regions[0];

    // 기준 위치: region 내, weight(bass)로 세로 위치 결정(클수록 아래)
    const baseX = (region.x + rnd() * region.w) * width;
    const baseY = (region.y + (0.2 + 0.6 * f.weight) * region.h) * height;

    // 길이/방향: strokeLength·speed. 흔들림은 rnd로(시드 결정론).
    const len = (8 + f.strokeLength * 70) * (0.6 + 0.8 * rnd());
    const angle = (f.hue / 360) * Math.PI * 2 + (rnd() - 0.5) * (0.4 + f.pressure);
    const segPts = 4;
    const points = [];
    for (let p = 0; p <= segPts; p++) {
      const t = p / segPts;
      const jitter = (rnd() - 0.5) * (4 + f.pressure * 14);
      const x = baseX + Math.cos(angle) * len * t + jitter;
      const y = baseY + Math.sin(angle) * len * t + jitter * 0.5;
      points.push({ x: clampPx(x, width), y: clampPx(y, height) });
    }

    strokes.push({
      id: `s${i}`,
      segmentIndex: seg.index,
      layer: dominantLayer(f.band),
      points,
      pressure: f.pressure,
      width: 2 + f.thickness * 22,
      length: len,
      speed: f.speed,
      color: { h: f.hue, s: 0.45 + 0.4 * f.density, l: f.lightness },
      blur: f.blur * 12,
      t0: f.time,
      t1: vl.frames[Math.min(i + STROKE_EVERY, vl.frames.length - 1)]?.time ?? f.time,
    });
  }
  return strokes;

  function clampPx(v: number, max: number): number {
    return v < 0 ? 0 : v > max ? max : v;
  }
}

function segmentAt(segments: Segment[], time: number): Segment {
  for (const s of segments) if (time >= s.t0 && time < s.t1) return s;
  return segments[segments.length - 1];
}
