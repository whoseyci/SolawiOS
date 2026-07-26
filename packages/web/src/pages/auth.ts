import { el, mount, toast } from '../lib/ui.js';
import { icon, iconMarkup } from '../lib/icon.js';
import { t } from '../lib/i18n.js';
import { auth, post, ApiError } from '../lib/api.js';

/** Sign in / register. One human, one login, many farms. */
export function renderAuth(root: HTMLElement, onDone: () => void): void {
  let mode: 'in' | 'up' = 'in';

  function draw(): void {
    const email = el('input', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true });
    const password = el('input', {
      type: 'password', autocomplete: mode === 'in' ? 'current-password' : 'new-password', required: true,
    });
    const name = el('input', { type: 'text', autocomplete: 'name' });
    const error = el('div', { class: 'banner banner-error', style: 'display:none' });

    const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' },
      mode === 'in' ? t('auth.signIn') : t('auth.signUp'));

    const form = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        submit.setAttribute('disabled', 'true');
        error.style.display = 'none';
        try {
          const path = mode === 'in' ? '/api/auth/login' : '/api/auth/register';
          const body = mode === 'in'
            ? { email: email.value, password: password.value }
            : { email: email.value, password: password.value, displayName: name.value || email.value };
          const res = await post<{ token: string }>(path, body);
          auth.token = res.token;
          onDone();
        } catch (err) {
          const code = err instanceof ApiError ? err.code : 'network';
          error.textContent =
            code === 'invalid_credentials' ? t('auth.invalid')
            : code === 'weak_password' ? t('auth.weakPassword')
            : code === 'email_taken' ? t('auth.emailTaken')
            : t('common.error');
          error.style.display = 'block';
          submit.removeAttribute('disabled');
        }
      },
    },
      error,
      mode === 'up' && el('div', { class: 'field' }, el('label', {}, t('auth.name')), name),
      el('div', { class: 'field' }, el('label', {}, t('auth.email')), email),
      el('div', { class: 'field' }, el('label', {}, t('auth.password')), password),
      submit,
    );

    mount(root,
      el('div', { class: 'main', style: 'max-width:420px;padding-top:12vh' },
        el('div', { class: 'center', style: 'margin-bottom:2rem' },
          el('div', { class: 'brand-mark', html: iconMarkup('seedling', 46) }),
          el('h1', { style: 'margin:.5rem 0 .25rem' }, t('app.name')),
          el('p', { class: 'muted' }, t('auth.tagline')),
        ),
        el('div', { class: 'card' }, form),
        el('div', { class: 'center' },
          el('button', {
            class: 'btn btn-ghost',
            onclick: () => { mode = mode === 'in' ? 'up' : 'in'; draw(); },
          }, mode === 'in' ? t('auth.noAccount') : t('auth.haveAccount')),
        ),
      ),
    );
  }

  draw();
}

/** Farm picker, and creation — including the skip path for established farms. */
export function renderOrgPicker(root: HTMLElement, onDone: () => void): void {
  mount(root, el('div', { class: 'main' }, el('div', { class: 'spinner' })));

  void (async () => {
    let orgs: Array<{ id: string; slug: string; name: string; phase: string }> = [];
    try {
      const res = await fetch('/api/auth/me', { headers: { authorization: `Bearer ${auth.token}` } });
      if (res.ok) orgs = ((await res.json()) as { orgs: typeof orgs }).orgs ?? [];
    } catch { /* offline: fall through to the create form */ }

    const list = el('div', { class: 'stack' },
      ...orgs.map((o) => el('button', {
        class: 'btn btn-block',
        style: 'justify-content:flex-start;text-align:left',
        onclick: () => { auth.org = o.slug; onDone(); },
      },
        el('div', {},
          el('div', { style: 'font-weight:700' }, o.name),
          el('div', { class: 'muted' }, o.slug),
        ),
      )),
    );

    const name = el('input', { type: 'text', required: true });
    const slug = el('input', { type: 'text', pattern: '[a-z0-9-]+', required: true });
    // Auto-derive a URL-safe slug; the field stays editable.
    name.addEventListener('input', () => {
      if (!slug.dataset.touched) {
        slug.value = name.value.toLowerCase()
          .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c] ?? c))
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      }
    });
    slug.addEventListener('input', () => { slug.dataset.touched = '1'; });

    const established = el('input', { type: 'checkbox' });

    const createForm = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        try {
          await post('/api/orgs', {
            slug: slug.value, name: name.value, established: established.checked,
          });
          auth.org = slug.value;
          onDone();
        } catch (err) {
          const code = err instanceof ApiError ? err.code : 'network';
          toast(
            code === 'slug_taken' ? t('org.slugTaken')
            : code === 'invalid_slug' ? t('org.slugInvalid')
            : t('common.error'), 'error');
        }
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('org.name')), name),
      el('div', { class: 'field' }, el('label', {}, t('org.slug')), slug),
      el('label', { class: 'row', style: 'margin-bottom:.75rem;cursor:pointer' },
        established,
        el('span', { style: 'font-size:.9rem' }, t('org.established')),
      ),
      el('p', { class: 'hint', style: 'margin-top:-.4rem' }, t('org.establishedHint')),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('org.create')),
    );

    mount(root,
      el('div', { class: 'main', style: 'max-width:480px;padding-top:6vh' },
        el('h1', {}, t('org.choose')),
        orgs.length > 0 ? list : el('p', { class: 'muted' }, t('org.none')),
        el('div', { class: 'card', style: 'margin-top:1.5rem' },
          el('h2', {}, t('org.create')), createForm,
        ),
        el('div', { class: 'center' },
          el('button', {
            class: 'btn btn-ghost',
            onclick: () => { auth.token = null; auth.org = null; location.reload(); },
          }, t('auth.signOut')),
        ),
      ),
    );
  })();
}
