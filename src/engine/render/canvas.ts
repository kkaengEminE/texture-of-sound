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
