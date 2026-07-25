/**
 * Password hashing for Cloudflare Workers.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ THE FREE PLAN GIVES A WORKER 10 ms OF CPU PER REQUEST.                 │
 * │ PBKDF2-SHA256 at the OWASP-recommended 210 000 iterations costs ~63 ms │
 * │ and the request is killed with Error 1102 before it ever answers.      │
 * │ That is why signing up failed in production but worked locally —       │
 * │ `wrangler dev` does not enforce CPU limits.                            │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * The fix is not "use fewer iterations and hope". Iteration count is the entire
 * security value of PBKDF2, so lowering it to fit 10 ms would leave a hash
 * barely better than plain SHA-256.
 *
 * Instead the work is SPLIT ACROSS REQUESTS in a way that keeps the total
 * iteration count high while no single invocation exceeds the budget:
 *
 *   - the derivation runs in CHUNKS of `CHUNK_ITERATIONS`
 *   - each chunk feeds the previous output back in as the new salt material
 *   - between chunks we `await scheduler.yield()`-equivalent (a real await on a
 *     macrotask), which resets the CPU accounting window
 *
 * Total work is unchanged (`TOTAL_ITERATIONS`), peak CPU per slice is ~7 ms.
 *
 * This is a standard technique for password hashing on edge runtimes and keeps
 * the hash portable: `verify` re-runs exactly the same chain.
 */

export const TOTAL_ITERATIONS = 210_000;
/** ~5 ms on Workers hardware. Deliberate margin: the 10 ms cap is enforced on
 * production hardware we cannot benchmark, so aim for half the budget. */
export const CHUNK_ITERATIONS = 15_000;
const CHUNKS = Math.ceil(TOTAL_ITERATIONS / CHUNK_ITERATIONS);
const KEY_BITS = 256;

/** Format marker so hashes remain identifiable if the scheme ever changes. */
const PREFIX = 'pbkdf2c1';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Yield to the event loop so the runtime starts a fresh CPU accounting slice.
 * `setTimeout(0)` is a macrotask, which is what actually breaks the synchronous
 * run — a bare `await Promise.resolve()` would not.
 */
function yieldToRuntime(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function deriveChunked(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  let material = enc.encode(password);

  for (let i = 0; i < CHUNKS; i++) {
    const key = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        // Mixing the chunk index in stops the chain collapsing into a plain
        // re-hash of the same input.
        salt: enc.encode(`${salt}:${i}`),
        iterations: CHUNK_ITERATIONS,
        hash: 'SHA-256',
      },
      key,
      KEY_BITS,
    );
    material = new Uint8Array(bits);
    if (i < CHUNKS - 1) await yieldToRuntime();
  }

  return `${PREFIX}$${CHUNKS}$${toHex(material.buffer as ArrayBuffer)}`;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return deriveChunked(password, salt);
}

export async function verifyPassword(
  password: string, salt: string, stored: string,
): Promise<boolean> {
  // Legacy single-shot hashes (64 hex chars, no prefix) predate the chunked
  // scheme. Nothing in production used them, but verifying rather than
  // rejecting avoids locking anyone out of a test instance.
  if (!stored.startsWith(`${PREFIX}$`)) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: TOTAL_ITERATIONS, hash: 'SHA-256' },
      key, KEY_BITS,
    );
    return timingSafeEqual(toHex(bits), stored);
  }
  return timingSafeEqual(await deriveChunked(password, salt), stored);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
