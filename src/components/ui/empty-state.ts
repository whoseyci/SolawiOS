// Empty state
import { h, esc } from '../../lib/dom';
import { icon } from '../../lib/icons';

export function emptyState(title: string, desc: string = '', iconName: string = 'package'): HTMLElement {
  return h(`
    <div class="empty-state">
      <div class="icon">${icon(iconName)}</div>
      <h3>${esc(title)}</h3>
      ${desc ? `<p>${esc(desc)}</p>` : ''}
    </div>
  `) as HTMLElement;
}
