import { BrushStroke, CompositionMap } from '../types';

export interface StyleAdapter {
  name: string;
  background(ctx: CanvasRenderingContext2D, comp: CompositionMap): void;
  stroke(ctx: CanvasRenderingContext2D, s: BrushStroke): void;
}
