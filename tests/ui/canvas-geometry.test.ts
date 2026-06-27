import { describe, it, expect } from 'vitest';
import { displayToInternal } from '@/lib/canvas-geometry';

const rect = { left: 100, top: 50, width: 800, height: 450 }; // 표시 크기(절반 스케일)
const internal = { width: 1600, height: 900 };

describe('displayToInternal', () => {
  it('좌상단 모서리 → (0,0)', () => {
    expect(displayToInternal(100, 50, rect, internal)).toEqual({ x: 0, y: 0 });
  });
  it('중앙 → 내부 중앙', () => {
    expect(displayToInternal(500, 275, rect, internal)).toEqual({ x: 800, y: 450 });
  });
  it('우하단 → (1600,900)', () => {
    expect(displayToInternal(900, 500, rect, internal)).toEqual({ x: 1600, y: 900 });
  });
});
