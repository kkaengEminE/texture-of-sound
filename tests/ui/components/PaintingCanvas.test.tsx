import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { PaintingCanvas } from '@/components/PaintingCanvas';
import type { BrushStroke, CompositionMap } from '@/engine';

beforeAll(() => {
  // jsdom canvas getContext 스텁
  (HTMLCanvasElement.prototype as any).getContext = () => ({
    fillRect: () => {}, fillStyle: '', clearRect: () => {}, save: () => {}, restore: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, quadraticCurveTo: () => {},
    stroke: () => {}, strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
    globalAlpha: 1, shadowBlur: 0, shadowColor: '',
  });
});

const comp: CompositionMap = {
  canvas: { width: 1600, height: 900 }, regions: [], focalPoint: { x: 0.5, y: 0.5 }, flow: [],
  margins: { top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 },
};
const strokes: BrushStroke[] = [{
  id: 'a', segmentIndex: 0, layer: 'bass', points: [{ x: 800, y: 450 }, { x: 810, y: 455 }],
  pressure: 0.5, width: 10, length: 12, speed: 0.5, color: { h: 200, s: 0.5, l: 0.5 }, blur: 1, t0: 0, t1: 1,
}];

describe('PaintingCanvas', () => {
  it('렌더 시 캔버스를 그린다(스모크)', () => {
    const { container } = render(
      <PaintingCanvas strokes={strokes} comp={comp} layer="all" currentTime={0} onPick={() => {}} />
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });
  it('클릭 시 가까운 스트로크로 onPick 호출', () => {
    const onPick = vi.fn();
    const { container } = render(
      <PaintingCanvas strokes={strokes} comp={comp} layer="all" currentTime={0} onPick={onPick} />
    );
    const overlay = container.querySelectorAll('canvas')[1] as HTMLCanvasElement;
    overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1600, height: 900, right: 1600, bottom: 900, x: 0, y: 0, toJSON: () => {} });
    const { fireEvent } = require('@testing-library/react');
    fireEvent.click(overlay, { clientX: 800, clientY: 450 });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].id).toBe('a');
  });
});
