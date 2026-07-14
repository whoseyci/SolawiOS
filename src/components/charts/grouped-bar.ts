// Grouped bar chart for two related series (e.g. income/expense).
import { setupCanvas, cssVar } from './canvas-utils';

export function drawGroupedBar(
  canvas: HTMLCanvasElement,
  data: Array<{ label: string; [k: string]: number | string }>,
  key1: string, key2: string,
  color1 = '#4a7c3a', color2 = '#a83a2a',
  label1 = 'Einnahmen', label2 = 'Ausgaben'
): void {
  const { ctx, width: W, height: H } = setupCanvas(canvas, undefined);
  const max = Math.max(...data.map(d => Math.max(Number(d[key1]) || 0, Number(d[key2]) || 0)), 1);
  const pad = { l: 50, r: 8, t: 16, b: 32 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;

  ctx.strokeStyle = cssVar('--line') || '#e3ddc9';
  ctx.fillStyle = cssVar('--ink-muted') || '#888';
  ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(Math.round(max - (max / 4) * i).toString(), pad.l - 4, y + 3);
  }
  const bw = w / data.length;
  data.forEach((d, i) => {
    const x = pad.l + i * bw + 2;
    const bw1 = (bw - 6) / 2;
    const v1 = Number(d[key1]) || 0, v2 = Number(d[key2]) || 0;
    if (v1) {
      const bh = (v1 / max) * h;
      ctx.fillStyle = color1;
      ctx.fillRect(x, pad.t + h - bh, bw1, bh);
    }
    if (v2) {
      const bh = (v2 / max) * h;
      ctx.fillStyle = color2;
      ctx.fillRect(x + bw1 + 2, pad.t + h - bh, bw1, bh);
    }
  });
  ctx.fillStyle = cssVar('--ink-muted') || '#888';
  ctx.textAlign = 'center';
  data.forEach((d, i) => ctx.fillText(String(d.label), pad.l + i * bw + bw / 2, H - 14));
  // Legend
  ctx.fillStyle = color1; ctx.fillRect(W - 160, 8, 10, 10);
  ctx.fillStyle = cssVar('--ink') || '#000';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label1, W - 146, 16);
  ctx.fillStyle = color2; ctx.fillRect(W - 80, 8, 10, 10);
  ctx.fillText(label2, W - 66, 16);
}
