import { el, mount, sheet, toast, spinner } from '../lib/ui.js';
import { t, locale, setLocale } from '../lib/i18n.js';
import { get, post, auth, outboxCount, flushOutbox } from '../lib/api.js';

interface ModuleInfo { id: string; number: number; enabled: boolean; maturity: string }

export function renderMore(root: HTMLElement): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  void (async () => {
    let modules: ModuleInfo[] = [];
    let orgName = '';
    try {
      const { data } = await get<{ org: { name: string }; modules: ModuleInfo[] }>('/api/org');
      modules = data.modules; orgName = data.org.name;
    } catch { /* offline */ }

    const pending = await outboxCount();

    mount(box,
      el('div', { class: 'card' },
        el('h2', {}, orgName || t('app.name')),
        pending > 0 && el('div', { class: 'banner banner-offline' },
          t('common.pending', { count: pending })),
        pending > 0 && el('button', {
          class: 'btn btn-block',
          onclick: async () => {
            const r = await flushOutbox();
            toast(`${r.sent}`, r.failed ? 'warn' : 'ok');
            renderMore(root);
          },
        }, t('common.retry')),
      ),

      el('div', { class: 'card' },
        el('h2', {}, t('settings.modules')),
        el('p', { class: 'hint' }, t('settings.modulesHint')),
        el('div', { class: 'stack', style: 'margin-top:.75rem' },
          ...modules.map((m) => {
            const cb = el('input', { type: 'checkbox', checked: m.enabled }) as HTMLInputElement;
            cb.addEventListener('change', async () => {
              try {
                await post('/api/org/modules', cb.checked ? { enable: [m.id] } : { disable: [m.id] });
                // Nav depends on which modules are on.
                window.dispatchEvent(new CustomEvent('solawi:modules'));
              } catch { toast(t('common.error'), 'error'); cb.checked = !cb.checked; }
            });
            return el('label', { class: 'row-between', style: 'cursor:pointer;padding:.35rem 0' },
              el('span', {}, m.id, ' ', el('span', { class: 'badge' }, m.maturity)),
              cb,
            );
          }),
        ),
      ),

      el('div', { class: 'card' },
        el('h2', {}, t('settings.language')),
        el('div', { class: 'row' },
          ...['de', 'en'].map((l) => el('button', {
            class: `btn ${locale() === l ? 'btn-primary' : ''}`,
            onclick: () => setLocale(l),
          }, l.toUpperCase())),
        ),
      ),

      el('button', { class: 'btn btn-block', onclick: feedbackSheet }, t('feedback.title')),
      el('button', {
        class: 'btn btn-block', style: 'margin-top:.5rem',
        onclick: () => { auth.token = null; auth.org = null; location.reload(); },
      }, t('auth.signOut')),
    );
  })();
}

/**
 * In-app bug reporting.
 *
 * Two-step by design: the preview shows EXACTLY what will be transmitted before
 * anything leaves the farm. Consent requires knowing what you consent to.
 */
export function feedbackSheet(): void {
  const kind = el('select', {},
    ...(['bug', 'idea', 'question'] as const).map((k) =>
      el('option', { value: k }, t(`feedback.kind.${k}`))),
  ) as HTMLSelectElement;
  const title = el('input', { type: 'text', required: true }) as HTMLInputElement;
  const detail = el('textarea', { rows: 4 }) as HTMLTextAreaElement;
  const previewBox = el('div', {});

  const body = el('div', {},
    el('div', { class: 'field' }, el('label', {}, t('feedback.kind.bug')), kind),
    el('div', { class: 'field' }, el('label', {}, t('feedback.what')), title),
    el('div', { class: 'field' }, el('label', {}, t('feedback.detail')), detail),
    el('button', {
      class: 'btn btn-block',
      onclick: async () => {
        try {
          const p = await post<{ willSend: Record<string, unknown>; explanation: string[] }>(
            '/api/feedback/preview',
            { kind: kind.value, title: title.value, body: detail.value, context: { route: location.hash } });
          mount(previewBox,
            el('div', { class: 'card', style: 'margin-top:1rem' },
              el('h3', {}, t('feedback.willSend')),
              el('ul', { style: 'margin:.5rem 0 .75rem;padding-left:1.2rem;font-size:.85rem' },
                ...p.explanation.map((e) => el('li', {}, e))),
              el('pre', {
                style: 'font-size:.7rem;overflow-x:auto;background:var(--bg);padding:.5rem;border-radius:8px',
              }, JSON.stringify(p.willSend, null, 2)),
              el('button', {
                class: 'btn btn-primary btn-block',
                onclick: async () => {
                  const res = await post<{ delivered: boolean }>('/api/feedback', {
                    kind: kind.value, title: title.value, body: detail.value,
                    context: { route: location.hash },
                  }, { queue: true });
                  close();
                  toast(res?.delivered ? t('feedback.sent') : t('feedback.storedLocally'));
                },
              }, t('feedback.send')),
            ),
          );
        } catch { toast(t('common.error'), 'error'); }
      },
    }, t('feedback.preview')),
    previewBox,
  );

  const close = sheet(t('feedback.title'), body);
}
