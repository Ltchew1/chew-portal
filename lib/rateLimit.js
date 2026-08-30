// lib/rateLimit.js
//
// Server-enforced, Postgres-backed rate limiting — fixed-window counters.
// Postgres, not an in-memory Map, because this app runs as independent
// serverless function instances (Vercel) with no shared memory between
// them: an in-process counter resets per cold start and per instance, and
// becomes meaningless the moment there's more than one concurrent
// instance — exactly the failure mode a horizontally-scaled deployment
// hits immediately. Postgres is the one piece of already-provisioned
// shared infrastructure this app has; this introduces no new paid vendor
// or infrastructure decision.
//
// Deliberately NOT global middleware. Next.js Middleware only runs on the
// Edge runtime, which cannot use the `pg` driver this app's entire DB
// layer depends on (see lib/db.js) — a global rate limiter would have to
// either reimplement DB access over HTTP or hop through a second network
// call to a Node route, either of which is more architecture than this
// foundation needs. Instead this follows the same explicit-call-site
// discipline lib/features.js's own header comment already establishes for
// feature gating: every sensitive route calls checkRateLimit() itself,
// with its own key and policy, rather than one blanket rule silently
// applied to everything. "Different route classes need different
// policies" is easiest to keep true when each route states its own.
//
// The identity half of a bucket key is the caller's job, and it matters:
// use the authenticated Clerk user id (server-verified, never
// spoofable) for any signed-in route — never a raw request header a
// client can set (X-Forwarded-For, etc.), and never anything read out of
// the request body.

import { query } from './db';

function windowMs(windowSeconds) {
  return windowSeconds * 1000;
}

// Pure — no DB — so the window-alignment math is directly testable on
// its own. Every request in the same fixed window (e.g. every request in
// a given 10-minute slice of wall-clock time) shares one counter row.
export function windowStartFor(now, windowSeconds) {
  const ms = windowMs(windowSeconds);
  return new Date(Math.floor(new Date(now).getTime() / ms) * ms);
}

// Atomic: the whole increment happens inside one INSERT .. ON CONFLICT ..
// DO UPDATE statement, so two concurrent requests in the same window can
// never both read a stale count and both conclude they're under the
// limit — the classic race a separate SELECT-then-UPDATE would have.
export async function checkRateLimit({ key, limit, windowSeconds, now = new Date() }) {
  const windowStart = windowStartFor(now, windowSeconds);
  const { rows } = await query(
    `INSERT INTO rate_limit_hits (bucket_key, window_start, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (bucket_key, window_start) DO UPDATE SET count = rate_limit_hits.count + 1
     RETURNING count`,
    [key, windowStart.toISOString()]
  );
  const count = rows[0].count;
  const windowEnd = new Date(windowStart.getTime() + windowMs(windowSeconds));
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEnd.getTime() - new Date(now).getTime()) / 1000));

  // Opportunistic cleanup, no cron needed for a foundation this size: a
  // small per-call chance of pruning windows old enough that nothing will
  // ever look at them again. Never gates or delays the actual rate-limit
  // decision above — fire-and-forget, failure here is not this call's
  // problem.
  if (Math.random() < 0.01) {
    query(`DELETE FROM rate_limit_hits WHERE window_start < $1`, [new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()])
      .catch(() => {});
  }

  return { allowed: count <= limit, count, limit, retryAfterSeconds };
}

// The one shared response shape every rate-limited route returns, so a
// throttled client always sees the same structure/headers no matter which
// route it hit. Never echoes the internal key, limit, or count that
// produced the decision — a 429 body has no diagnostic value to a client
// that shouldn't be probing the policy anyway.
export function rateLimitExceededBody() {
  return { error: 'Too many requests. Please slow down and try again shortly.' };
}
