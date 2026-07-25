import { el, mount, toast, spinner } from '../lib/ui.js';
import { t } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { loadCtx, invalidateCtx } from '../lib/session.js';

/**
 * Household linking.
 *
 * A household usually exists before anyone claims it — the office enters
 * members from a spreadsheet, then people sign up. So claiming is the primary
 * path and creating is the fallback.
 */
export function renderHouseholdLink(root: HTMLElement, onDone: () => void): void {
  const box = el('div', {}, spinner());
  mount(root, el('div', { class: 'main', style: 'max-width:520px' },
    el('h1', {}, t('household.title')),
    el('p', { class: 'muted' }, t('household.why')),
    box,
  ));

  void (async () => {
    let candidates: Array<{ id: string; name: string }> = [];
    try {
      candidates = (await get<{ candidates: typeof candidates }>('/api/me/household/candidates')).data.candidates;
    } catch { /* offline or module off */ }

    const name = el('input', { type: 'text', placeholder: '' }) as HTMLInputElement;

    mount(box,
      candidates.length > 0 && el('div', { class: 'card' },
        el('h2', {}, t('household.claim')),
        el('div', { class: 'stack' },
          ...candidates.map((h) => el('button', {
            class: 'btn btn-block', style: 'justify-content:flex-start',
            onclick: () => void link({ householdId: h.id }),
          }, h.name)),
        ),
      ),
      el('div', { class: 'card' },
        el('h2', {}, t('household.create')),
        el('div', { class: 'field' }, el('label', {}, t('household.name')), name),
        el('button', {
          class: 'btn btn-primary btn-block',
          onclick: () => void link({ name: name.value || undefined }),
        }, t('common.save')),
      ),
      el('button', { class: 'btn btn-ghost btn-block', onclick: onDone }, t('household.later')),
    );

    async function link(body: { householdId?: string; name?: string }): Promise<void> {
      try {
        await post('/api/me/household', body);
        invalidateCtx();
        await loadCtx(true);
        onDone();
      } catch {
        toast(t('household.claimed'), 'error');
      }
    }
  })();
}

/** Opt in to being counted in neighbour searches — precise location optional. */
export function renderDiscoverableToggle(current: boolean, onChange: () => void): HTMLElement {
  const cb = el('input', { type: 'checkbox', checked: current }) as HTMLInputElement;

  cb.addEventListener('change', async () => {
    const enable = cb.checked;
    let coords: { lat: number; lon: number } | undefined;

    if (enable && 'geolocation' in navigator) {
      coords = await new Promise<{ lat: number; lon: number } | undefined>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          () => resolve(undefined),
          { timeout: 8000, enableHighAccuracy: false },
        );
      });
    }

    try {
      await post('/api/me/discoverable', { discoverable: enable, ...coords });
      invalidateCtx();
      toast(t('obs.saved'));
      onChange();
    } catch {
      cb.checked = !enable;
      toast(t('common.error'), 'error');
    }
  });

  return el('div', { class: 'card' },
    el('label', { class: 'row-between', style: 'cursor:pointer' },
      el('span', {}, t('household.discoverable')), cb),
    el('p', { class: 'hint' }, t('household.discoverableHint')),
  );
}
