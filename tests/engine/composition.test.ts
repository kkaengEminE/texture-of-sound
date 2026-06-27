import { describe, it, expect } from 'vitest';
import { buildComposition } from '../../src/engine/vle/composition';
import { Segment, VisualLanguage } from '../../src/engine/types';

const vl: VisualLanguage = { frames: [], palette: { baseHue: 0, hues: [] } };
const segments: Segment[] = [
  { index: 0, t0: 0, t1: 10, role: 'intro', energy: 0.2, summary: '서주의 여명' },
  { index: 1, t0: 10, t1: 20, role: 'build', energy: 0.5, summary: '긴장과 상승' },
  { index: 2, t0: 20, t1: 30, role: 'climax', energy: 1.0, summary: '폭풍의 절정' },
  { index: 3, t0: 30, t1: 40, role: 'outro', energy: 0.1, summary: '침묵의 마침표' },
];

describe('buildComposition — empty-array guard', () => {
  it('segments=[] → regions 길이 0, throw 없음', () => {
    const result = buildComposition(vl, [], { width: 800, height: 600 });
    expect(result.regions.length).toBe(0);
  });
  it('segments=[] → flow 길이 0', () => {
    const result = buildComposition(vl, [], { width: 800, height: 600 });
    expect(result.flow.length).toBe(0);
  });
});

describe('buildComposition', () => {
  const comp = buildComposition(vl, segments, { width: 1600, height: 900 });
  it('구간 수만큼 region', () => {
    expect(comp.regions.length).toBe(4);
  });
  it('region들의 너비 합이 ≈innerW (margins 제외)', () => {
    // regions fill inside margins (innerW = 1 - left - right)
    expect(comp.regions.reduce((a, r) => a + r.w, 0)).toBeCloseTo(0.88, 5);
  });
  it('climax 구간이 focal=true', () => {
    expect(comp.regions[2].focal).toBe(true);
    expect(comp.regions.filter((r) => r.focal).length).toBe(1);
  });
  it('에너지 큰 구간이 더 넓다(비균등 분할)', () => {
    expect(comp.regions[2].w).toBeGreaterThan(comp.regions[3].w);
  });
  it('flow 경로 점이 구간 수만큼', () => {
    expect(comp.flow.length).toBe(4);
  });
  it('결정론', () => {
    const a = buildComposition(vl, segments, { width: 800, height: 600 });
    const b = buildComposition(vl, segments, { width: 800, height: 600 });
    expect(a).toEqual(b);
  });
});
