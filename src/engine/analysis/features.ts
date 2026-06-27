import Meyda from 'meyda';
import { ANALYSIS, DecodedAudio, FrameFeatures } from '../types';
import { rms as rmsOf, zcr as zcrOf } from '../util/dsp';

export function frameRateOf(sampleRate: number): number {
  return sampleRate / ANALYSIS.hopSize;
}

const BASS_MAX = 250;   // Hz
const MID_MAX = 2000;   // Hz

export function bandEnergy(
  amplitudeSpectrum: Float32Array | number[],
  sampleRate: number,
  windowSize: number
): { bass: number; mid: number; high: number } {
  const binHz = sampleRate / windowSize;
  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < amplitudeSpectrum.length; i++) {
    const f = i * binHz;
    const v = amplitudeSpectrum[i];
    if (f < BASS_MAX) bass += v;
    else if (f < MID_MAX) mid += v;
    else high += v;
  }
  return { bass, mid, high };
}

export function extractFeatures(audio: DecodedAudio): FrameFeatures[] {
  const { mono, sampleRate } = audio;
  const { windowSize, hopSize } = ANALYSIS;
  const frames: FrameFeatures[] = [];
  let prevSpectrum: number[] | null = null;

  for (let start = 0; start + windowSize <= mono.length; start += hopSize) {
    const frame = mono.subarray(start, start + windowSize);
    // Meyda는 일반 배열을 받는다(길이 = windowSize, 2의 거듭제곱).
    const signal = Array.from(frame);
    const m = Meyda.extract(
      ['amplitudeSpectrum', 'spectralCentroid', 'chroma'],
      signal
    ) as { amplitudeSpectrum: Float32Array; spectralCentroid: number; chroma: number[] };

    const amp = Array.from(m.amplitudeSpectrum ?? []);
    // spectral flux: 양의 차분 합
    let flux = 0;
    if (prevSpectrum) {
      const n = Math.min(prevSpectrum.length, amp.length);
      for (let i = 0; i < n; i++) {
        const d = amp[i] - prevSpectrum[i];
        if (d > 0) flux += d;
      }
    }
    prevSpectrum = amp;

    // spectralCentroid는 bin 단위 → Hz로 변환
    const centroidBin = m.spectralCentroid ?? 0;
    const brightness = centroidBin * (sampleRate / windowSize);

    frames.push({
      time: start / sampleRate,
      rms: rmsOf(frame),
      brightness,
      flux,
      zcr: zcrOf(frame),
      band: bandEnergy(amp, sampleRate, windowSize),
      chroma: (m.chroma ?? new Array(12).fill(0)).slice(0, 12),
      onset: flux, // onset 강도 = flux (structure에서 정규화/피크검출)
    });
  }
  return frames;
}
