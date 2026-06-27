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
    // 번짐 표현: blur > 0.5이면 shadowBlur로 구현 (ctx.stroke()는 1번만 호출)
    if (s.blur > 0.5) {
      ctx.shadowBlur = s.blur * 2;
      ctx.shadowColor = hsl(s.color.h, s.color.s * 0.8, Math.min(1, s.color.l + 0.1), 0.4);
    }
    // 본칠: 압력이 클수록 불투명
    ctx.globalAlpha = 0.55 + s.pressure * 0.45;
    ctx.strokeStyle = hsl(s.color.h, s.color.s, s.color.l);
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    buildPath(ctx, pts);
    ctx.stroke(); // 스트로크당 ctx.stroke() 정확히 1회
    ctx.restore();
  },
};

function buildPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}
