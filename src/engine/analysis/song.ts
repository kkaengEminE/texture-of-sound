import { DecodedAudio, SongAnalysis } from '../types';
import { extractFeatures, frameRateOf } from './features';
import { segmentSong } from './structure';
import { normalizeArray } from '../util/dsp';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler 프로파일
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function estimateBpm(onsets: number[], frameRate: number): number {
  const env = normalizeArray(onsets);
  const n = env.length;
  if (n < 4) return 120;
  const minBpm = 60, maxBpm = 180;
  const minLag = Math.max(1, Math.floor((60 / maxBpm) * frameRate));
  const maxLag = Math.ceil((60 / minBpm) * frameRate);
  let bestLag = minLag, bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++) sum += env[i] * env[i + lag];
    if (sum > bestVal) { bestVal = sum; bestLag = lag; }
  }
  return Math.round((60 * frameRate) / bestLag);
}

export function estimateKey(chromaSum: number[]): string {
  const norm = normalizeArray(chromaSum);
  let best = '', bestScore = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const [profile, name] of [[MAJOR, 'major'], [MINOR, 'minor']] as const) {
      let score = 0;
      for (let i = 0; i < 12; i++) score += norm[i] * profile[(i - root + 12) % 12];
      if (score > bestScore) { bestScore = score; best = `${NOTE_NAMES[root]} ${name}`; }
    }
  }
  return best;
}

export function analyzeSong(audio: DecodedAudio): SongAnalysis {
  const frames = extractFeatures(audio);
  const frameRate = frameRateOf(audio.sampleRate);
  const duration = audio.duration;
  const segments = segmentSong(frames, frameRate, duration);

  const bands = {
    bass: normalizeArray(frames.map((f) => f.band.bass)),
    mid: normalizeArray(frames.map((f) => f.band.mid)),
    high: normalizeArray(frames.map((f) => f.band.high)),
  };

  const chromaSum = new Array(12).fill(0);
  for (const f of frames) for (let i = 0; i < 12; i++) chromaSum[i] += f.chroma[i] ?? 0;

  const rmsVals = frames.map((f) => f.rms);
  let minRms = Infinity, maxRms = -Infinity;
  for (const v of rmsVals) { if (v < minRms) minRms = v; if (v > maxRms) maxRms = v; }
  const loudnessRange: [number, number] = rmsVals.length ? [minRms, maxRms] : [0, 0];
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    meta: {
      duration,
      sampleRate: audio.sampleRate,
      frameRate,
      frameCount: frames.length,
      bpm: estimateBpm(frames.map((f) => f.onset), frameRate),
      key: estimateKey(chromaSum),
    },
    frames,
    segments,
    bands,
    globals: {
      loudnessRange,
      brightnessAvg: avg(frames.map((f) => f.brightness)),
      densityAvg: avg(frames.map((f) => f.onset)),
      bandAvg: {
        bass: avg(bands.bass),
        mid: avg(bands.mid),
        high: avg(bands.high),
      },
    },
  };
}
