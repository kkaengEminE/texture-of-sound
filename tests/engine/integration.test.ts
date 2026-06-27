import { describe, it, expect } from 'vitest';
import { analyzeToPainting } from '../../src/engine';
import { ANALYSIS, DecodedAudio } from '../../src/engine/types';

// 구조가 변하는 합성곡: 조용→밝고 큰 부분
function song(seconds: number): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const loud = i > n / 2;
    const amp = loud ? 0.8 : 0.1;
    const freq = loud ? 880 : 220;
    mono[i] = amp * Math.sin((2 * Math.PI * freq * i) / ANALYSIS.sampleRate);
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('analyzeToPainting (통합)', () => {
  it('전 파이프라인이 스트로크를 산출한다', () => {
    const r = analyzeToPainting(song(8));
    expect(r.strokes.length).toBeGreaterThan(0);
    expect(r.song.segments.length).toBeGreaterThanOrEqual(1);
    expect(r.comp.regions.length).toBe(r.song.segments.length);
  });
  it('결정론: 같은 곡 → byte 단위 동일 결과(90% 유사성 요건의 상한)', () => {
    const a = analyzeToPainting(song(6));
    const b = analyzeToPainting(song(6));
    expect(a.seed).toBe(b.seed);
    expect(JSON.stringify(a.strokes)).toBe(JSON.stringify(b.strokes));
  });
});
