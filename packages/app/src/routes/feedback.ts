import type { App } from '../app.js';
import { requireAuth, requireOrg, requireRoleIn } from '../app.js';
import {
  store, deliver, buildPreview, listReports, redactRoute,
  type ReportInput, type DiagnosticContext, type GitHubConfig,
} from '@solawi/module-feedback';

/**
 * In-app bug reporting.
 *
 * Flow is deliberately two-step:
 *   POST /api/feedback/preview  → shows exactly what would be sent
 *   POST /api/feedback          → stores it, then delivers to GitHub
 *
 * The GitHub token lives in the environment (GITHUB_ISSUE_TOKEN), never in the
 * database and never in a response. A farm without a token still collects
 * reports locally.
 */
export function feedbackRoutes(app: App): void {
  /** Preview — nothing leaves the farm. */
  app.post('/api/feedback/preview', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const body = await c.req.json<ReportInput & { context?: DiagnosticContext }>();
    const diag = await enrich(c as unknown as EnrichCtx, orgId, body.context);
    return c.json(buildPreview(body, diag));
  });

  /** Submit. Requires the caller to have seen the preview (client-enforced). */
  app.post('/api/feedback', async (c) => {
    requireAuth(c);
    const { orgId } = requireOrg(c);
    const body = await c.req.json<ReportInput & { context?: DiagnosticContext }>();

    if (!body.title?.trim() || !body.body?.trim()) {
      return c.json({ error: 'title_and_body_required' }, 400);
    }

    const kernel = c.get('kernel');
    const ctx = kernel.contextFor(orgId, 'feedback', c.get('locale'));
    const diag = await enrich(c as unknown as EnrichCtx, orgId, body.context);

    const reportId = await store(ctx, body, diag);

    const cfg = githubConfig(c);
    if (!cfg) {
      // No token configured: the report is kept locally and can be exported.
      return c.json({ id: reportId, stored: true, delivered: false, reason: 'no_github_token' }, 201);
    }

    const result = await deliver(ctx, reportId, cfg);
    return c.json({
      id: reportId,
      stored: true,
      delivered: result.ok,
      issueNumber: result.issueNumber,
      issueUrl: result.issueUrl,
      // Surface the failure rather than pretending it worked.
      error: result.ok ? undefined : result.error,
    }, 201);
  });

  /** What has been reported from this farm, and did it arrive? */
  app.get('/api/feedback', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const ctx = c.get('kernel').contextFor(orgId, 'feedback', c.get('locale'));
    return c.json({ reports: await listReports(ctx) });
  });

  /** Retry a failed delivery. */
  app.post('/api/feedback/:id/retry', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const cfg = githubConfig(c);
    if (!cfg) return c.json({ error: 'no_github_token' }, 400);
    const ctx = c.get('kernel').contextFor(orgId, 'feedback', c.get('locale'));
    return c.json(await deliver(ctx, c.req.param('id'), cfg));
  });
}

/** Minimal shape `enrich` needs — avoids depending on Hono's generic Context type. */
interface EnrichCtx {
  get(key: 'kernel'): { enabledModules(orgId: string): Promise<ReadonlySet<string>>; platform: { flavour: string } };
  get(key: 'locale'): string;
  req: { header(name: string): string | undefined };
}

/**
 * Add diagnostics the server knows and the client should not have to supply.
 * Everything here is farm-level or technical — never member data.
 */
async function enrich(
  c: EnrichCtx,
  orgId: string,
  supplied: DiagnosticContext = {},
): Promise<DiagnosticContext> {
  const kernel = c.get('kernel');
  const enabled = await kernel.enabledModules(orgId);
  return {
    ...supplied,
    route: supplied.route ? redactRoute(supplied.route) : undefined,
    enabledModules: [...enabled].sort(),
    appVersion: '0.1.0',
    platformFlavour: kernel.platform.flavour,
    locale: c.get('locale'),
    userAgent: supplied.userAgent ?? c.req.header('user-agent'),
  };
}

/**
 * Token comes from the environment only.
 *
 * Cloudflare: `wrangler secret put GITHUB_ISSUE_TOKEN`
 * Node:       GITHUB_ISSUE_TOKEN=... in the environment
 *
 * A fine-grained PAT scoped to Issues:write on ONE repository is sufficient,
 * and is what we recommend — it cannot read code or push commits.
 */
function githubConfig(c: unknown): GitHubConfig | null {
  const env = ((c as { env?: unknown })?.env ?? {}) as Record<string, string | undefined>;
  const token = env.GITHUB_ISSUE_TOKEN
    ?? (typeof process !== 'undefined' ? process.env?.GITHUB_ISSUE_TOKEN : undefined);
  if (!token) return null;
  return {
    token,
    owner: env.GITHUB_ISSUE_OWNER
      ?? (typeof process !== 'undefined' ? process.env?.GITHUB_ISSUE_OWNER : undefined) ?? 'whoseyci',
    repo: env.GITHUB_ISSUE_REPO
      ?? (typeof process !== 'undefined' ? process.env?.GITHUB_ISSUE_REPO : undefined) ?? 'solawios',
  };
}
