import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExplanationPanel } from '@/components/ExplanationPanel';
import type { SongAnalysis, BrushStroke } from '@/engine';

const song = {
  meta: { duration: 200, sampleRate: 44100, frameRate: 86, frameCount: 1, bpm: 128, key: 'A minor' },
  frames: [], segments: [], bands: { bass: [], mid: [], high: [] },
  globals: { loudnessRange: [0, 1], brightnessAvg: 3000, densityAvg: 0.5, bandAvg: { bass: 0.5, mid: 0.5, high: 0.5 } },
} as unknown as SongAnalysis;

const stroke: BrushStroke = {
  id: 'x', segmentIndex: 2, layer: 'high', points: [{ x: 0, y: 0 }], pressure: 0.9, width: 20,
  length: 60, speed: 0.8, color: { h: 10, s: 0.8, l: 0.4 }, blur: 1, t0: 151, t1: 151.3,
};

describe('ExplanationPanel', () => {
  it('스트로크 선택 시 색감·질감 / 붓 움직임 설명 표시', () => {
    render(<ExplanationPanel song={song} selection={{ kind: 'stroke', stroke }} />);
    expect(screen.getByText(/색감·질감/)).toBeInTheDocument();
    expect(screen.getByText(/붓 움직임/)).toBeInTheDocument();
  });
  it('선택 없으면 안내 문구', () => {
    render(<ExplanationPanel song={song} selection={null} />);
    expect(screen.getByText(/클릭/)).toBeInTheDocument();
  });
});
