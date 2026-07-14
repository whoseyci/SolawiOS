// Badge component
import { esc } from '../../lib/dom';

type Tone = 'primary' | 'accent' | 'warn' | 'danger' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  primary: 'badge-primary',
  accent: 'badge-accent',
  warn: 'badge-warn',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

export function badge(text: string | number, tone: Tone = 'neutral', dot = false): string {
  return `<span class="badge ${TONE_CLASS[tone]}">${dot ? '<span class="dot" style="background:currentColor"></span>' : ''}${esc(text)}</span>`;
}
