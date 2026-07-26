import { el, mount, toast, spinner } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { ctx } from '../lib/session.js';

interface Bar { phase: 'collecting' | 'showing' | 'final'; position: number | null; participationHint: string }
interface RoundInfo { id: string; season: string; status: string; richtwertCents: number; displayMode: string }

/**
 * Bieterrunde.
 *
 * Two things this screen must never do (ADR-0005):
 *  - show any individual bid, including your neighbour's
 *  - show a number precise enough to difference between two renders
 *
 * The bar is a POSITION in [-1, 1], quantised server-side to 20 steps.
 */
export function renderBidding(root: HTMLElement, projector = false): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  // Prefer an explicit round in the URL (projector links), else the open one.
  const roundId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('round')
    ?? ctx().openRound?.id ?? null;

  void (async () => {
    let round: RoundInfo | null = null;
    if (roundId) {
      try { round = (await get<RoundInfo>(`/api/bidding/rounds/${roundId}`)).data; } catch { /* none */ }
    }
    if (!round) {
      mount(box, el('div', { class: 'empty' },
        icon('gavel', 34), el('p', {}, t('bidding.noRound'))));
      return;
    }

    const bar = barWidget();
    const amount = el('input', {
      type: 'number', inputmode: 'decimal', step: '1', min: '0',
      value: String(Math.round(round.richtwertCents / 100)),
    }) as HTMLInputElement;

    mount(box,
      el('div', { class: `card ${projector ? 'projector' : ''}` },
        el('div', { class: 'center', style: 'margin-bottom:1rem' },
          el('div', { class: 'muted' }, t('bidding.richtwert')),
          el('div', { style: `font-size:${projector ? '3rem' : '1.8rem'};font-weight:700` },
            fmt.money(round.richtwertCents)),
          el('div', { class: 'muted' }, t('bidding.perShare')),
        ),
        bar.node,
        el('p', { class: 'hint center' }, t('bidding.barHint')),
      ),
      !projector && round.status === 'open' && el('div', { class: 'card' },
        el('div', { class: 'field' }, el('label', {}, `${t('bidding.yourBid')} (€)`), amount),
        el('button', {
          class: 'btn btn-primary btn-block btn-lg',
          onclick: async () => {
            if (!ctx().household?.id) { toast(t('household.why'), 'warn'); return; }
            try {
              await post(`/api/bidding/rounds/${round!.id}/bids`, {
                householdId: ctx().household?.id ?? '',
                amountCents: Math.round(Number(amount.value) * 100),
              });
              toast(t('obs.saved'));
            } catch { toast(t('common.error'), 'error'); }
          },
        }, t('bidding.submit')),
      ),
    );

    // Poll: the server already batches and jitters, so a plain interval is safe.
    const tick = async () => {
      try { bar.set((await get<Bar>(`/api/bidding/rounds/${round!.id}/bar`)).data); } catch { /* keep last */ }
    };
    void tick();
    const timer = window.setInterval(tick, 4000);
    window.addEventListener('hashchange', () => window.clearInterval(timer), { once: true });
  })();
}

function barWidget() {
  const fill = el('div', { class: 'bar-fill pos', style: 'width:0' });
  const label = el('div', { class: 'center', style: 'margin-top:.75rem;font-weight:650' }, t('bidding.collecting'));
  const node = el('div', {},
    el('div', { class: 'bar-wrap' }, el('div', { class: 'bar-mid' }), fill),
    label,
  );
  return {
    node,
    set(b: Bar) {
      if (b.position === null) {
        fill.style.width = '0';
        label.textContent = t('bidding.collecting');
        return;
      }
      const pct = Math.min(50, Math.abs(b.position) * 50);
      fill.className = `bar-fill ${b.position >= 0 ? 'pos' : 'neg'}`;
      fill.style.width = `${pct}%`;
      label.textContent = b.position >= 0 ? t('bidding.above') : t('bidding.below');
    },
  };
}
