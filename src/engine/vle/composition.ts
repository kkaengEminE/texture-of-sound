import { CompositionMap, Region, Segment, VisualLanguage } from '../types';

export function buildComposition(
  _vl: VisualLanguage,
  segments: Segment[],
  canvas: { width: number; height: number }
): CompositionMap {
  const margins = { top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 };
  const innerW = 1 - margins.left - margins.right;

  // 가중치 = 길이 0.5 + 에너지 0.5 (비균등). 합으로 정규화.
  const totalDur = segments.reduce((a, s) => a + (s.t1 - s.t0), 0) || 1;
  const weights = segments.map((s) => 0.5 * ((s.t1 - s.t0) / totalDur) + 0.5 * s.energy);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;

  let climaxIdx = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].energy > segments[climaxIdx].energy) climaxIdx = i;
  }

  const regions: Region[] = [];
  let cursor = margins.left;
  segments.forEach((s, i) => {
    const w = (weights[i] / wsum) * innerW;
    // climax는 세로로 더 크게(긴장), 나머지는 약간 여백
    const focal = i === climaxIdx;
    const h = focal ? (1 - margins.top - margins.bottom) : (1 - margins.top - margins.bottom) * 0.78;
    const y = focal ? margins.top : margins.top + (1 - margins.top - margins.bottom - h) / 2;
    regions.push({ segmentIndex: s.index, x: cursor, y, w, h, focal });
    cursor += w;
  });

  const focalRegion = regions[climaxIdx];
  const focalPoint = { x: focalRegion.x + focalRegion.w / 2, y: focalRegion.y + focalRegion.h / 2 };

  // flow: 각 region 중심을 잇는 경로(시간 순)
  const flow = regions.map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }));

  return { canvas, regions, focalPoint, flow, margins };
}
