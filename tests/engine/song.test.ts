import { describe, it, expect } from 'vitest';
import { estimateBpm, estimateKey, analyzeSong } from '../../src/engine/analysis/song';
import { ANALYSIS, DecodedAudio } from '../../src/engine/types';

function clickTrack(bpm: number, seconds: number): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  const period = Math.round((60 / bpm) * ANALYSIS.sampleRate);
  for (let i = 0; i < n; i += period) {
    for (let k = 0; k < 200 && i + k < n; k++) mono[i + k] = Math.exp(-k / 30); // 클릭 임펄스
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('estimateBpm', () => {
  it('120 BPM 클릭열을 근사한다', () => {
    const a = analyzeSong(clickTrack(120, 6));
    expect(a.meta.bpm).toBeGreaterThan(100);
    expect(a.meta.bpm).toBeLessThan(140);
  });
});

describe('estimateKey', () => {
  it('C에 에너지가 몰리면 C major 계열', () => {
    const chroma = [10, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]; // C, G 강조
    expect(estimateKey(chroma)).toContain('major');
  });
});

describe('analyzeSong', () => {
  const a = analyzeSong(clickTrack(120, 4));
  it('필수 구조를 갖춘다', () => {
    expect(a.frames.length).toBeGreaterThan(0);
    expect(a.segments.length).toBeGreaterThanOrEqual(1);
    expect(a.bands.bass.length).toBe(a.frames.length);
    expect(a.meta.frameRate).toBeCloseTo(ANALYSIS.sampleRate / ANALYSIS.hopSize, 3);
  });
  it('bands는 0..1 정규화', () => {
    for (const v of a.bands.bass) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('결정론', () => {
    const x = analyzeSong(clickTrack(120, 3));
    const y = analyzeSong(clickTrack(120, 3));
    expect(x).toEqual(y);
  });
});
