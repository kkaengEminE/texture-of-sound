import { describe, it, expect } from 'vitest';
import { runPipeline } from '@/lib/pipeline';
import { analyzeToPainting, ANALYSIS, DecodedAudio } from '@/engine';

function song(seconds: number): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const loud = i > n / 2;
    mono[i] = (loud ? 0.8 : 0.1) * Math.sin((2 * Math.PI * (loud ? 880 : 220) * i) / ANALYSIS.sampleRate);
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('runPipeline', () => {
  it('결과가 analyzeToPainting과 동일(결정론 보존)', () => {
    const a = runPipeline(song(6));
    const b = analyzeToPainting(song(6));
    expect(a.seed).toBe(b.seed);
    expect(JSON.stringify(a.strokes)).toBe(JSON.stringify(b.strokes));
  });
  it('진행률 콜백이 stage 순서대로 오고 마지막은 done/100', () => {
    const stages: string[] = [];
    let last = 0;
    runPipeline(song(4), (m) => { stages.push(m.stage); last = m.percent; });
    expect(stages[0]).toBe('analyze');
    expect(stages).toContain('brush');
    expect(stages[stages.length - 1]).toBe('done');
    expect(last).toBe(100);
  });
});
