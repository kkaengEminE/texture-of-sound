import type { SongAnalysis, CompositionMap, BrushStroke } from '@/engine';

export interface StoredPainting {
  seed: number;
  song: SongAnalysis;
  comp: CompositionMap;
  strokes: BrushStroke[];
  meta: { title: string; duration: number; createdAt: number };
}
