import { SongAnalysis, VisualLanguage, VisualFrame } from '../types';
import { normalizeArray, clamp01 } from '../util/dsp';

// 매핑 규칙표 (핵심 자산 — 특허 명세 대상)
export const MAPPING = {
  attack_to_pressure: 'flux(정규화) → 붓 압력',
  sustain_to_length: 'rms 지속(정규화) → 붓 길이',
  reverb_to_blur: 'high대역 잔향 추정(정규화) → 번짐',
  bass_to_weight: 'bass(정규화) → 무게중심(아래)',
  dynamics_to_thickness: 'rms(정규화) → 붓 두께',
  tempo_to_speed: 'bpm + 국소 flux → 붓 속도',
  harmony_to_hue: 'chroma 최대음 → 색조',
  brightness_to_lightness: 'spectral centroid(정규화) → 명도',
  density_to_density: 'onset(정규화) → 붓 밀도',
} as const;

// 12음 → hue (5도권 기반 색상환 배치)
const CIRCLE_OF_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
function pitchClassToHue(pc: number): number {
  const pos = CIRCLE_OF_FIFTHS.indexOf(pc);
  return (pos / 12) * 360;
}

export function buildVisualLanguage(song: SongAnalysis): VisualLanguage {
  const { frames, bands } = song;

  const fluxN = normalizeArray(frames.map((f) => f.flux));
  const rmsN = normalizeArray(frames.map((f) => f.rms));
  const brightN = normalizeArray(frames.map((f) => f.brightness));
  const onsetN = normalizeArray(frames.map((f) => f.onset));

  // sustain: rms의 국소 지속성(이동평균)
  const sustain = movingAvg(rmsN, 10);
  // tempo 기반 전역 속도 + 국소 flux
  const tempoBase = clamp01((song.meta.bpm - 60) / 120);

  const vframes: VisualFrame[] = frames.map((f, i) => {
    const maxPc = argmax(f.chroma);
    return {
      time: f.time,
      pressure: clamp01(fluxN[i]),
      strokeLength: clamp01(sustain[i]),
      blur: clamp01(bands.high[i]),
      weight: clamp01(bands.bass[i]),
      thickness: clamp01(rmsN[i]),
      speed: clamp01(0.5 * tempoBase + 0.5 * fluxN[i]),
      hue: pitchClassToHue(maxPc),
      lightness: clamp01(0.2 + 0.6 * brightN[i]),
      density: clamp01(onsetN[i]),
      band: { bass: bands.bass[i], mid: bands.mid[i], high: bands.high[i] },
    };
  });

  const chromaSum = new Array(12).fill(0);
  for (const f of frames) for (let k = 0; k < 12; k++) chromaSum[k] += f.chroma[k] ?? 0;
  const baseHue = pitchClassToHue(argmax(chromaSum));
  const hues = Array.from({ length: 12 }, (_, pc) => pitchClassToHue(pc));

  return { frames: vframes, palette: { baseHue, hues } };

  function movingAvg(xs: number[], w: number): number[] {
    return xs.map((_, i) => {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(xs.length - 1, i + w); j++) { s += xs[j]; c++; }
      return c ? s / c : 0;
    });
  }
  function argmax(xs: number[]): number {
    let m = 0;
    for (let i = 1; i < xs.length; i++) if (xs[i] > xs[m]) m = i;
    return m;
  }
}
