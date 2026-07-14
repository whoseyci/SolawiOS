// Shared canvas helpers

export interface CanvasContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/** Set up a high-DPI canvas and return its 2D context + size. */
export function setupCanvas(canvas: HTMLCanvasElement, dpr = window.devicePixelRatio || 1): CanvasContext {
  const parent = canvas.parentElement!;
  const width = parent.clientWidth;
  const height = canvas.height || 220;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

export const cssVar = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const PIE_COLORS = ['#4a7c3a','#3a6e8a','#c97a3a','#b8860b','#a83a2a','#8a3a6a','#6cae57','#5a9a4a'];

/** Pick a stable color for a string (used for "Sonstige" categories). */
export function pickColor(s: string, palette = PIE_COLORS): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
