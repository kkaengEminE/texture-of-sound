import { describe, it, expect } from 'vitest';
import { rms, zcr, downmix, normalizeArray, clamp01 } from '../../src/engine/util/dsp';

describe('rms', () => {
  it('상수 신호의 rms는 그 절대값', () => {
    expect(rms(new Float32Array([0.5, 0.5, 0.5, 0.5]))).toBeCloseTo(0.5, 6);
  });
  it('무음은 0', () => {
    expect(rms(new Float32Array([0, 0, 0]))).toBe(0);
  });
});

describe('zcr', () => {
  it('교대 부호 신호는 zcr≈1', () => {
    expect(zcr(new Float32Array([1, -1, 1, -1, 1]))).toBeCloseTo(1, 6);
  });
  it('부호 변화 없으면 0', () => {
    expect(zcr(new Float32Array([1, 1, 1, 1]))).toBe(0);
  });
});

describe('downmix', () => {
  it('모노는 그대로', () => {
    const m = new Float32Array([0.1, 0.2]);
    const result = Array.from(downmix([m]));
    expect(result[0]).toBeCloseTo(0.1, 5);
    expect(result[1]).toBeCloseTo(0.2, 5);
  });
  it('스테레오는 평균', () => {
    const l = new Float32Array([0, 1]); const r = new Float32Array([1, -1]);
    const result = Array.from(downmix([l, r]));
    expect(result[0]).toBeCloseTo(0.5, 5);
    expect(result[1]).toBeCloseTo(0, 5);
  });
  it('빈 채널 배열은 빈 Float32Array 반환', () => {
    const result = downmix([]);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(0);
  });
  it('길이가 다른 채널들은 최소 길이로 처리', () => {
    const ch1 = new Float32Array([0, 1, 9]);
    const ch2 = new Float32Array([1, -1]);
    const result = Array.from(downmix([ch1, ch2]));
    expect(result.length).toBe(2);
    expect(result[0]).toBeCloseTo(0.5, 5);
    expect(result[1]).toBeCloseTo(0, 5);
  });
  it('3채널 평균 검증', () => {
    const ch1 = new Float32Array([3]);
    const ch2 = new Float32Array([6]);
    const ch3 = new Float32Array([9]);
    const result = Array.from(downmix([ch1, ch2, ch3]));
    expect(result.length).toBe(1);
    expect(result[0]).toBeCloseTo(6, 5);
  });
});

describe('normalizeArray', () => {
  it('min-max를 0..1로', () => {
    expect(normalizeArray([10, 20, 30])).toEqual([0, 0.5, 1]);
  });
  it('상수 배열은 모두 0', () => {
    expect(normalizeArray([5, 5, 5])).toEqual([0, 0, 0]);
  });
});

describe('clamp01', () => {
  it('범위 밖을 자른다', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.3)).toBe(0.3);
  });
});
