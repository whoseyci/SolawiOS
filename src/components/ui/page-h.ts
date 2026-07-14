// Page header with title, subtitle, and action buttons
import { h, esc } from '../../lib/dom';

export interface PageHOptions {
  title: string;
  desc?: string;
  actions?: string; // HTML for action buttons
}

export function pageH({ title, desc = '', actions = '' }: PageHOptions): HTMLElement {
  return h(`
    <div class="page-h">
      <div>
        <h1 class="page-title">${esc(title)}</h1>
        ${desc ? `<div class="page-desc">${desc}</div>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>
  `) as HTMLElement;
}
