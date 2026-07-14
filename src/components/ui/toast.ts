// Toast notifications
import { h, clear } from '../../lib/dom';
import { icon } from '../../lib/icons';
import type { ToastOptions } from '../../types';

let tray: HTMLElement | null = null;
function getTray(): HTMLElement {
  if (!tray) {
    tray = h('<div class="toast-tray"></div>') as HTMLElement;
    document.body.appendChild(tray);
  }
  return tray;
}

export function toast(msg: string, opts: ToastOptions = {}): void {
  const { kind = '', duration = 2400 } = opts;
  const node = h(`
    <div class="toast ${kind}">
      ${kind === 'success' ? icon('check-circle') : kind === 'error' ? icon('warning-circle') : kind === 'warn' ? icon('warning') : icon('info')}
      <span style="margin-left:8px"></span>
    </div>
  `) as HTMLElement;
  node.querySelector('span')!.textContent = msg;
  getTray().appendChild(node);
  setTimeout(() => { node.style.opacity = '0'; }, duration);
  setTimeout(() => { clear(node); node.remove(); }, duration + 300);
}
