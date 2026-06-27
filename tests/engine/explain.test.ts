import { describe, it, expect } from 'vitest';
import { explainSegment, explainStroke } from '../../src/engine/explain/template';
import { BrushStroke, Segment, SongAnalysis } from '../../src/engine/types';

const song = {
  meta: { duration: 200, sampleRate: 44100, frameRate: 86, frameCount: 1, bpm: 128, key: 'A minor' },
  frames: [], segments: [], bands: { bass: [], mid: [], high: [] },
  globals: { loudnessRange: [0,1], brightnessAvg: 3000, densityAvg: 0.5, bandAvg: { bass: 0.5, mid: 0.5, high: 0.5 } },
} as unknown as SongAnalysis;

const seg: Segment = { index: 2, t0: 151, t1: 170, role: 'climax', energy: 1, summary: '폭풍의 절정' };
const stroke: BrushStroke = {
  id: 'x', segmentIndex: 2, layer: 'high',
  points: [{ x: 0, y: 0 }], pressure: 0.9, width: 20, length: 60, speed: 0.8,
  color: { h: 10, s: 0.8, l: 0.4 }, blur: 1, t0: 151, t1: 151.3,
};

describe('explainSegment', () => {
  it('구간 역할/라벨/시간을 포함한 한국어 문장', () => {
    const t = explainSegment(song, seg);
    expect(t).toContain('폭풍의 절정');
    expect(t).toMatch(/2:3\d/); // 151초 ≈ 2:31
  });
});

describe('explainStroke', () => {
  it('texture/brush 두 설명을 만든다', () => {
    const e = explainStroke(song, stroke);
    expect(e.texture.length).toBeGreaterThan(5);
    expect(e.brush.length).toBeGreaterThan(5);
  });
  it('강한 pressure는 거친 질감 언급', () => {
    expect(explainStroke(song, stroke).brush).toMatch(/강|거친|빠르/);
  });
});
