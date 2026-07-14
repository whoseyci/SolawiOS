// Donut chart with legend.
import { setupCanvas, cssVar } from './canvas-utils';

export function drawDonut(canvas: HTMLCanvasElement, data: Array<{ label: string; value: number; color: string }>): void {
  const { ctx, width: W, height: H } = setupCanvas(canvas);
  ctx.clearRect(0, 0, W, H);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = W / 2 - 60, cy = H / 2, r = Math.min(W, H) / 2 - 20, ir = r * 0.55;
  let a0 = -Math.PI / 2;
  data.forEach(d => {
    if (d.value <= 0) return;
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    a0 = a1;
  });
  ctx.fillStyle = cssVar('--bg-card') || '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cssVar('--ink') || '#000';
  ctx.font = 'bold 18px serif'; ctx.textAlign = 'center';
  ctx.fillText(total.toLocaleString('de-DE'), cx, cy - 2);
  ctx.font = '10px sans-serif';
  ctx.fillStyle = cssVar('--ink-soft') || '#666';
  ctx.fillText('Gesamt', cx, cy + 12);
  // Legend
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  const lx = W - 130;
  let ly = 16;
  for (const d of data) {
    if (d.value <= 0) continue;
    ctx.fillStyle = d.color;
    ctx.fillRect(lx, ly - 8, 10, 10);
    ctx.fillStyle = cssVar('--ink') || '#000';
    ctx.fillText(`${d.label}: ${d.value}`, lx + 14, ly);
    ly += 18;
  }
}
