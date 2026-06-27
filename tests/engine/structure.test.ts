import { describe, it, expect } from 'vitest';
import { noveltyCurve, segmentSong } from '../../src/engine/analysis/structure';
import { FrameFeatures } from '../../src/engine/types';

// 절반은 조용하고 절반은 큰 합성 프레임열
function makeFrames(n: number, loudFrom: number): FrameFeatures[] {
  const out: FrameFeatures[] = [];
  for (let i = 0; i < n; i++) {
    const loud = i >= loudFrom;
    out.push({
      time: i * (512 / 44100),
      rms: loud ? 0.8 : 0.05,
      brightness: loud ? 4000 : 500,
      flux: loud && i === loudFrom ? 5 : 0.1,
      zcr: 0.1,
      band: { bass: loud ? 5 : 1, mid: loud ? 5 : 1, high: loud ? 5 : 0.5 },
      chroma: new Array(12).fill(1),
      onset: loud && i === loudFrom ? 5 : 0.1,
    });
  }
  return out;
}

describe('noveltyCurve', () => {
  it('길이가 프레임 수와 같고 0..1 범위', () => {
    const c = noveltyCurve(makeFrames(200, 100));
    expect(c.length).toBe(200);
    for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('급변 지점에서 큰 값', () => {
    const c = noveltyCurve(makeFrames(200, 100));
    const around = Math.max(c[99], c[100], c[101]);
    expect(around).toBeGreaterThan(0.5);
  });
});

describe('segmentSong', () => {
  const frames = makeFrames(400, 200);
  const segs = segmentSong(frames, 44100 / 512, frames.length * 512 / 44100);
  it('4~7개 구간을 만든다', () => {
    expect(segs.length).toBeGreaterThanOrEqual(4);
    expect(segs.length).toBeLessThanOrEqual(7);
  });
  it('구간이 연속이고 곡 전체를 덮는다', () => {
    expect(segs[0].t0).toBeCloseTo(0, 5);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].t0).toBeCloseTo(segs[i - 1].t1, 5);
    }
    expect(segs[segs.length - 1].t1).toBeCloseTo(frames.length * 512 / 44100, 5);
  });
  it('가장 에너지 높은 구간이 climax', () => {
    const climax = segs.find((s) => s.role === 'climax');
    expect(climax).toBeTruthy();
    for (const s of segs) expect(s.energy).toBeLessThanOrEqual(climax!.energy + 1e-9);
  });
  it('첫 구간은 intro, 마지막은 outro', () => {
    expect(segs[0].role).toBe('intro');
    expect(segs[segs.length - 1].role).toBe('outro');
  });
  it('결정론', () => {
    const a = segmentSong(frames, 44100 / 512, 4);
    const b = segmentSong(frames, 44100 / 512, 4);
    expect(a).toEqual(b);
  });
});
