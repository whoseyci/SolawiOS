import { el, mount, sheet, toast, spinner } from '../lib/ui.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';

interface Summary {
  totalCostCents: number; totalIncomeCents: number; targetFromSharesCents: number;
  costsByCategory: Array<{ category: string; cents: number }>;
  incomeBySource: Array<{ source: string; cents: number; sharePct: number }>;
  dependencyWarnings: string[];
}

/** Full-cost accounting, multiple income sources, and the wage reality check. */
export function renderFinance(root: HTMLElement): void {
  const season = String(new Date().getFullYear());
  const box = el('div', {}, spinner());
  mount(root, box);

  async function load(): Promise<void> {
    try {
      const { data } = await get<{ summary: Summary | null }>(`/api/finance/summary?season=${season}`);
      const s = data.summary;

      mount(box,
        el('div', { class: 'card' },
          el('h2', {}, `${t('fin.title')} ${season}`),
          el('div', { class: 'row-between' },
            el('span', {}, t('fin.costs')),
            el('strong', {}, fmt.money(s?.totalCostCents ?? 0))),
          el('div', { class: 'row-between' },
            el('span', {}, t('fin.income')),
            el('strong', {}, fmt.money(s?.totalIncomeCents ?? 0))),
          el('hr', { style: 'border:none;border-top:1px solid var(--line);margin:.6rem 0' }),
          el('div', { class: 'row-between' },
            el('span', {}, el('strong', {}, t('fin.target'))),
            el('strong', { style: 'font-size:1.2rem' }, fmt.money(s?.targetFromSharesCents ?? 0))),
          el('p', { class: 'hint' }, t('fin.targetHint')),
        ),

        // A farm drawing a third of its income from one side business has a
        // different risk profile — worth saying out loud.
        s && s.dependencyWarnings.length > 0 && el('div', { class: 'banner banner-offline' },
          t('fin.dependency', { sources: s.dependencyWarnings.join(', ') })),

        s && s.costsByCategory.length > 0 && el('div', { class: 'card' },
          el('h3', {}, t('fin.byCategory')),
          ...s.costsByCategory.map((c) => el('div', { class: 'row-between' },
            el('span', {}, t(`fin.cat.${c.category}`)),
            el('span', {}, fmt.money(c.cents)))),
        ),

        s && s.incomeBySource.length > 0 && el('div', { class: 'card' },
          el('h3', {}, t('fin.bySource')),
          ...s.incomeBySource.map((i) => el('div', { class: 'row-between' },
            el('span', {}, t(`fin.src.${i.source}`)),
            el('span', {}, fmt.money(i.cents), ' ', el('span', { class: 'muted' }, `${i.sharePct}%`)))),
        ),

        el('div', { class: 'row', style: 'gap:.5rem' },
          el('button', { class: 'btn', style: 'flex:1', onclick: () => lineSheet('cost') }, t('fin.addCost')),
          el('button', { class: 'btn', style: 'flex:1', onclick: () => lineSheet('income') }, t('fin.addIncome')),
        ),
        el('button', { class: 'btn btn-block', style: 'margin-top:.5rem', onclick: wageSheet },
          t('fin.wageCheck')),
      );
    } catch {
      mount(box, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  }

  function lineSheet(kind: 'cost' | 'income'): void {
    const cats = kind === 'cost'
      ? ['wages', 'social_contributions', 'holiday_cover', 'seeds', 'machinery', 'fuel',
         'rent', 'insurance', 'admin', 'repairs', 'reserve', 'other']
      : ['shares', 'merch', 'markets', 'donations', 'events', 'education', 'grants', 'other'];

    const sel = el('select', {}, ...cats.map((c) =>
      el('option', { value: c }, t(`fin.${kind === 'cost' ? 'cat' : 'src'}.${c}`)))) as HTMLSelectElement;
    const label = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const amount = el('input', { type: 'number', step: '0.01', required: true }) as HTMLInputElement;

    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const cents = Math.round(Number(amount.value) * 100);
        await post(kind === 'cost' ? '/api/finance/costs' : '/api/finance/income',
          kind === 'cost'
            ? { season, category: sel.value, label: label.value, cents }
            : { season, source: sel.value, label: label.value, cents });
        close(); void load();
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('fin.category')), sel),
      el('div', { class: 'field' }, el('label', {}, t('fin.label')), label),
      el('div', { class: 'field' }, el('label', {}, `${t('fin.amount')} (€)`), amount),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(kind === 'cost' ? t('fin.addCost') : t('fin.addIncome'), body);
  }

  /** SF-002: catch an unpayable wage before it becomes unraisable. */
  function wageSheet(): void {
    const annual = el('input', { type: 'number', value: '30000', step: '500' }) as HTMLInputElement;
    const hours = el('input', { type: 'number', value: '45', min: '1' }) as HTMLInputElement;
    const out = el('div', {});

    const body = el('div', {},
      el('div', { class: 'field' }, el('label', {}, `${t('fin.annual')} (€)`), annual),
      el('div', { class: 'field' }, el('label', {}, t('fin.hoursWeek')), hours),
      el('p', { class: 'hint' }, t('fin.hoursHint')),
      el('button', {
        class: 'btn btn-primary btn-block',
        onclick: async () => {
          const r = await post<{ message: string; belowMinimum: boolean; hourlyCents: number }>(
            '/api/finance/wage-check',
            { annualCents: Math.round(Number(annual.value) * 100), hoursPerWeek: Number(hours.value) });
          mount(out, el('div', { class: `banner ${r.belowMinimum ? 'banner-error' : 'banner-ok'}` }, r.message),
            el('p', { class: 'hint' }, t('fin.wageQuestion')));
        },
      }, t('fin.calculate')),
      out,
    );
    sheet(t('fin.wageCheck'), body);
  }

  void load();
}
