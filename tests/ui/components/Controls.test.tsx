import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SegmentChips } from '@/components/SegmentChips';
import { LayerToggle } from '@/components/LayerToggle';
import { PlaybackControls } from '@/components/PlaybackControls';
import type { Segment } from '@/engine';

const segs: Segment[] = [
  { index: 0, t0: 0, t1: 5, role: 'intro', energy: 0.2, summary: '서주의 여명' },
  { index: 1, t0: 5, t1: 10, role: 'climax', energy: 1, summary: '폭풍의 절정' },
];

describe('SegmentChips', () => {
  it('구간 클릭 시 onSelect(index)', () => {
    const onSelect = vi.fn();
    render(<SegmentChips segments={segs} activeIndex={0} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('폭풍의 절정'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe('LayerToggle', () => {
  it('레이어 클릭 시 onChange', () => {
    const onChange = vi.fn();
    render(<LayerToggle layer="all" onChange={onChange} />);
    fireEvent.click(screen.getByText('베이스'));
    expect(onChange).toHaveBeenCalledWith('bass');
  });
});

describe('PlaybackControls', () => {
  it('재생 버튼 클릭 시 onToggle', () => {
    const onToggle = vi.fn();
    render(<PlaybackControls playing={false} currentTime={0} duration={10} onToggle={onToggle} onSeek={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /재생/ }));
    expect(onToggle).toHaveBeenCalled();
  });
});
