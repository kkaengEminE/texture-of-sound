import { describe, it, expect } from 'vitest';
import { cyrb53, mulberry32 } from '../../src/engine/util/determinism';

describe('cyrb53', () => {
  it('같은 입력은 같은 해시', () => {
    expect(cyrb53('hello')).toBe(cyrb53('hello'));
  });
  it('다른 입력은 다른 해시', () => {
    expect(cyrb53('hello')).not.toBe(cyrb53('world'));
  });
  it('양의 정수를 반환', () => {
    const h = cyrb53('texture-of-sound');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThan(0);
  });
});

describe('mulberry32', () => {
  it('같은 시드는 같은 수열', () => {
    const a = mulberry32(42); const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('[0,1) 범위', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
