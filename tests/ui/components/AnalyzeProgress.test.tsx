import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyzeProgress } from '@/components/AnalyzeProgress';

describe('AnalyzeProgress', () => {
  it('percent를 표시한다', () => {
    render(<AnalyzeProgress stage="brush" percent={80} />);
    expect(screen.getByText(/80%/)).toBeInTheDocument();
  });
  it('stage 한국어 라벨 표시', () => {
    render(<AnalyzeProgress stage="analyze" percent={5} />);
    expect(screen.getByText(/분석/)).toBeInTheDocument();
  });
});
