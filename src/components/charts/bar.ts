// Bar chart: time series with one value per label.
import { setupCanvas, cssVar } from './canvas-utils';

export function drawBar(canvas: HTMLCanvasElement, data: Array<{ label: string; value: number }>, color = '#4a7c3a'): void {
  const { ctx, width: W, height: H } = setupCanvas(canvas);
  ctx.clearRect(0, 0, W, H);
  const max = Math.max(...data.map(d => d.value), 1);
  const pad = { l: 30, r: 8, t: 8, b: 28 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
  const grid = cssVar('--line') || '#e3ddc9';
  const muted = cssVar('--ink-muted') || '#888';
  const line = cssVar('--line-strong') || '#bbb';

  ctx.strokeStyle = grid; ctx.lineWidth = 1;
  ctx.fillStyle = muted; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(Math.round(max - (max / 4) * i).toString(), pad.l - 4, y + 3);
  }
  const bw = w / data.length;
  ctx.fillStyle = color;
  data.forEach((d, i) => {
    const bh = (d.value / max) * h;
    const x = pad.l + i * bw + 2;
    const y = pad.t + h - bh;
    if (d.value > 0) ctx.fillRect(x, y, Math.max(1, bw - 4), bh);
    if (d.value === 0) {
      ctx.fillStyle = line;
      ctx.fillRect(x, pad.t + h - 1, Math.max(1, bw - 4), 1);
      ctx.fillStyle = color;
    }
  });
  ctx.fillStyle = muted; ctx.textAlign = 'center';
  data.forEach((d, i) => {
    if (i % 2 === 0) ctx.fillText(d.label, pad.l + i * bw + bw / 2, H - 14);
  });
}
