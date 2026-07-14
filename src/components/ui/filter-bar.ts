// Filter bar with search and dropdowns
import { h, esc } from '../../lib/dom';

export interface FilterField {
  type: 'search' | 'select';
  id: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: string; // inline JS string
}

export interface FilterBarOptions {
  fields: FilterField[];
  countEl?: string; // HTML for count display
}

export function filterBar(opts: FilterBarOptions): HTMLElement {
  const fields = opts.fields.map(f => {
    if (f.type === 'search') {
      return `<div class="topbar-search"><input type="text" id="${f.id}" placeholder="${esc(f.placeholder ?? '')}" ${f.onChange ? `oninput="${f.onChange}"` : ''}/></div>`;
    }
    return `<select id="${f.id}" ${f.onChange ? `onchange="${f.onChange}"` : ''}>
      ${(f.options ?? []).map(o => `<option value="${esc(o.value)}"${f.value === o.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>`;
  }).join('');
  return h(`
    <div class="filter-bar">
      ${fields}
      <div class="grow"></div>
      ${opts.countEl ?? ''}
    </div>
  `) as HTMLElement;
}
