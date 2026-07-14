// Time-series bar chart with a "today" indicator.
import { setupCanvas, cssVar } from './canvas-utils';
import { sameDay } from '../../lib/date';
import { TODAY } from '../../lib/date';

export function drawTimeSeries(
  canvas: HTMLCanvasElement,
  dates: Date[],
  values: number[],
  options: { today?: Date; height?: number } = {}
): void {
  const { today = TODAY, height = 200 } = options;
  const { ctx, width: W, height: H } = setupCanvas(canvas);
  if (H !== height) { /* noop, we already set it via attribute */ }
  ctx.clearRect(0, 0, W, H);
  const data = dates.map((d, i) => ({ date: d, value: values[i] || 0 }));
  const max = Math.max(...data.map(d => d.value), 1);
  const pad = { l: 30, r: 8, t: 8, b: 18 };
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b;

  ctx.strokeStyle = cssVar('--line') || '#e3ddc9';
  ctx.lineWidth = 1;
  ctx.fillStyle = cssVar('--ink-muted') || '#888';
  ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    ctx.fillText(Math.round(max - (max / 4) * i).toString(), pad.l - 4, y + 3);
  }
  const bw = w / data.length;
  const futureColor = cssVar('--line-strong') || '#bbb';
  const pastColor = '#4a7c3a';
  data.forEach((d, i) => {
    const bh = (d.value / max) * h;
    const x = pad.l + i * bw;
    const y = pad.t + h - bh;
    if (d.value > 0) {
      ctx.fillStyle = d.date > today ? futureColor : pastColor;
      ctx.fillRect(x + 0.5, y, Math.max(1, bw - 1), bh);
    }
  });
  const todayIdx = data.findIndex(d => sameDay(d.date, today));
  if (todayIdx >= 0) {
    const x = pad.l + todayIdx * bw + bw / 2;
    ctx.strokeStyle = cssVar('--accent') || '#c97a3a';
    ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + h); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = cssVar('--ink-muted') || '#888';
  ctx.textAlign = 'center';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor((i / 5) * (data.length - 1));
    const d = data[idx].date;
    ctx.fillText(`${d.getDate()}.${d.getMonth() + 1}.`, pad.l + idx * bw + bw / 2, H - 4);
  }
}
