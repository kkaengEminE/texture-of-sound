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
