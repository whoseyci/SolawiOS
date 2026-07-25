import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Platform } from '@solawi/platform';
import { Kernel, Auth, hasRole, type Role, type Logger } from '@solawi/kernel';
import { Translator } from '@solawi/i18n';
import { de } from './locales/de.js';
import { en } from './locales/en.js';
import { ALL_MODULES } from './modules.js';
import { registerRoutes } from './routes/index.js';

export interface AppVars {
  kernel: Kernel;
  auth: Auth;
  person: { id: string; email: string; displayName: string; locale: string | null } | null;
  orgId: string | null;
  roles: Role[];
  locale: string;
}

export type App = Hono<{ Variables: AppVars }>;

export interface BuildOptions {
  platform: Platform;
  logger?: Logger;
  /** Serve the bundled PWA shell. Disable when a CDN handles it. */
  serveUi?: boolean;
}

export function createLogger(): Logger {
  const emit = (level: string) => (msg: string, data?: Record<string, unknown>) => {
    // Structured single-line logs; readable in `wrangler tail` and in a terminal.
    console.log(JSON.stringify({ level, msg, ...data, t: new Date().toISOString() }));
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
}

export function buildTranslator(): Translator {
  return new Translator({ de, en });
}

/**
 * Build the application.
 *
 * Everything platform-specific arrives through `platform`; this file and every
 * route below it are identical on Cloudflare and Node (ADR-0004 §1).
 */
export function buildApp(opts: BuildOptions): App {
  const logger = opts.logger ?? createLogger();
  const translator = buildTranslator();
  const kernel = new Kernel(opts.platform, logger, translator);
  kernel.use(...ALL_MODULES);

  // Empty values keep every capability answerable when its provider is off,
  // which is what makes modules genuinely disableable (docs/20 §5).
  kernel.registry.declareEmpty('locations.list', []);
  kernel.registry.declareEmpty('shares.count', 0);
  kernel.registry.declareEmpty('shares.equivalents', 0);
  kernel.registry.declareEmpty('budget.target', 0);
  kernel.registry.declareEmpty('plantings.active', []);
  kernel.registry.declareEmpty('founding.progress', null);
  kernel.registry.declareEmpty('observations.rhythm', null);

  const auth = new Auth(kernel);
  const app = new Hono<{ Variables: AppVars }>();

  app.use('*', cors({
    origin: (o) => o ?? '*',
    credentials: true,
    allowHeaders: ['content-type', 'authorization', 'x-solawi-org'],
  }));

  // Context middleware: identity, tenant, roles, locale — once, for every route.
  app.use('*', async (c, next) => {
    c.set('kernel', kernel);
    c.set('auth', auth);

    const token = bearer(c.req.header('authorization')) ?? getCookie(c.req.header('cookie'), 'solawi_session');
    const person = await auth.resolve(token);
    c.set('person', person);

    const orgHeader = c.req.header('x-solawi-org') ?? null;
    let orgId: string | null = null;
    let roles: Role[] = [];

    if (person && orgHeader) {
      // Accept a slug or an id, but always verify membership before trusting it.
      const org = orgHeader.includes('-') && orgHeader.length > 30
        ? await kernel.getOrg(orgHeader)
        : await kernel.getOrgBySlug(orgHeader);
      if (org) {
        const r = await kernel.rolesFor(org.id, person.id);
        if (r.length > 0) { orgId = org.id; roles = r; }
      }
    }
    c.set('orgId', orgId);
    c.set('roles', roles);

    const org = orgId ? await kernel.getOrg(orgId) : null;
    c.set('locale', person?.locale ?? org?.locale ?? 'de');

    await next();
  });

  registerRoutes(app);

  app.get('/health', (c) => c.json({
    ok: true,
    flavour: opts.platform.flavour,
    modules: kernel.registry.list().length,
    version: '0.1.0',
  }));

  app.onError((err, c) => {
    logger.error('unhandled', { error: err.message, path: c.req.path });
    const status = err.name === 'AuthError' ? 401 : 500;
    return c.json({ error: err.name === 'AuthError' ? err.message : 'internal_error' }, status);
  });

  return app;
}

/** Guard helpers used by routes. */
export function requireAuth(c: { get: (k: 'person') => AppVars['person'] }): NonNullable<AppVars['person']> {
  const p = c.get('person');
  if (!p) throw Object.assign(new Error('not_authenticated'), { name: 'AuthError' });
  return p;
}

export function requireOrg(c: {
  get: ((k: 'orgId') => string | null) & ((k: 'roles') => Role[]);
}): { orgId: string; roles: Role[] } {
  const orgId = c.get('orgId');
  if (!orgId) throw Object.assign(new Error('no_org_selected'), { name: 'AuthError' });
  return { orgId, roles: c.get('roles') };
}

export function requireRoleIn(roles: Role[], required: Role): void {
  if (!hasRole(roles, required)) {
    throw Object.assign(new Error(`forbidden: needs ${required}`), { name: 'AuthError' });
  }
}

function bearer(header?: string): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function getCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export { Kernel, Auth };
