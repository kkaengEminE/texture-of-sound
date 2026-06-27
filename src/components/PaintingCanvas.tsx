'use client';
import { useEffect, useRef } from 'react';
import { renderPainting, activeStrokesAt, strokeNearPoint } from '@/engine';
import type { BrushStroke, CompositionMap, Layer } from '@/engine';
import { displayToInternal } from '@/lib/canvas-geometry';

const W = 1600, H = 900;

export function PaintingCanvas({
  strokes, comp, layer, currentTime, onPick,
}: {
  strokes: BrushStroke[]; comp: CompositionMap; layer: Layer;
  currentTime: number; onPick: (s: BrushStroke) => void;
}) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // 정적 그림: strokes/layer 변경 시에만
  useEffect(() => {
    const ctx = baseRef.current?.getContext('2d');
    if (!ctx) return;
    renderPainting(ctx, strokes, comp, { layer });
  }, [strokes, comp, layer]);

  // 재생 하이라이트 오버레이: currentTime 변경 시
  useEffect(() => {
    const ctx = overlayRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const active = activeStrokesAt(strokes, currentTime).filter((s) => layer === 'all' || s.layer === layer);
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (const s of active) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = s.width + 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }, [currentTime, strokes, layer]);

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = displayToInternal(e.clientX, e.clientY, rect, { width: W, height: H });
    const visible = strokes.filter((s) => layer === 'all' || s.layer === layer);
    const s = strokeNearPoint(visible, x, y);
    if (s) onPick(s);
  }

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }}>
      <canvas ref={baseRef} width={W} height={H} className="absolute inset-0 h-full w-full rounded-lg" />
      <canvas
        ref={overlayRef} width={W} height={H}
        className="absolute inset-0 h-full w-full cursor-crosshair"
        onClick={handleClick}
      />
    </div>
  );
}
