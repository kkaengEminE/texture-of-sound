import { describe, it, expect } from 'vitest';
import { renderPainting } from '../../src/engine/render/canvas';
import { BrushStroke, CompositionMap } from '../../src/engine/types';

// 호출을 기록하는 가짜 2D 컨텍스트
function fakeCtx() {
  const calls: string[] = [];
  const handler = {
    get(_t: any, prop: string) {
      if (prop === '__calls') return calls;
      if (prop === 'canvas') return { width: 100, height: 100 };
      return (...args: any[]) => { calls.push(prop); };
    },
    set() { return true; },
  };
  return new Proxy({}, handler) as any;
}

const comp: CompositionMap = {
  canvas: { width: 100, height: 100 },
  regions: [], focalPoint: { x: 0.5, y: 0.5 }, flow: [],
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
};
function stroke(layer: BrushStroke['layer']): BrushStroke {
  return {
    id: 'x', segmentIndex: 0, layer,
    points: [{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 9, y: 2 }],
    pressure: 0.5, width: 5, length: 10, speed: 0.5,
    color: { h: 200, s: 0.5, l: 0.5 }, blur: 2, t0: 0, t1: 1,
  };
}

describe('renderPainting', () => {
  it('스트로크마다 경로를 그린다', () => {
    const ctx = fakeCtx();
    renderPainting(ctx, [stroke('bass'), stroke('high')], comp);
    expect(ctx.__calls).toContain('stroke');
    expect(ctx.__calls.filter((c: string) => c === 'beginPath').length).toBeGreaterThanOrEqual(2);
  });
  it('layer 필터: bass만 그리면 stroke 1회', () => {
    const ctx = fakeCtx();
    renderPainting(ctx, [stroke('bass'), stroke('high')], comp, { layer: 'bass' });
    expect(ctx.__calls.filter((c: string) => c === 'stroke').length).toBe(1);
  });
  it("layer 'all'은 전부 그린다", () => {
    const ctx = fakeCtx();
    renderPainting(ctx, [stroke('bass'), stroke('high')], comp, { layer: 'all' });
    expect(ctx.__calls.filter((c: string) => c === 'stroke').length).toBe(2);
  });
});
