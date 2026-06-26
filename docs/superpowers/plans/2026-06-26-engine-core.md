# 엔진 코어 (Translation Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 오디오 파일을 결정론적 순수 함수 파이프라인으로 분석해, 한 장의 연속 회화를 그릴 수 있는 `BrushStroke[]`와 한국어 해설을 산출하는 엔진을 만든다.

**Architecture:** 모든 단계가 입력→출력이 고정된 순수 함수다(`decode → features → structure → song → visual-language → composition → brush-path → render`). 분석 수학은 브라우저 API에 의존하지 않고 `Float32Array` PCM 위에서만 동작하므로 Node(Vitest)에서 완전히 단위 테스트된다. 브라우저 의존(OfflineAudioContext)은 `decode`의 얇은 래퍼 한 곳에 격리한다. 난수는 `seed = hash(SongAnalysis)`에서 유도한 `mulberry32` PRNG로만 생성해 재현성을 보장한다.

**Tech Stack:** TypeScript, Vitest, Meyda(오프라인 `extract`), Next.js(플랜 2에서 UI 배선 — 이 플랜은 `src/engine/`만 다룸).

## Global Constraints

- 분석 상수 고정: `sampleRate=44100`, `windowSize=2048`, `hopSize=512` (절대 변경 금지 — 결정론 기준).
- 엔진 코드(`src/engine/**`)는 브라우저 전역(`window`, `AudioContext`, `OfflineAudioContext`, `document`)을 `audio/decode.ts`의 명시된 함수 외에서는 절대 참조하지 않는다. 나머지는 순수 JS.
- 모든 난수는 `mulberry32(seed)`로만. `Math.random()` 금지.
- 부동소수점 누적은 정의된 순서대로만(배열 정렬·순회 순서 고정).
- 색은 HSL `{ h: 0..360, s: 0..1, l: 0..1 }`로 통일.
- 좌표: CompositionMap의 region은 정규화(0..1), BrushStroke의 points는 캔버스 픽셀(정수 아님, float 허용).
- 테스트 러너: `npx vitest run`. 커밋은 각 Task 끝에서.

---

## File Structure

```
src/engine/
  types.ts                 // 모든 공유 타입 + ANALYSIS 상수
  util/determinism.ts      // cyrb53 hash, mulberry32 PRNG
  util/dsp.ts              // rms, zcr, downmix, normalize 등 순수 DSP 헬퍼
  audio/decode.ts          // OfflineAudioContext 래퍼(브라우저) + 순수 downmix
  analysis/features.ts     // PCM → FrameFeatures[]
  analysis/structure.ts    // FrameFeatures[] → Segment[]
  analysis/song.ts         // → SongAnalysis (bpm/key 추정 포함)
  vle/visual-language.ts   // SongAnalysis → VisualLanguage
  vle/composition.ts       // VisualLanguage → CompositionMap
  vle/brush-path.ts        // → BrushStroke[]
  render/style.ts          // StyleAdapter 인터페이스
  render/style-oil.ts      // oil 화풍 어댑터
  render/canvas.ts         // BrushStroke[] + StyleAdapter → CanvasRenderingContext2D
  explain/template.ts      // (x,y)|time → 한국어 해설
  playback/sync.ts         // time → 활성 stroke/segment
  index.ts                 // analyzeToPainting() 파사드 + re-exports
tests/engine/              // 위 각 모듈의 *.test.ts
```

---

### Task 1: 프로젝트 스캐폴드 + 타입 + 결정론 유틸

엔진의 모든 모듈이 의존하는 토대(빌드/테스트 환경 + 공유 타입 + 해시/PRNG)를 만든다. 결정론의 기반인 `mulberry32`/`cyrb53`을 테스트로 고정한다.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `src/engine/types.ts`
- Create: `src/engine/util/determinism.ts`
- Test: `tests/engine/determinism.test.ts`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `ANALYSIS = { sampleRate: 44100, windowSize: 2048, hopSize: 512 }`
  - `cyrb53(str: string, seed?: number): number`
  - `mulberry32(seed: number): () => number` — `[0,1)` 반환
  - 타입: `DecodedAudio, FrameFeatures, SegmentRole, Segment, SongAnalysis, VisualFrame, VisualLanguage, Region, CompositionMap, BrushStroke, Layer`

- [ ] **Step 1: 프로젝트 초기화 파일 작성**

`package.json`:
```json
{
  "name": "texture-of-sound",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  },
  "dependencies": {
    "meyda": "^5.6.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src", "tests"]
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: `node_modules/` 생성, 에러 없음.

- [ ] **Step 3: 타입 정의 작성**

Create `src/engine/types.ts`:
```ts
export const ANALYSIS = {
  sampleRate: 44100,
  windowSize: 2048,
  hopSize: 512,
} as const;

export interface DecodedAudio {
  sampleRate: number;
  length: number;            // 채널당 샘플 수
  duration: number;          // 초
  channels: Float32Array[];  // [L,R] 또는 [mono]
  mono: Float32Array;        // 다운믹스 모노
}

export interface FrameFeatures {
  time: number;              // 프레임 시작 시각(초)
  rms: number;
  brightness: number;        // spectral centroid (Hz)
  flux: number;              // spectral flux (>=0)
  zcr: number;               // 0..1
  band: { bass: number; mid: number; high: number }; // 대역 에너지(>=0)
  chroma: number[];          // length 12, >=0
  onset: number;             // onset 강도(>=0)
}

export type SegmentRole =
  | 'intro' | 'build' | 'climax' | 'transition' | 'release' | 'outro';

export interface Segment {
  index: number;
  t0: number;
  t1: number;
  role: SegmentRole;
  energy: number;            // 0..1 정규화 평균 에너지
  summary: string;           // 한국어 라벨 (예: "서주의 여명")
}

export interface SongAnalysis {
  meta: {
    duration: number;
    sampleRate: number;
    frameRate: number;       // 프레임/초
    frameCount: number;
    bpm: number;
    key: string;             // 예: "C major"
  };
  frames: FrameFeatures[];
  segments: Segment[];
  bands: { bass: number[]; mid: number[]; high: number[] }; // 프레임별 정규화 0..1
  globals: {
    loudnessRange: [number, number];
    brightnessAvg: number;
    densityAvg: number;
    bandAvg: { bass: number; mid: number; high: number };
  };
}

export interface VisualFrame {
  time: number;
  pressure: number;     // 0..1 (attack)
  strokeLength: number; // 0..1 (sustain)
  blur: number;         // 0..1 (reverb)
  weight: number;       // 0..1 (bass → 무게중심, 클수록 아래쪽)
  thickness: number;    // 0..1 (dynamics)
  speed: number;        // 0..1 (tempo/local)
  hue: number;          // 0..360 (harmony)
  lightness: number;    // 0..1 (brightness)
  density: number;      // 0..1 (density)
  band: { bass: number; mid: number; high: number }; // 0..1
}

export interface VisualLanguage {
  frames: VisualFrame[];
  palette: { baseHue: number; hues: number[] };
}

export interface Region {
  segmentIndex: number;
  x: number; y: number; w: number; h: number; // 정규화 0..1
  focal: boolean;
}

export interface CompositionMap {
  canvas: { width: number; height: number };
  regions: Region[];
  focalPoint: { x: number; y: number };        // 0..1
  flow: { x: number; y: number }[];            // 0..1 경로
  margins: { top: number; right: number; bottom: number; left: number }; // 0..1
}

export type Layer = 'all' | 'bass' | 'mid' | 'high';

export interface BrushStroke {
  id: string;
  segmentIndex: number;
  layer: Layer;
  points: { x: number; y: number }[];  // 캔버스 px
  pressure: number;                    // 0..1
  width: number;                       // px
  length: number;                      // px(경로 총길이 근사)
  speed: number;                       // 0..1
  color: { h: number; s: number; l: number }; // h:0..360 s,l:0..1
  blur: number;                        // px
  t0: number; t1: number;              // 초
}
```

- [ ] **Step 4: 결정론 유틸 테스트 작성 (실패)**

Create `tests/engine/determinism.test.ts`:
```ts
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
```

- [ ] **Step 5: 실패 확인**

Run: `npx vitest run tests/engine/determinism.test.ts`
Expected: FAIL — `Cannot find module '../../src/engine/util/determinism'`

- [ ] **Step 6: 결정론 유틸 구현**

Create `src/engine/util/determinism.ts`:
```ts
// cyrb53: 결정론적 문자열 해시 (양의 정수)
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// mulberry32: 시드 기반 결정론적 PRNG → [0,1)
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run tests/engine/determinism.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 8: 커밋**

```bash
git add package.json tsconfig.json vitest.config.ts src/engine/types.ts src/engine/util/determinism.ts tests/engine/determinism.test.ts
git commit -m "feat(engine): scaffold + types + determinism utils"
```

---

### Task 2: DSP 헬퍼 + decode

순수 DSP 헬퍼(rms, zcr, downmix, normalizeArray)와 오디오 디코드를 만든다. OfflineAudioContext는 브라우저 전용이라 얇은 래퍼로 격리하고, 테스트 가능한 순수 부분(downmix·정규화)만 단위 테스트한다.

**Files:**
- Create: `src/engine/util/dsp.ts`
- Create: `src/engine/audio/decode.ts`
- Test: `tests/engine/dsp.test.ts`

**Interfaces:**
- Consumes: `DecodedAudio` (types)
- Produces:
  - `rms(frame: Float32Array): number`
  - `zcr(frame: Float32Array): number`  // 0..1
  - `downmix(channels: Float32Array[]): Float32Array`
  - `normalizeArray(xs: number[]): number[]`  // min-max → 0..1 (상수면 0)
  - `clamp01(x: number): number`
  - `decodeAudioData(input: ArrayBuffer): Promise<DecodedAudio>`  // 브라우저 전용

- [ ] **Step 1: DSP 테스트 작성 (실패)**

Create `tests/engine/dsp.test.ts`:
```ts
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
    expect(Array.from(downmix([m]))).toEqual([0.1, 0.2]);
  });
  it('스테레오는 평균', () => {
    const l = new Float32Array([0, 1]); const r = new Float32Array([1, -1]);
    expect(Array.from(downmix([l, r]))).toEqual([0.5, 0]);
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/dsp.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: DSP 헬퍼 구현**

Create `src/engine/util/dsp.ts`:
```ts
export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export function zcr(frame: Float32Array): number {
  if (frame.length < 2) return 0;
  let crossings = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i - 1] < 0 && frame[i] >= 0) || (frame[i - 1] >= 0 && frame[i] < 0)) {
      crossings++;
    }
  }
  return crossings / (frame.length - 1);
}

export function downmix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const len = channels[0].length;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < channels.length; c++) s += channels[c][i];
    out[i] = s / channels.length;
  }
  return out;
}

export function normalizeArray(xs: number[]): number[] {
  if (xs.length === 0) return [];
  let min = xs[0], max = xs[0];
  for (const x of xs) { if (x < min) min = x; if (x > max) max = x; }
  const range = max - min;
  if (range === 0) return xs.map(() => 0);
  return xs.map((x) => (x - min) / range);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/dsp.test.ts`
Expected: PASS

- [ ] **Step 5: decode 구현 (브라우저 래퍼 — 단위 테스트 제외)**

Create `src/engine/audio/decode.ts`:
```ts
import { ANALYSIS, DecodedAudio } from '../types';
import { downmix } from '../util/dsp';

// 브라우저 전용: OfflineAudioContext로 디코드 + 44100Hz 리샘플.
// 순수 부분(downmix)은 dsp.ts에서 단위 테스트됨.
export async function decodeAudioData(input: ArrayBuffer): Promise<DecodedAudio> {
  const Ctx: typeof OfflineAudioContext =
    (globalThis as any).OfflineAudioContext || (globalThis as any).webkitOfflineAudioContext;
  if (!Ctx) throw new Error('OfflineAudioContext를 사용할 수 없습니다(브라우저 전용).');

  // 임시 컨텍스트로 디코드
  const tmp = new Ctx(1, 1, ANALYSIS.sampleRate);
  const decoded = await tmp.decodeAudioData(input.slice(0));

  // 44100Hz로 리샘플
  const frames = Math.ceil(decoded.duration * ANALYSIS.sampleRate);
  const off = new Ctx(decoded.numberOfChannels, frames, ANALYSIS.sampleRate);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();

  const channels: Float32Array[] = [];
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    channels.push(rendered.getChannelData(c).slice());
  }
  const mono = downmix(channels);
  return {
    sampleRate: ANALYSIS.sampleRate,
    length: mono.length,
    duration: mono.length / ANALYSIS.sampleRate,
    channels,
    mono,
  };
}
```

- [ ] **Step 6: 타입체크 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add src/engine/util/dsp.ts src/engine/audio/decode.ts tests/engine/dsp.test.ts
git commit -m "feat(engine): dsp helpers + browser decode wrapper"
```

---

### Task 3: analysis/features

모노 PCM을 고정 window/hop로 슬라이싱해 프레임별 특징(rms·brightness·flux·zcr·band·chroma·onset)을 추출한다. 스펙트럼은 Meyda 오프라인 `extract`로, band/flux/onset은 amplitudeSpectrum에서 직접 계산한다.

**Files:**
- Create: `src/engine/analysis/features.ts`
- Test: `tests/engine/features.test.ts`

**Interfaces:**
- Consumes: `DecodedAudio`, `FrameFeatures`, `ANALYSIS`, `rms`, `zcr`
- Produces:
  - `extractFeatures(audio: DecodedAudio): FrameFeatures[]`
  - `bandEnergy(amplitudeSpectrum: Float32Array | number[], sampleRate: number, windowSize: number): { bass: number; mid: number; high: number }`
  - `frameRateOf(sampleRate: number): number`  // = sampleRate / hopSize

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/features.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { extractFeatures, bandEnergy, frameRateOf } from '../../src/engine/analysis/features';
import { ANALYSIS, DecodedAudio } from '../../src/engine/types';

function sine(freq: number, seconds: number, amp = 0.8): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    mono[i] = amp * Math.sin((2 * Math.PI * freq * i) / ANALYSIS.sampleRate);
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('frameRateOf', () => {
  it('sampleRate/hopSize', () => {
    expect(frameRateOf(44100)).toBeCloseTo(44100 / 512, 6);
  });
});

describe('bandEnergy', () => {
  it('저주파 성분은 bass에 집중', () => {
    // bin 1 = sampleRate/windowSize ≈ 21.5Hz → bass
    const spec = new Array(ANALYSIS.windowSize / 2).fill(0);
    spec[1] = 1;
    const b = bandEnergy(spec, ANALYSIS.sampleRate, ANALYSIS.windowSize);
    expect(b.bass).toBeGreaterThan(0);
    expect(b.mid).toBe(0);
    expect(b.high).toBe(0);
  });
});

describe('extractFeatures', () => {
  const feats = extractFeatures(sine(440, 1.0));
  it('프레임이 여러 개 생성된다', () => {
    expect(feats.length).toBeGreaterThan(50);
  });
  it('각 프레임이 필수 필드를 가진다', () => {
    const f = feats[10];
    expect(typeof f.rms).toBe('number');
    expect(f.chroma.length).toBe(12);
    expect(f.band.bass).toBeGreaterThanOrEqual(0);
    expect(f.time).toBeGreaterThanOrEqual(0);
  });
  it('440Hz 사인파는 brightness(centroid)가 양수이고 안정적', () => {
    expect(feats[10].brightness).toBeGreaterThan(0);
  });
  it('결정론: 같은 입력 두 번 → 동일 결과', () => {
    const a = extractFeatures(sine(440, 0.5));
    const b = extractFeatures(sine(440, 0.5));
    expect(a).toEqual(b);
  });
  it('무음은 rms≈0', () => {
    const silent = extractFeatures(sine(440, 0.5, 0));
    expect(silent[5].rms).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/features.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

Create `src/engine/analysis/features.ts`:
```ts
import Meyda from 'meyda';
import { ANALYSIS, DecodedAudio, FrameFeatures } from '../types';
import { rms as rmsOf, zcr as zcrOf } from '../util/dsp';

export function frameRateOf(sampleRate: number): number {
  return sampleRate / ANALYSIS.hopSize;
}

const BASS_MAX = 250;   // Hz
const MID_MAX = 2000;   // Hz

export function bandEnergy(
  amplitudeSpectrum: Float32Array | number[],
  sampleRate: number,
  windowSize: number
): { bass: number; mid: number; high: number } {
  const binHz = sampleRate / windowSize;
  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < amplitudeSpectrum.length; i++) {
    const f = i * binHz;
    const v = amplitudeSpectrum[i];
    if (f < BASS_MAX) bass += v;
    else if (f < MID_MAX) mid += v;
    else high += v;
  }
  return { bass, mid, high };
}

export function extractFeatures(audio: DecodedAudio): FrameFeatures[] {
  const { mono, sampleRate } = audio;
  const { windowSize, hopSize } = ANALYSIS;
  const frames: FrameFeatures[] = [];
  let prevSpectrum: number[] | null = null;

  for (let start = 0; start + windowSize <= mono.length; start += hopSize) {
    const frame = mono.subarray(start, start + windowSize);
    // Meyda는 일반 배열을 받는다(길이 = windowSize, 2의 거듭제곱).
    const signal = Array.from(frame);
    const m = Meyda.extract(
      ['amplitudeSpectrum', 'spectralCentroid', 'chroma'],
      signal
    ) as { amplitudeSpectrum: Float32Array; spectralCentroid: number; chroma: number[] };

    const amp = Array.from(m.amplitudeSpectrum ?? []);
    // spectral flux: 양의 차분 합
    let flux = 0;
    if (prevSpectrum) {
      const n = Math.min(prevSpectrum.length, amp.length);
      for (let i = 0; i < n; i++) {
        const d = amp[i] - prevSpectrum[i];
        if (d > 0) flux += d;
      }
    }
    prevSpectrum = amp;

    const centroidBin = m.spectralCentroid ?? 0; // bin 단위
    const brightness = centroidBin * (sampleRate / windowSize);

    frames.push({
      time: start / sampleRate,
      rms: rmsOf(frame),
      brightness,
      flux,
      zcr: zcrOf(frame),
      band: bandEnergy(amp, sampleRate, windowSize),
      chroma: (m.chroma ?? new Array(12).fill(0)).slice(0, 12),
      onset: flux, // onset 강도 = flux (structure에서 정규화/피크검출)
    });
  }
  return frames;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/features.test.ts`
Expected: PASS

> 주의: Meyda 버전에 따라 `spectralCentroid`가 bin/Hz 중 무엇을 반환하는지 다를 수 있다. 테스트가 `brightness > 0`만 확인하므로 통과하지만, 만약 값이 비정상(>22050)이면 `brightness = centroidBin`(이미 Hz)로 조정하고 테스트를 다시 돌릴 것.

- [ ] **Step 5: 커밋**

```bash
git add src/engine/analysis/features.ts tests/engine/features.test.ts
git commit -m "feat(engine): frame feature extraction"
```

---

### Task 4: analysis/structure

프레임 특징으로 곡을 4~7개 구간으로 결정론 분할하고, 각 구간에 역할(intro/build/climax/...)과 한국어 라벨을 부여한다.

**Files:**
- Create: `src/engine/analysis/structure.ts`
- Test: `tests/engine/structure.test.ts`

**Interfaces:**
- Consumes: `FrameFeatures`, `Segment`, `SegmentRole`, `normalizeArray`, `clamp01`
- Produces:
  - `noveltyCurve(frames: FrameFeatures[]): number[]`  // 프레임당 변화량 0..1
  - `segmentSong(frames: FrameFeatures[], frameRate: number, duration: number): Segment[]`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/structure.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { noveltyCurve, segmentSong } from '../../src/engine/analysis/structure';
import { FrameFeatures } from '../../src/engine/types';

// 절반은 조용하고 절반은 큰 합성 프레임열
function makeFrames(n: number, loudFrom: number): FrameFeatures[] {
  const out: FrameFeatures[] = [];
  for (let i = 0; i < n; i++) {
    const loud = i >= loudFrom;
    out.push({
      time: i * (512 / 44100),
      rms: loud ? 0.8 : 0.05,
      brightness: loud ? 4000 : 500,
      flux: loud && i === loudFrom ? 5 : 0.1,
      zcr: 0.1,
      band: { bass: loud ? 5 : 1, mid: loud ? 5 : 1, high: loud ? 5 : 0.5 },
      chroma: new Array(12).fill(1),
      onset: loud && i === loudFrom ? 5 : 0.1,
    });
  }
  return out;
}

describe('noveltyCurve', () => {
  it('길이가 프레임 수와 같고 0..1 범위', () => {
    const c = noveltyCurve(makeFrames(200, 100));
    expect(c.length).toBe(200);
    for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('급변 지점에서 큰 값', () => {
    const c = noveltyCurve(makeFrames(200, 100));
    const around = Math.max(c[99], c[100], c[101]);
    expect(around).toBeGreaterThan(0.5);
  });
});

describe('segmentSong', () => {
  const frames = makeFrames(400, 200);
  const segs = segmentSong(frames, 44100 / 512, frames.length * 512 / 44100);
  it('4~7개 구간을 만든다', () => {
    expect(segs.length).toBeGreaterThanOrEqual(4);
    expect(segs.length).toBeLessThanOrEqual(7);
  });
  it('구간이 연속이고 곡 전체를 덮는다', () => {
    expect(segs[0].t0).toBeCloseTo(0, 5);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].t0).toBeCloseTo(segs[i - 1].t1, 5);
    }
  });
  it('가장 에너지 높은 구간이 climax', () => {
    const climax = segs.find((s) => s.role === 'climax');
    expect(climax).toBeTruthy();
    for (const s of segs) expect(s.energy).toBeLessThanOrEqual(climax!.energy + 1e-9);
  });
  it('첫 구간은 intro, 마지막은 outro', () => {
    expect(segs[0].role).toBe('intro');
    expect(segs[segs.length - 1].role).toBe('outro');
  });
  it('결정론', () => {
    const a = segmentSong(frames, 44100 / 512, 4);
    const b = segmentSong(frames, 44100 / 512, 4);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/structure.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

Create `src/engine/analysis/structure.ts`:
```ts
import { FrameFeatures, Segment, SegmentRole } from '../types';
import { normalizeArray, clamp01 } from '../util/dsp';

// 프레임 특징을 정규화 벡터로 만들어 인접 윈도우 평균 간 차이로 novelty 산출
export function noveltyCurve(frames: FrameFeatures[]): number[] {
  const n = frames.length;
  if (n === 0) return [];
  const rms = normalizeArray(frames.map((f) => f.rms));
  const bright = normalizeArray(frames.map((f) => f.brightness));
  const bass = normalizeArray(frames.map((f) => f.band.bass));
  const high = normalizeArray(frames.map((f) => f.band.high));
  const flux = normalizeArray(frames.map((f) => f.flux));

  const W = 8; // 윈도우 반경
  const raw: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = avgVec(i - W, i, [rms, bright, bass, high]);
    const b = avgVec(i, i + W, [rms, bright, bass, high]);
    let d = 0;
    for (let k = 0; k < a.length; k++) d += (a[k] - b[k]) ** 2;
    raw[i] = Math.sqrt(d) + flux[i] * 0.5;
  }
  return normalizeArray(raw);

  function avgVec(from: number, to: number, series: number[][]): number[] {
    const lo = Math.max(0, from), hi = Math.min(n, to);
    return series.map((s) => {
      let sum = 0, cnt = 0;
      for (let i = lo; i < hi; i++) { sum += s[i]; cnt++; }
      return cnt ? sum / cnt : 0;
    });
  }
}

export function segmentSong(
  frames: FrameFeatures[],
  frameRate: number,
  duration: number
): Segment[] {
  const n = frames.length;
  if (n === 0) {
    return [{ index: 0, t0: 0, t1: duration, role: 'intro', energy: 0, summary: ROLE_LABEL.intro }];
  }
  const novelty = noveltyCurve(frames);

  // 피크 후보: 국소 최대 + 임계값. 최소 간격으로 과분할 방지.
  const minGap = Math.max(1, Math.floor(n / 10));
  const candidates: { i: number; v: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (novelty[i] >= novelty[i - 1] && novelty[i] >= novelty[i + 1] && novelty[i] > 0.3) {
      candidates.push({ i, v: novelty[i] });
    }
  }
  candidates.sort((a, b) => b.v - a.v || a.i - b.i);

  // 목표 경계 수: 3~6 (→ 구간 4~7)
  const targetBoundaries = Math.min(6, Math.max(3, Math.round(duration / 30)));
  const chosen: number[] = [];
  for (const c of candidates) {
    if (chosen.length >= targetBoundaries) break;
    if (chosen.every((x) => Math.abs(x - c.i) >= minGap)) chosen.push(c.i);
  }
  // 후보가 부족하면 균등 분할로 보충
  if (chosen.length < 3) {
    const k = 4;
    chosen.length = 0;
    for (let b = 1; b < k; b++) chosen.push(Math.floor((n * b) / k));
  }
  chosen.sort((a, b) => a - b);

  // 경계 → 구간(프레임 인덱스 범위)
  const bounds = [0, ...chosen, n];
  const segs: Segment[] = [];
  for (let s = 0; s < bounds.length - 1; s++) {
    const fi0 = bounds[s], fi1 = bounds[s + 1];
    let e = 0;
    for (let i = fi0; i < fi1; i++) e += frames[i].rms + frames[i].band.high * 0.001;
    e = e / Math.max(1, fi1 - fi0);
    segs.push({
      index: s,
      t0: frames[fi0].time,
      t1: s === bounds.length - 2 ? duration : frames[fi1].time,
      role: 'transition', // 아래에서 재지정
      energy: e,
      summary: '',
    });
  }
  // 에너지 정규화
  const en = normalizeArray(segs.map((s) => s.energy));
  segs.forEach((s, i) => (s.energy = en[i]));

  assignRoles(segs);
  return segs;
}

const ROLE_LABEL: Record<SegmentRole, string> = {
  intro: '서주의 여명',
  build: '긴장과 상승',
  climax: '폭풍의 절정',
  transition: '고요한 전환',
  release: '해소와 여운',
  outro: '침묵의 마침표',
};

function assignRoles(segs: Segment[]): void {
  const n = segs.length;
  // climax = 최대 에너지
  let climaxIdx = 0;
  for (let i = 1; i < n; i++) if (segs[i].energy > segs[climaxIdx].energy) climaxIdx = i;

  for (let i = 0; i < n; i++) {
    let role: SegmentRole;
    if (i === 0) role = 'intro';
    else if (i === n - 1) role = 'outro';
    else if (i === climaxIdx) role = 'climax';
    else if (i < climaxIdx) role = 'build';
    else role = segs[i].energy < segs[i - 1].energy ? 'release' : 'transition';
    segs[i].role = role;
    segs[i].summary = ROLE_LABEL[role];
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/structure.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/analysis/structure.ts tests/engine/structure.test.ts
git commit -m "feat(engine): deterministic song segmentation"
```

---

### Task 5: analysis/song (BPM·key·통합)

프레임 특징과 구간을 합쳐 `SongAnalysis`로 통합하고, BPM(onset 자기상관)과 key(chroma vs Krumhansl 프로파일)를 결정론적으로 추정한다.

**Files:**
- Create: `src/engine/analysis/song.ts`
- Test: `tests/engine/song.test.ts`

**Interfaces:**
- Consumes: `DecodedAudio`, `SongAnalysis`, `extractFeatures`, `frameRateOf`, `segmentSong`, `normalizeArray`
- Produces:
  - `estimateBpm(onsets: number[], frameRate: number): number`
  - `estimateKey(chromaSum: number[]): string`
  - `analyzeSong(audio: DecodedAudio): SongAnalysis`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/song.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { estimateBpm, estimateKey, analyzeSong } from '../../src/engine/analysis/song';
import { ANALYSIS, DecodedAudio } from '../../src/engine/types';

function clickTrack(bpm: number, seconds: number): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  const period = Math.round((60 / bpm) * ANALYSIS.sampleRate);
  for (let i = 0; i < n; i += period) {
    for (let k = 0; k < 200 && i + k < n; k++) mono[i + k] = Math.exp(-k / 30); // 클릭 임펄스
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('estimateBpm', () => {
  it('120 BPM 클릭열을 근사한다', () => {
    const a = analyzeSong(clickTrack(120, 6));
    expect(a.meta.bpm).toBeGreaterThan(100);
    expect(a.meta.bpm).toBeLessThan(140);
  });
});

describe('estimateKey', () => {
  it('C에 에너지가 몰리면 C major 계열', () => {
    const chroma = [10, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0]; // C, G 강조
    expect(estimateKey(chroma)).toContain('major');
  });
});

describe('analyzeSong', () => {
  const a = analyzeSong(clickTrack(120, 4));
  it('필수 구조를 갖춘다', () => {
    expect(a.frames.length).toBeGreaterThan(0);
    expect(a.segments.length).toBeGreaterThanOrEqual(1);
    expect(a.bands.bass.length).toBe(a.frames.length);
    expect(a.meta.frameRate).toBeCloseTo(ANALYSIS.sampleRate / ANALYSIS.hopSize, 3);
  });
  it('bands는 0..1 정규화', () => {
    for (const v of a.bands.bass) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('결정론', () => {
    const x = analyzeSong(clickTrack(120, 3));
    const y = analyzeSong(clickTrack(120, 3));
    expect(x).toEqual(y);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/song.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

Create `src/engine/analysis/song.ts`:
```ts
import { DecodedAudio, SongAnalysis } from '../types';
import { extractFeatures, frameRateOf } from './features';
import { segmentSong } from './structure';
import { normalizeArray } from '../util/dsp';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler 프로파일
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export function estimateBpm(onsets: number[], frameRate: number): number {
  const env = normalizeArray(onsets);
  const n = env.length;
  if (n < 4) return 120;
  const minBpm = 60, maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * frameRate);
  const maxLag = Math.ceil((60 / minBpm) * frameRate);
  let bestLag = minLag, bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++) sum += env[i] * env[i + lag];
    if (sum > bestVal) { bestVal = sum; bestLag = lag; }
  }
  return Math.round((60 * frameRate) / bestLag);
}

export function estimateKey(chromaSum: number[]): string {
  const norm = normalizeArray(chromaSum);
  let best = '', bestScore = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const [profile, name] of [[MAJOR, 'major'], [MINOR, 'minor']] as const) {
      let score = 0;
      for (let i = 0; i < 12; i++) score += norm[i] * profile[(i - root + 12) % 12];
      if (score > bestScore) { bestScore = score; best = `${NOTE_NAMES[root]} ${name}`; }
    }
  }
  return best;
}

export function analyzeSong(audio: DecodedAudio): SongAnalysis {
  const frames = extractFeatures(audio);
  const frameRate = frameRateOf(audio.sampleRate);
  const duration = audio.duration;
  const segments = segmentSong(frames, frameRate, duration);

  const bands = {
    bass: normalizeArray(frames.map((f) => f.band.bass)),
    mid: normalizeArray(frames.map((f) => f.band.mid)),
    high: normalizeArray(frames.map((f) => f.band.high)),
  };

  const chromaSum = new Array(12).fill(0);
  for (const f of frames) for (let i = 0; i < 12; i++) chromaSum[i] += f.chroma[i] ?? 0;

  const rmsVals = frames.map((f) => f.rms);
  const loudnessRange: [number, number] = rmsVals.length
    ? [Math.min(...rmsVals), Math.max(...rmsVals)]
    : [0, 0];
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    meta: {
      duration,
      sampleRate: audio.sampleRate,
      frameRate,
      frameCount: frames.length,
      bpm: estimateBpm(frames.map((f) => f.onset), frameRate),
      key: estimateKey(chromaSum),
    },
    frames,
    segments,
    bands,
    globals: {
      loudnessRange,
      brightnessAvg: avg(frames.map((f) => f.brightness)),
      densityAvg: avg(frames.map((f) => f.onset)),
      bandAvg: {
        bass: avg(bands.bass),
        mid: avg(bands.mid),
        high: avg(bands.high),
      },
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/song.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/analysis/song.ts tests/engine/song.test.ts
git commit -m "feat(engine): song analysis with bpm/key estimation"
```

---

### Task 6: vle/visual-language

`SongAnalysis`를 정규화된 시각 파라미터 시계열로 매핑한다. **이것이 핵심 자산**이다. 매핑 규칙표를 데이터로 분리한다.

**Files:**
- Create: `src/engine/vle/visual-language.ts`
- Test: `tests/engine/visual-language.test.ts`

**Interfaces:**
- Consumes: `SongAnalysis`, `VisualLanguage`, `VisualFrame`, `normalizeArray`, `clamp01`
- Produces:
  - `MAPPING` (규칙표 상수, 문서/특허용)
  - `buildVisualLanguage(song: SongAnalysis): VisualLanguage`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/visual-language.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildVisualLanguage } from '../../src/engine/vle/visual-language';
import { SongAnalysis } from '../../src/engine/types';

function fakeSong(): SongAnalysis {
  const N = 50;
  const frames = Array.from({ length: N }, (_, i) => ({
    time: i * 0.01,
    rms: i / N,
    brightness: 1000 + i * 100,
    flux: (i % 5) / 5,
    zcr: 0.2,
    band: { bass: i, mid: N - i, high: i % 10 },
    chroma: new Array(12).fill(1),
    onset: (i % 3) / 3,
  }));
  return {
    meta: { duration: 0.5, sampleRate: 44100, frameRate: 86, frameCount: N, bpm: 120, key: 'C major' },
    frames,
    segments: [{ index: 0, t0: 0, t1: 0.5, role: 'intro', energy: 0.5, summary: '서주의 여명' }],
    bands: {
      bass: frames.map((f) => f.band.bass / N),
      mid: frames.map((f) => f.band.mid / N),
      high: frames.map((f) => (f.band.high % 10) / 10),
    },
    globals: {
      loudnessRange: [0, 1], brightnessAvg: 3000, densityAvg: 0.5,
      bandAvg: { bass: 0.5, mid: 0.5, high: 0.5 },
    },
  };
}

describe('buildVisualLanguage', () => {
  const vl = buildVisualLanguage(fakeSong());
  it('프레임 수가 보존된다', () => {
    expect(vl.frames.length).toBe(50);
  });
  it('모든 시각 파라미터가 0..1', () => {
    for (const f of vl.frames) {
      for (const k of ['pressure','strokeLength','blur','weight','thickness','speed','lightness','density'] as const) {
        expect(f[k]).toBeGreaterThanOrEqual(0);
        expect(f[k]).toBeLessThanOrEqual(1);
      }
      expect(f.hue).toBeGreaterThanOrEqual(0);
      expect(f.hue).toBeLessThan(360);
    }
  });
  it('다이내믹(rms)이 커질수록 thickness 증가', () => {
    expect(vl.frames[49].thickness).toBeGreaterThan(vl.frames[0].thickness);
  });
  it('팔레트 hue가 12개', () => {
    expect(vl.palette.hues.length).toBe(12);
  });
  it('결정론', () => {
    expect(buildVisualLanguage(fakeSong())).toEqual(buildVisualLanguage(fakeSong()));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/visual-language.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

Create `src/engine/vle/visual-language.ts`:
```ts
import { SongAnalysis, VisualLanguage, VisualFrame } from '../types';
import { normalizeArray, clamp01 } from '../util/dsp';

// 매핑 규칙표 (핵심 자산 — 특허 명세 대상)
export const MAPPING = {
  attack_to_pressure: 'flux(정규화) → 붓 압력',
  sustain_to_length: 'rms 지속(정규화) → 붓 길이',
  reverb_to_blur: 'high대역 잔향 추정(정규화) → 번짐',
  bass_to_weight: 'bass(정규화) → 무게중심(아래)',
  dynamics_to_thickness: 'rms(정규화) → 붓 두께',
  tempo_to_speed: 'bpm + 국소 flux → 붓 속도',
  harmony_to_hue: 'chroma 최대음 → 색조',
  brightness_to_lightness: 'spectral centroid(정규화) → 명도',
  density_to_density: 'onset(정규화) → 붓 밀도',
} as const;

// 12음 → hue (5도권 기반 색상환 배치)
const CIRCLE_OF_FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
function pitchClassToHue(pc: number): number {
  const pos = CIRCLE_OF_FIFTHS.indexOf(pc);
  return (pos / 12) * 360;
}

export function buildVisualLanguage(song: SongAnalysis): VisualLanguage {
  const { frames, bands } = song;
  const N = frames.length;

  const fluxN = normalizeArray(frames.map((f) => f.flux));
  const rmsN = normalizeArray(frames.map((f) => f.rms));
  const brightN = normalizeArray(frames.map((f) => f.brightness));
  const onsetN = normalizeArray(frames.map((f) => f.onset));

  // sustain: rms의 국소 지속성(이동평균)
  const sustain = movingAvg(rmsN, 10);
  // tempo 기반 전역 속도 + 국소 flux
  const tempoBase = clamp01((song.meta.bpm - 60) / 120);

  const vframes: VisualFrame[] = frames.map((f, i) => {
    const maxPc = argmax(f.chroma);
    return {
      time: f.time,
      pressure: clamp01(fluxN[i]),
      strokeLength: clamp01(sustain[i]),
      blur: clamp01(bands.high[i]),
      weight: clamp01(bands.bass[i]),
      thickness: clamp01(rmsN[i]),
      speed: clamp01(0.5 * tempoBase + 0.5 * fluxN[i]),
      hue: pitchClassToHue(maxPc),
      lightness: clamp01(0.2 + 0.6 * brightN[i]),
      density: clamp01(onsetN[i]),
      band: { bass: bands.bass[i], mid: bands.mid[i], high: bands.high[i] },
    };
  });

  const chromaSum = new Array(12).fill(0);
  for (const f of frames) for (let k = 0; k < 12; k++) chromaSum[k] += f.chroma[k] ?? 0;
  const baseHue = pitchClassToHue(argmax(chromaSum));
  const hues = Array.from({ length: 12 }, (_, pc) => pitchClassToHue(pc));

  return { frames: vframes, palette: { baseHue, hues } };

  function movingAvg(xs: number[], w: number): number[] {
    return xs.map((_, i) => {
      let s = 0, c = 0;
      for (let j = Math.max(0, i - w); j <= Math.min(xs.length - 1, i + w); j++) { s += xs[j]; c++; }
      return c ? s / c : 0;
    });
  }
  function argmax(xs: number[]): number {
    let m = 0;
    for (let i = 1; i < xs.length; i++) if (xs[i] > xs[m]) m = i;
    return m;
  }
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/visual-language.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/vle/visual-language.ts tests/engine/visual-language.test.ts
git commit -m "feat(engine): visual language mapping engine"
```

---

### Task 7: vle/composition

`VisualLanguage` + 구간으로 캔버스 공간 배치를 만든다. 구간을 **에너지/길이 비례로 비균등 분할**하고, climax 구간을 focal로, 시작→절정→여백 흐름을 만든다.

**Files:**
- Create: `src/engine/vle/composition.ts`
- Test: `tests/engine/composition.test.ts`

**Interfaces:**
- Consumes: `VisualLanguage`, `Segment`, `CompositionMap`, `Region`
- Produces:
  - `buildComposition(vl: VisualLanguage, segments: Segment[], canvas: { width: number; height: number }): CompositionMap`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/composition.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildComposition } from '../../src/engine/vle/composition';
import { Segment, VisualLanguage } from '../../src/engine/types';

const vl: VisualLanguage = { frames: [], palette: { baseHue: 0, hues: [] } };
const segments: Segment[] = [
  { index: 0, t0: 0, t1: 10, role: 'intro', energy: 0.2, summary: '서주의 여명' },
  { index: 1, t0: 10, t1: 20, role: 'build', energy: 0.5, summary: '긴장과 상승' },
  { index: 2, t0: 20, t1: 30, role: 'climax', energy: 1.0, summary: '폭풍의 절정' },
  { index: 3, t0: 30, t1: 40, role: 'outro', energy: 0.1, summary: '침묵의 마침표' },
];

describe('buildComposition', () => {
  const comp = buildComposition(vl, segments, { width: 1600, height: 900 });
  it('구간 수만큼 region', () => {
    expect(comp.regions.length).toBe(4);
  });
  it('region들의 너비 합이 ≈1', () => {
    const sum = comp.regions.reduce((a, r) => a + r.w, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
  it('climax 구간이 focal=true', () => {
    expect(comp.regions[2].focal).toBe(true);
    expect(comp.regions.filter((r) => r.focal).length).toBe(1);
  });
  it('에너지 큰 구간이 더 넓다(비균등 분할)', () => {
    expect(comp.regions[2].w).toBeGreaterThan(comp.regions[3].w);
  });
  it('flow 경로 점이 구간 수만큼', () => {
    expect(comp.flow.length).toBe(4);
  });
  it('결정론', () => {
    const a = buildComposition(vl, segments, { width: 800, height: 600 });
    const b = buildComposition(vl, segments, { width: 800, height: 600 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/composition.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

Create `src/engine/vle/composition.ts`:
```ts
import { CompositionMap, Region, Segment, VisualLanguage } from '../types';

export function buildComposition(
  _vl: VisualLanguage,
  segments: Segment[],
  canvas: { width: number; height: number }
): CompositionMap {
  const margins = { top: 0.06, right: 0.06, bottom: 0.06, left: 0.06 };
  const innerW = 1 - margins.left - margins.right;

  // 가중치 = 길이 0.5 + 에너지 0.5 (비균등). 합으로 정규화.
  const totalDur = segments.reduce((a, s) => a + (s.t1 - s.t0), 0) || 1;
  const weights = segments.map((s) => 0.5 * ((s.t1 - s.t0) / totalDur) + 0.5 * s.energy);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;

  let climaxIdx = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].energy > segments[climaxIdx].energy) climaxIdx = i;
  }

  const regions: Region[] = [];
  let cursor = margins.left;
  segments.forEach((s, i) => {
    const w = (weights[i] / wsum) * innerW;
    // climax는 세로로 더 크게(긴장), 나머지는 약간 여백
    const focal = i === climaxIdx;
    const h = focal ? (1 - margins.top - margins.bottom) : (1 - margins.top - margins.bottom) * 0.78;
    const y = focal ? margins.top : margins.top + (1 - margins.top - margins.bottom - h) / 2;
    regions.push({ segmentIndex: s.index, x: cursor, y, w, h, focal });
    cursor += w;
  });

  const focalRegion = regions[climaxIdx];
  const focalPoint = { x: focalRegion.x + focalRegion.w / 2, y: focalRegion.y + focalRegion.h / 2 };

  // flow: 각 region 중심을 잇는 경로(시간 순)
  const flow = regions.map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }));

  return { canvas, regions, focalPoint, flow, margins };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/composition.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/vle/composition.ts tests/engine/composition.test.ts
git commit -m "feat(engine): composition map (non-uniform spatial layout)"
```

---

### Task 8: vle/brush-path

`VisualLanguage + CompositionMap + seed`로 붓 스트로크 배열을 생성한다. 각 스트로크는 시간 범위(t0~t1)·레이어 태그·색·압력·두께·번짐을 갖는다. 난수는 `mulberry32(seed)`로만.

**Files:**
- Create: `src/engine/vle/brush-path.ts`
- Test: `tests/engine/brush-path.test.ts`

**Interfaces:**
- Consumes: `VisualLanguage`, `CompositionMap`, `Segment`, `BrushStroke`, `Layer`, `mulberry32`, `cyrb53`
- Produces:
  - `buildBrushPaths(vl: VisualLanguage, comp: CompositionMap, segments: Segment[], seed: number): BrushStroke[]`
  - `dominantLayer(band: { bass: number; mid: number; high: number }): Layer`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/brush-path.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildBrushPaths, dominantLayer } from '../../src/engine/vle/brush-path';
import { buildComposition } from '../../src/engine/vle/composition';
import { Segment, VisualFrame, VisualLanguage } from '../../src/engine/types';

const segments: Segment[] = [
  { index: 0, t0: 0, t1: 1, role: 'intro', energy: 0.3, summary: '서주의 여명' },
  { index: 1, t0: 1, t1: 2, role: 'climax', energy: 1, summary: '폭풍의 절정' },
];
function vframe(time: number, over: Partial<VisualFrame> = {}): VisualFrame {
  return {
    time, pressure: 0.5, strokeLength: 0.5, blur: 0.2, weight: 0.5,
    thickness: 0.5, speed: 0.5, hue: 200, lightness: 0.5, density: 0.5,
    band: { bass: 0.3, mid: 0.3, high: 0.3 }, ...over,
  };
}
const vl: VisualLanguage = {
  frames: Array.from({ length: 40 }, (_, i) => vframe(i * 0.05)),
  palette: { baseHue: 200, hues: [] },
};
const comp = buildComposition(vl, segments, { width: 1600, height: 900 });

describe('dominantLayer', () => {
  it('가장 큰 대역을 고른다', () => {
    expect(dominantLayer({ bass: 0.9, mid: 0.1, high: 0.1 })).toBe('bass');
    expect(dominantLayer({ bass: 0.1, mid: 0.1, high: 0.9 })).toBe('high');
  });
});

describe('buildBrushPaths', () => {
  const strokes = buildBrushPaths(vl, comp, segments, 12345);
  it('스트로크가 생성된다', () => {
    expect(strokes.length).toBeGreaterThan(0);
  });
  it('각 스트로크가 캔버스 범위 내 점을 가진다', () => {
    for (const s of strokes) {
      expect(s.points.length).toBeGreaterThanOrEqual(2);
      for (const p of s.points) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1600);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(900);
      }
      expect(s.t1).toBeGreaterThanOrEqual(s.t0);
      expect(['all','bass','mid','high']).toContain(s.layer);
    }
  });
  it('결정론: 같은 seed면 동일', () => {
    const a = buildBrushPaths(vl, comp, segments, 999);
    const b = buildBrushPaths(vl, comp, segments, 999);
    expect(a).toEqual(b);
  });
  it('다른 seed면 달라진다', () => {
    const a = buildBrushPaths(vl, comp, segments, 1);
    const b = buildBrushPaths(vl, comp, segments, 2);
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/brush-path.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

Create `src/engine/vle/brush-path.ts`:
```ts
import { BrushStroke, CompositionMap, Layer, Region, Segment, VisualFrame, VisualLanguage } from '../types';
import { mulberry32 } from '../util/determinism';

export function dominantLayer(band: { bass: number; mid: number; high: number }): Layer {
  if (band.bass >= band.mid && band.bass >= band.high) return 'bass';
  if (band.high >= band.mid && band.high >= band.bass) return 'high';
  return 'mid';
}

// 프레임을 일정 간격으로 샘플링해 스트로크 1개씩 생성
const STROKE_EVERY = 3; // 프레임 N개당 스트로크 1개

export function buildBrushPaths(
  vl: VisualLanguage,
  comp: CompositionMap,
  segments: Segment[],
  seed: number
): BrushStroke[] {
  const rnd = mulberry32(seed);
  const { width, height } = comp.canvas;
  const strokes: BrushStroke[] = [];

  for (let i = 0; i < vl.frames.length; i += STROKE_EVERY) {
    const f = vl.frames[i];
    const seg = segmentAt(segments, f.time);
    const region = comp.regions.find((r) => r.segmentIndex === seg.index) ?? comp.regions[0];

    // 기준 위치: region 내, weight(bass)로 세로 위치 결정(클수록 아래)
    const baseX = (region.x + rnd() * region.w) * width;
    const baseY = (region.y + (0.2 + 0.6 * f.weight) * region.h) * height;

    // 길이/방향: strokeLength·speed. 흔들림은 rnd로(시드 결정론).
    const len = (8 + f.strokeLength * 70) * (0.6 + 0.8 * rnd());
    const angle = (f.hue / 360) * Math.PI * 2 + (rnd() - 0.5) * (0.4 + f.pressure);
    const segPts = 4;
    const points = [];
    for (let p = 0; p <= segPts; p++) {
      const t = p / segPts;
      const jitter = (rnd() - 0.5) * (4 + f.pressure * 14);
      const x = baseX + Math.cos(angle) * len * t + jitter;
      const y = baseY + Math.sin(angle) * len * t + jitter * 0.5;
      points.push({ x: clampPx(x, width), y: clampPx(y, height) });
    }

    strokes.push({
      id: `s${i}`,
      segmentIndex: seg.index,
      layer: dominantLayer(f.band),
      points,
      pressure: f.pressure,
      width: 2 + f.thickness * 22,
      length: len,
      speed: f.speed,
      color: { h: f.hue, s: 0.45 + 0.4 * f.density, l: f.lightness },
      blur: f.blur * 12,
      t0: f.time,
      t1: vl.frames[Math.min(i + STROKE_EVERY, vl.frames.length - 1)]?.time ?? f.time,
    });
  }
  return strokes;

  function clampPx(v: number, max: number): number {
    return v < 0 ? 0 : v > max ? max : v;
  }
}

function segmentAt(segments: Segment[], time: number): Segment {
  for (const s of segments) if (time >= s.t0 && time < s.t1) return s;
  return segments[segments.length - 1];
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/engine/brush-path.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/engine/vle/brush-path.ts tests/engine/brush-path.test.ts
git commit -m "feat(engine): deterministic brush path generation"
```

---

### Task 9: render/canvas + style-oil

`BrushStroke[]`를 `CanvasRenderingContext2D`에 그린다. `StyleAdapter` 인터페이스로 화풍을 분리하고 oil 어댑터를 구현한다. 레이어 필터를 지원한다. (테스트는 호출 카운트를 검증하는 fake 2D 컨텍스트로 — node-canvas 불필요.)

**Files:**
- Create: `src/engine/render/style.ts`
- Create: `src/engine/render/style-oil.ts`
- Create: `src/engine/render/canvas.ts`
- Test: `tests/engine/canvas.test.ts`

**Interfaces:**
- Consumes: `BrushStroke`, `Layer`, `CompositionMap`
- Produces:
  - `interface StyleAdapter { background(ctx, comp): void; stroke(ctx, s): void }`
  - `oilStyle: StyleAdapter`
  - `renderPainting(ctx: CanvasRenderingContext2D, strokes: BrushStroke[], comp: CompositionMap, opts?: { layer?: Layer; style?: StyleAdapter }): void`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `tests/engine/canvas.test.ts`:
```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/engine/canvas.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: StyleAdapter 인터페이스 + oil 구현**

Create `src/engine/render/style.ts`:
```ts
import { BrushStroke, CompositionMap } from '../types';

export interface StyleAdapter {
  name: string;
  background(ctx: CanvasRenderingContext2D, comp: CompositionMap): void;
  stroke(ctx: CanvasRenderingContext2D, s: BrushStroke): void;
}
```

Create `src/engine/render/style-oil.ts`:
```ts
import { StyleAdapter } from './style';

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${a})`;
}

export const oilStyle: StyleAdapter = {
  name: 'oil',
  background(ctx, comp) {
    ctx.fillStyle = '#f4f1ea'; // 캔버스 바탕(린넨톤)
    ctx.fillRect(0, 0, comp.canvas.width, comp.canvas.height);
  },
  stroke(ctx, s) {
    const pts = s.points;
    if (pts.length < 2) return;
    ctx.save();
    // 번짐 표현: blur가 크면 반투명 넓은 밑칠
    if (s.blur > 0.5) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = hsl(s.color.h, s.color.s * 0.8, Math.min(1, s.color.l + 0.1));
      ctx.lineWidth = s.width + s.blur * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawPath(ctx, pts);
    }
    // 본칠: 압력이 클수록 불투명
    ctx.globalAlpha = 0.55 + s.pressure * 0.45;
    ctx.strokeStyle = hsl(s.color.h, s.color.s, s.color.l);
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawPath(ctx, pts);
    ctx.restore();
  },
};

function drawPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}
```

- [ ] **Step 4: renderPainting 구현**

Create `src/engine/render/canvas.ts`:
```ts
import { BrushStroke, CompositionMap, Layer } from '../types';
import { StyleAdapter } from './style';
import { oilStyle } from './style-oil';

export { oilStyle };
export type { StyleAdapter };

export function renderPainting(
  ctx: CanvasRenderingContext2D,
  strokes: BrushStroke[],
  comp: CompositionMap,
  opts: { layer?: Layer; style?: StyleAdapter } = {}
): void {
  const style = opts.style ?? oilStyle;
  const layer = opts.layer ?? 'all';
  style.background(ctx, comp);
  for (const s of strokes) {
    if (layer !== 'all' && s.layer !== layer) continue;
    style.stroke(ctx, s);
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run tests/engine/canvas.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/engine/render/style.ts src/engine/render/style-oil.ts src/engine/render/canvas.ts tests/engine/canvas.test.ts
git commit -m "feat(engine): canvas renderer with oil style adapter + layer filter"
```

---

### Task 10: explain/template + playback/sync + 파사드

클릭/재생 위치 → 활성 스트로크/구간을 찾는 `playback/sync`, 분석 근거를 한국어로 풀어내는 `explain/template`, 그리고 전체를 잇는 파사드 `analyzeToPainting`을 만든다.

**Files:**
- Create: `src/engine/playback/sync.ts`
- Create: `src/engine/explain/template.ts`
- Create: `src/engine/index.ts`
- Test: `tests/engine/explain.test.ts`
- Test: `tests/engine/integration.test.ts`

**Interfaces:**
- Consumes: 전 모듈
- Produces:
  - `activeStrokesAt(strokes: BrushStroke[], time: number): BrushStroke[]`
  - `segmentAtTime(segments: Segment[], time: number): Segment`
  - `strokeNearPoint(strokes: BrushStroke[], x: number, y: number): BrushStroke | null`
  - `explainSegment(song: SongAnalysis, segment: Segment): string`
  - `explainStroke(song: SongAnalysis, stroke: BrushStroke): { texture: string; brush: string }`
  - `analyzeToPainting(audio: DecodedAudio, canvas?: {width:number;height:number}): { song: SongAnalysis; vl: VisualLanguage; comp: CompositionMap; strokes: BrushStroke[]; seed: number }`

- [ ] **Step 1: playback/sync 구현**

Create `src/engine/playback/sync.ts`:
```ts
import { BrushStroke, Segment } from '../types';

export function activeStrokesAt(strokes: BrushStroke[], time: number): BrushStroke[] {
  return strokes.filter((s) => time >= s.t0 && time <= s.t1);
}

export function segmentAtTime(segments: Segment[], time: number): Segment {
  for (const s of segments) if (time >= s.t0 && time < s.t1) return s;
  return segments[segments.length - 1];
}

export function strokeNearPoint(
  strokes: BrushStroke[],
  x: number,
  y: number
): BrushStroke | null {
  let best: BrushStroke | null = null;
  let bestD = Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}
```

- [ ] **Step 2: explain 테스트 작성 (실패)**

Create `tests/engine/explain.test.ts`:
```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run tests/engine/explain.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 4: explain 구현**

Create `src/engine/explain/template.ts`:
```ts
import { BrushStroke, Segment, SongAnalysis } from '../types';

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const LAYER_KR: Record<BrushStroke['layer'], string> = {
  all: '전체', bass: '저음(베이스)', mid: '중음', high: '고음(심벌·하이햇)',
};

export function explainSegment(song: SongAnalysis, segment: Segment): string {
  const t = `${mmss(segment.t0)}~${mmss(segment.t1)}`;
  const energyWord = segment.energy > 0.66 ? '강한 에너지' : segment.energy > 0.33 ? '중간 정도의 흐름' : '잔잔한 기운';
  return `${t} — "${segment.summary}" 구간입니다. 이 곡(${song.meta.key}, ${song.meta.bpm} BPM)에서 ` +
    `${energyWord}을(를) 가진 부분으로, 화면의 해당 영역에 그 분위기가 공간으로 번역되었습니다.`;
}

export function explainStroke(
  song: SongAnalysis,
  stroke: BrushStroke
): { texture: string; brush: string } {
  const time = mmss(stroke.t0);
  const layer = LAYER_KR[stroke.layer];
  const hueName = hueToName(stroke.color.h);

  const texture =
    `${time} · ${layer} — 명도 ${(stroke.color.l * 100) | 0}%의 ${hueName} 계열로, ` +
    (stroke.blur > 6 ? '잔향이 많아 번지듯 부드럽게' : '윤곽이 또렷하게') + ' 표현되었습니다.';

  const pressureWord = stroke.pressure > 0.66 ? '강한 Attack으로 거친 붓이' :
    stroke.pressure > 0.33 ? '중간 압력의 붓이' : '약한 압력의 붓이';
  const speedWord = stroke.speed > 0.6 ? '빠르게' : stroke.speed > 0.3 ? '차분하게' : '천천히';
  const brush =
    `이 구간은 ${pressureWord} ${speedWord} 지나가는 질감으로 그려졌습니다. ` +
    `붓 두께 ${Math.round(stroke.width)}px, 길이 약 ${Math.round(stroke.length)}px.`;

  return { texture, brush };
}

function hueToName(h: number): string {
  if (h < 30 || h >= 330) return '붉은';
  if (h < 70) return '노란';
  if (h < 160) return '초록';
  if (h < 200) return '청록';
  if (h < 260) return '파란';
  return '보라';
}
```

- [ ] **Step 5: explain 통과 확인**

Run: `npx vitest run tests/engine/explain.test.ts`
Expected: PASS

- [ ] **Step 6: 파사드 + 통합 테스트 작성 (실패)**

Create `src/engine/index.ts`:
```ts
import { DecodedAudio, SongAnalysis, VisualLanguage, CompositionMap, BrushStroke } from './types';
import { analyzeSong } from './analysis/song';
import { buildVisualLanguage } from './vle/visual-language';
import { buildComposition } from './vle/composition';
import { buildBrushPaths } from './vle/brush-path';
import { cyrb53 } from './util/determinism';

export * from './types';
export { analyzeSong } from './analysis/song';
export { buildVisualLanguage } from './vle/visual-language';
export { buildComposition } from './vle/composition';
export { buildBrushPaths } from './vle/brush-path';
export { renderPainting, oilStyle } from './render/canvas';
export { activeStrokesAt, segmentAtTime, strokeNearPoint } from './playback/sync';
export { explainSegment, explainStroke } from './explain/template';
export { decodeAudioData } from './audio/decode';

export function analyzeToPainting(
  audio: DecodedAudio,
  canvas: { width: number; height: number } = { width: 1600, height: 900 }
): { song: SongAnalysis; vl: VisualLanguage; comp: CompositionMap; strokes: BrushStroke[]; seed: number } {
  const song = analyzeSong(audio);
  const vl = buildVisualLanguage(song);
  const comp = buildComposition(vl, song.segments, canvas);
  const seed = cyrb53(JSON.stringify(song.meta) + song.segments.map((s) => s.role).join(''));
  const strokes = buildBrushPaths(vl, comp, song.segments, seed);
  return { song, vl, comp, strokes, seed };
}
```

Create `tests/engine/integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { analyzeToPainting } from '../../src/engine';
import { ANALYSIS, DecodedAudio } from '../../src/engine/types';

// 구조가 변하는 합성곡: 조용→밝고 큰 부분
function song(seconds: number): DecodedAudio {
  const n = Math.floor(ANALYSIS.sampleRate * seconds);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const loud = i > n / 2;
    const amp = loud ? 0.8 : 0.1;
    const freq = loud ? 880 : 220;
    mono[i] = amp * Math.sin((2 * Math.PI * freq * i) / ANALYSIS.sampleRate);
  }
  return { sampleRate: ANALYSIS.sampleRate, length: n, duration: seconds, channels: [mono], mono };
}

describe('analyzeToPainting (통합)', () => {
  it('전 파이프라인이 스트로크를 산출한다', () => {
    const r = analyzeToPainting(song(8));
    expect(r.strokes.length).toBeGreaterThan(0);
    expect(r.song.segments.length).toBeGreaterThanOrEqual(1);
    expect(r.comp.regions.length).toBe(r.song.segments.length);
  });
  it('결정론: 같은 곡 → byte 단위 동일 결과(90% 유사성 요건의 상한)', () => {
    const a = analyzeToPainting(song(6));
    const b = analyzeToPainting(song(6));
    expect(a.seed).toBe(b.seed);
    expect(JSON.stringify(a.strokes)).toBe(JSON.stringify(b.strokes));
  });
});
```

- [ ] **Step 7: 통합 통과 확인**

Run: `npx vitest run`
Expected: 모든 테스트 PASS (전 모듈 + 통합)

- [ ] **Step 8: 커밋**

```bash
git add src/engine/playback/sync.ts src/engine/explain/template.ts src/engine/index.ts tests/engine/explain.test.ts tests/engine/integration.test.ts
git commit -m "feat(engine): playback sync, explanations, and pipeline facade"
```

---

## Self-Review (작성자 체크 결과)

**Spec 커버리지** (설계 문서 §2 파이프라인 대비):
- decode ✔ Task2 · features ✔ Task3 · structure ✔ Task4 · song(BPM/key) ✔ Task5 ·
  visual-language ✔ Task6 · composition ✔ Task7 · brush-path ✔ Task8 ·
  render(+oil, layer 필터) ✔ Task9 · playback/sync ✔ Task10 · explain ✔ Task10 ·
  결정론(seed/PRNG) ✔ Task1+Task10 통합 테스트 · 악기 레이어(대역) ✔ Task8 dominantLayer/Task9 필터.
- 설계 성공기준 §9: (1)그림 생성=통합테스트, (2)결정론=integration.test, (3)재생강조=sync,
  (4)클릭 해설=explain, (5)레이어 토글=render layer 옵션, (6)화풍 교체=StyleAdapter. 모두 커버.
- UI(설계 §4)와 저장은 **플랜 2**로 분리(의도적). 이 플랜은 엔진만.

**Placeholder 스캔:** 없음(모든 step에 실제 코드/명령/기대출력 포함).

**타입 일관성:** `FrameFeatures`·`SongAnalysis`·`VisualFrame`·`VisualLanguage`·`Region`·
`CompositionMap`·`BrushStroke`·`Layer`를 Task1에서 정의하고 이후 동일 시그니처로만 사용.
함수명 일관: `extractFeatures`/`segmentSong`/`analyzeSong`/`buildVisualLanguage`/
`buildComposition`/`buildBrushPaths`/`renderPainting`/`analyzeToPainting`.

> 알려진 리스크(구현 중 확인): Meyda의 `spectralCentroid`/`amplitudeSpectrum` 반환 형식이
> 버전에 따라 다를 수 있음 → Task3 Step4 주석의 조정 절차 참조. Node에서 Meyda 오프라인
> `extract` 동작이 막히면, 동일 인터페이스의 경량 FFT(예: 직접 구현 radix-2)로 대체 가능.
