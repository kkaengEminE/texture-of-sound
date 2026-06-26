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
