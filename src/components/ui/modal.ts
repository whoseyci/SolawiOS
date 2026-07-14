// Modal dialog component — clean open/close API, event-based.
import { h, $ } from '../../lib/dom';
import { icon } from '../../lib/icons';

export interface ModalOptions {
  title: string;
  body: string | Node;
  footer?: string | Node;
  wide?: boolean;
  xwide?: boolean;
  onClose?: () => void;
  /** Render into a specific parent (defaults to document.body). */
  parent?: HTMLElement;
}

export interface ModalHandle {
  root: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement | null;
  close: () => void;
}

const stack: HTMLElement[] = [];

export function openModal(opts: ModalOptions): ModalHandle {
  const back = h(`<div class="modal-backdrop"></div>`) as HTMLElement;
  const modal = h(`<div class="modal ${opts.wide ? 'wide' : ''} ${opts.xwide ? 'xwide' : ''}"></div>`) as HTMLElement;
  const head = h(`
    <div class="modal-h">
      <div class="modal-title"></div>
      <button class="icon-btn" data-close aria-label="Schließen">${icon('x')}</button>
    </div>
  `) as HTMLElement;
  const body = h(`<div class="modal-body"></div>`) as HTMLElement;
  head.querySelector('.modal-title')!.textContent = opts.title;
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else if (opts.body) body.appendChild(opts.body);

  let footer: HTMLElement | null = null;
  if (opts.footer) {
    footer = h(`<div class="modal-footer modal-f"></div>`) as HTMLElement;
    if (typeof opts.footer === 'string') footer.innerHTML = opts.footer;
    else footer.appendChild(opts.footer);
  }

  modal.append(head, body);
  if (footer) modal.append(footer);
  back.appendChild(modal);

  const close = () => {
    back.remove();
    const i = stack.indexOf(back);
    if (i >= 0) stack.splice(i, 1);
    opts.onClose?.();
  };
  head.querySelector('[data-close]')!.addEventListener('click', close);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  modal.addEventListener('click', e => e.stopPropagation());

  (opts.parent ?? document.body).appendChild(back);
  stack.push(back);
  return { root: back, body, footer, close };
}

export function closeTopModal(): void {
  const top = stack[stack.length - 1];
  top?.querySelector('.modal')?.parentElement?.remove();
  if (top) stack.pop();
}

export function confirmDialog(opts: { title?: string; message: string; okText?: string; okClass?: string; cancelText?: string } = { message: '' }): Promise<boolean> {
  const { title = 'Bestätigen', message, okText = 'Bestätigen', okClass = 'btn-primary', cancelText = 'Abbrechen' } = opts;
  return new Promise(resolve => {
    const m = openModal({
      title,
      body: `<p style="margin:0;color:var(--ink-soft)">${message}</p>`,
      footer: `
        <button class="btn" data-cancel>${cancelText}</button>
        <button class="btn ${okClass}" data-ok>${okText}</button>
      `,
      onClose: () => resolve(false),
    });
    m.footer!.querySelector('[data-ok]')!.addEventListener('click', () => { m.close(); resolve(true); });
    m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => { m.close(); resolve(false); });
  });
}

/** Convenience to query inside an open modal from the caller. */
export const $inModal = (sel: string, m: ModalHandle) => $(sel, m.body);
