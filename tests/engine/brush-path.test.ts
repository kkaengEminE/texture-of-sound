import { describe, it, expect } from 'vitest';
import { buildBrushPaths, dominantLayer } from '../../src/engine/vle/brush-path';
import { buildComposition } from '../../src/engine/vle/composition';
import { Segment, VisualFrame, VisualLanguage } from '../../src/engine/types';

const segments: Segment[] = [
  { index: 0, t0: 0, t1: 1, role: 'intro', energy: 0.3, summary: '서주의 여명' },
  { index: 1, t0: 1, t1: 2, role: 'climax', energy: 1, summary: '폭풍의 절정' },
];
function vframe(time: number, over: Partial<VisualFrame> = {}): VisualFrame {
  return {
    time, pressure: 0.5, strokeLength: 0.5, blur: 0.2, weight: 0.5,
    thickness: 0.5, speed: 0.5, hue: 200, lightness: 0.5, density: 0.5,
    band: { bass: 0.3, mid: 0.3, high: 0.3 }, ...over,
  };
}
const vl: VisualLanguage = {
  frames: Array.from({ length: 40 }, (_, i) => vframe(i * 0.05)),
  palette: { baseHue: 200, hues: [] },
};
const comp = buildComposition(vl, segments, { width: 1600, height: 900 });

describe('dominantLayer', () => {
  it('가장 큰 대역을 고른다', () => {
    expect(dominantLayer({ bass: 0.9, mid: 0.1, high: 0.1 })).toBe('bass');
    expect(dominantLayer({ bass: 0.1, mid: 0.1, high: 0.9 })).toBe('high');
  });
});

describe('buildBrushPaths', () => {
  const strokes = buildBrushPaths(vl, comp, segments, 12345);
  it('스트로크가 생성된다', () => {
    expect(strokes.length).toBeGreaterThan(0);
  });
  it('각 스트로크가 캔버스 범위 내 점을 가진다', () => {
    for (const s of strokes) {
      expect(s.points.length).toBeGreaterThanOrEqual(2);
      for (const p of s.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1600);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(900);
      }
      expect(s.t1).toBeGreaterThanOrEqual(s.t0);
      expect(['bass','mid','high']).toContain(s.layer);
    }
  });
  it('모든 스트로크가 t1 > t0을 보장한다', () => {
    for (const s of strokes) {
      expect(s.t1).toBeGreaterThan(s.t0);
    }
  });
  it('결정론: 같은 seed면 동일', () => {
    const a = buildBrushPaths(vl, comp, segments, 999);
    const b = buildBrushPaths(vl, comp, segments, 999);
    expect(a).toEqual(b);
  });
  it('다른 seed면 달라진다', () => {
    const a = buildBrushPaths(vl, comp, segments, 1);
    const b = buildBrushPaths(vl, comp, segments, 2);
    expect(a).not.toEqual(b);
  });
});
