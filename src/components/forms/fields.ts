// Form field helpers — string templates used inside modal bodies.
// Kept minimal; complex forms build their own markup in the page module.

import { esc } from '../../lib/dom';

export const formRow = {
  /** A simple input row. */
  input(id: string, label: string, opts: { value?: string; type?: string; placeholder?: string; required?: boolean; help?: string } = {}): string {
    const parts: string[] = ['id="' + id + '"', 'type="' + (opts.type ?? 'text') + '"'];
    if (opts.value !== undefined) parts.push('value="' + esc(opts.value) + '"');
    if (opts.placeholder) parts.push('placeholder="' + esc(opts.placeholder) + '"');
    if (opts.required) parts.push('required');
    const required = opts.required ? ' <span class="required">*</span>' : '';
    const help = opts.help ? '<div class="form-help">' + esc(opts.help) + '</div>' : '';
    return '<div class="form-row"><label>' + esc(label) + required + '</label><input ' + parts.join(' ') + '/>' + help + '</div>';
  },

  /** A select row. */
  select(id: string, label: string, options: Array<{ value: string; label: string }>, opts: { value?: string; required?: boolean; help?: string } = {}): string {
    const optsHtml = options.map(o =>
      '<option value="' + esc(o.value) + '"' + (opts.value === o.value ? ' selected' : '') + '>' + esc(o.label) + '</option>'
    ).join('');
    const required = opts.required ? ' <span class="required">*</span>' : '';
    const help = opts.help ? '<div class="form-help">' + esc(opts.help) + '</div>' : '';
    return '<div class="form-row"><label>' + esc(label) + required + '</label><select id="' + id + '">' + optsHtml + '</select>' + help + '</div>';
  },

  /** A textarea row. */
  textarea(id: string, label: string, opts: { value?: string; rows?: number; placeholder?: string; required?: boolean; help?: string } = {}): string {
    const required = opts.required ? ' <span class="required">*</span>' : '';
    const help = opts.help ? '<div class="form-help">' + esc(opts.help) + '</div>' : '';
    return '<div class="form-row"><label>' + esc(label) + required + '</label><textarea id="' + id + '" rows="' + (opts.rows ?? 3) + '" placeholder="' + (opts.placeholder ? esc(opts.placeholder) : '') + '">' + esc(opts.value ?? '') + '</textarea>' + help + '</div>';
  },

  section(title: string): string {
    return '<div class="form-section">' + esc(title) + '</div>';
  },

  grid(items: string[], columns: 2 | 3 = 2): string {
    return '<div class="form-grid' + (columns === 3 ? '-3' : '') + '">' + items.join('') + '</div>';
  },
};
