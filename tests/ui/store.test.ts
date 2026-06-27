import { describe, it, expect, beforeEach } from 'vitest';
import { savePainting, loadPainting, saveAudio, loadAudio, StoredPainting } from '@/lib/store';

function fakePainting(seed: number): StoredPainting {
  return {
    seed,
    song: { meta: { duration: 10, sampleRate: 44100, frameRate: 86, frameCount: 1, bpm: 120, key: 'C major' },
      frames: [], segments: [], bands: { bass: [], mid: [], high: [] },
      globals: { loudnessRange: [0, 1], brightnessAvg: 0, densityAvg: 0, bandAvg: { bass: 0, mid: 0, high: 0 } } } as any,
    comp: { canvas: { width: 1600, height: 900 }, regions: [], focalPoint: { x: 0.5, y: 0.5 }, flow: [],
      margins: { top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 } },
    strokes: [],
    meta: { title: 'song.mp3', duration: 10, createdAt: 123 },
  };
}

describe('painting store (localStorage)', () => {
  beforeEach(() => localStorage.clear());
  it('save 후 load로 동일 객체 복원', () => {
    const p = fakePainting(42);
    savePainting(p);
    expect(loadPainting(42)).toEqual(p);
  });
  it('없는 키는 null', () => {
    expect(loadPainting(999)).toBeNull();
  });
  it('숫자/문자 seed 동일 취급', () => {
    savePainting(fakePainting(7));
    expect(loadPainting('7')).not.toBeNull();
  });
});

describe('audio store (IndexedDB)', () => {
  it('save 후 load로 blob 복원', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' });
    await saveAudio(55, blob);
    const got = await loadAudio(55);
    expect(got).not.toBeNull();
    expect(await got!.arrayBuffer()).toEqual(await blob.arrayBuffer());
  });
  it('없는 키는 null', async () => {
    expect(await loadAudio(123456)).toBeNull();
  });
});
