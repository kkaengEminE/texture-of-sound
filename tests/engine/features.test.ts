import { describe, it, expect } from 'vitest';
import { extractFeatures, bandEnergy, frameRateOf } from '../../src/engine/analysis/features';
import { ANALYSIS, DecodedAudio } from '../../src/engine/types';

function sine(freq: number, seconds: number, amp = 0.8): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mono[i] = amp * Math.sin((2 * Math.PI * freq * i) / ANALYSIS.sampleRate);
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('frameRateOf', () => {
  it('sampleRate/hopSize', () => {
    expect(frameRateOf(44100)).toBeCloseTo(44100 / 512, 6);
  });
});

describe('bandEnergy', () => {
  it('저주파 성분은 bass에 집중', () => {
    // bin 1 = sampleRate/windowSize ≈ 21.5Hz → bass
    const spec = new Array(ANALYSIS.windowSize / 2).fill(0);
    spec[1] = 1;
    const b = bandEnergy(spec, ANALYSIS.sampleRate, ANALYSIS.windowSize);
    expect(b.bass).toBeGreaterThan(0);
    expect(b.mid).toBe(0);
    expect(b.high).toBe(0);
  });
});

describe('extractFeatures', () => {
  const feats = extractFeatures(sine(440, 1.0));
  it('프레임이 여러 개 생성된다', () => {
    expect(feats.length).toBeGreaterThan(50);
  });
  it('각 프레임이 필수 필드를 가진다', () => {
    const f = feats[10];
    expect(typeof f.rms).toBe('number');
    expect(f.chroma.length).toBe(12);
    expect(f.band.bass).toBeGreaterThanOrEqual(0);
    expect(f.time).toBeGreaterThanOrEqual(0);
  });
  it('440Hz 사인파는 brightness(centroid)가 양수이고 안정적', () => {
    expect(feats[10].brightness).toBeGreaterThan(0);
  });
  it('결정론: 같은 입력 두 번 → 동일 결과', () => {
    const a = extractFeatures(sine(440, 0.5));
    const b = extractFeatures(sine(440, 0.5));
    expect(a).toEqual(b);
  });
  it('무음은 rms≈0', () => {
    const silent = extractFeatures(sine(440, 0.5, 0));
    expect(silent[5].rms).toBeCloseTo(0, 5);
  });
});
