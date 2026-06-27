import {
  DecodedAudio, SongAnalysis, CompositionMap, BrushStroke,
  analyzeSong, buildVisualLanguage, buildComposition, buildBrushPaths,
} from '@/engine';
// TODO: @/engine에서 cyrb53가 re-export되면 이 deep import를 교체할 것 (엔진 수정 금지 제약으로 현재 deep import 유지)
import { cyrb53 } from '@/engine/util/determinism';

export type Stage = 'analyze' | 'visual' | 'compose' | 'brush' | 'done';
export type ProgressMsg = { stage: Stage; percent: number };
export interface PipelineResult {
  song: SongAnalysis; comp: CompositionMap; strokes: BrushStroke[]; seed: number;
}

const CANVAS = { width: 1600, height: 900 };

export function runPipeline(
  audio: DecodedAudio,
  onProgress?: (m: ProgressMsg) => void
): PipelineResult {
  const report = (stage: Stage, percent: number) => onProgress?.({ stage, percent });

  report('analyze', 5);
  const song = analyzeSong(audio);
  report('visual', 40);
  const vl = buildVisualLanguage(song);
  report('compose', 60);
  const comp = buildComposition(vl, song.segments, CANVAS);
  report('brush', 80);
  // seed 유도는 engine analyzeToPainting과 동일해야 한다
  const seed = cyrb53(JSON.stringify(song.meta) + song.segments.map((s) => s.role).join(''));
  const strokes = buildBrushPaths(vl, comp, song.segments, seed);
  report('done', 100);
  return { song, comp, strokes, seed };
}
