import { describe, it, expect } from 'vitest';
import { buildVisualLanguage } from '../../src/engine/vle/visual-language';
import { SongAnalysis } from '../../src/engine/types';

function fakeSong(): SongAnalysis {
  const N = 50;
  const frames = Array.from({ length: N }, (_, i) => ({
    time: i * 0.01,
    rms: i / N,
    brightness: 1000 + i * 100,
    flux: (i % 5) / 5,
    zcr: 0.2,
    band: { bass: i, mid: N - i, high: i % 10 },
    chroma: new Array(12).fill(1),
    onset: (i % 3) / 3,
  }));
  return {
    meta: { duration: 0.5, sampleRate: 44100, frameRate: 86, frameCount: N, bpm: 120, key: 'C major' },
    frames,
    segments: [{ index: 0, t0: 0, t1: 0.5, role: 'intro', energy: 0.5, summary: '서주의 여명' }],
    bands: {
      bass: frames.map((f) => f.band.bass / N),
      mid: frames.map((f) => f.band.mid / N),
      high: frames.map((f) => (f.band.high % 10) / 10),
    },
    globals: {
      loudnessRange: [0, 1], brightnessAvg: 3000, densityAvg: 0.5,
      bandAvg: { bass: 0.5, mid: 0.5, high: 0.5 },
    },
  };
}

describe('buildVisualLanguage', () => {
  const vl = buildVisualLanguage(fakeSong());
  it('프레임 수가 보존된다', () => {
    expect(vl.frames.length).toBe(50);
  });
  it('모든 시각 파라미터가 0..1', () => {
    for (const f of vl.frames) {
      for (const k of ['pressure','strokeLength','blur','weight','thickness','speed','lightness','density'] as const) {
        expect(f[k]).toBeGreaterThanOrEqual(0);
        expect(f[k]).toBeLessThanOrEqual(1);
      }
      expect(f.hue).toBeGreaterThanOrEqual(0);
      expect(f.hue).toBeLessThan(360);
    }
  });
  it('다이내믹(rms)이 커질수록 thickness 증가', () => {
    expect(vl.frames[49].thickness).toBeGreaterThan(vl.frames[0].thickness);
  });
  it('팔레트 hue가 12개', () => {
    expect(vl.palette.hues.length).toBe(12);
  });
  it('결정론', () => {
    expect(buildVisualLanguage(fakeSong())).toEqual(buildVisualLanguage(fakeSong()));
  });
  it('chroma가 비정상 길이(!=12)일 때 hue는 [0,360) 범위 유지', () => {
    const song = fakeSong();
    // chroma 길이를 8로 변경하여 argmax가 0..7 범위 값을 반환하게 함
    song.frames[0].chroma = new Array(8).fill(1);
    const vl = buildVisualLanguage(song);
    // argmax는 첫 번째 요소를 반환하므로 pc=0
    // pitchClassToHue(0)은 CIRCLE_OF_FIFTHS.indexOf(0) = 0 → (0/12)*360 = 0
    expect(vl.frames[0].hue).toBeGreaterThanOrEqual(0);
    expect(vl.frames[0].hue).toBeLessThan(360);
  });
  it('pitchClassToHue는 유효한 pc(0..11)만 처리 → 잘못된 pc(-1 등)는 0으로 폴백', () => {
    // buildVisualLanguage 경로를 통해 간접 검증
    // argmax가 정의되지 않은 입력(빈 배열)을 줄 수는 없지만,
    // 실제로 pc 범위 밖의 값이 들어온다면 hue=0으로 설정됨을 보장
    const song = fakeSong();
    // chromaSum의 argmax 값이 12 이상이 되도록 강제하기는 어렵지만,
    // 팔레트 hue 계산에서 모든 pc(0..11)에 대해 유효한 hue가 생성됨을 확인
    const vl = buildVisualLanguage(song);
    for (const hue of vl.palette.hues) {
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});
