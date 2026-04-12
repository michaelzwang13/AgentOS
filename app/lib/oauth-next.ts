/**
 * OAuth return-URL helpers.
 *
 * Callers (design-ui on :5173, the Next.js /test page, the old /agents page) pass a
 * `next` query param when starting an OAuth flow. We round-trip it through the OAuth
 * `state` parameter so the final callback can bounce the browser back to the page that
 * started the flow, instead of hard-coding a single destination.
 */

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const DEFAULT_NEXT = "/test";

/**
 * Validate a user-supplied return URL. Accepts either a same-origin path (`/foo`) or an
 * absolute URL whose origin is in the allowlist. Returns the sanitized value, or null if
 * the input is not safe to redirect to.
 */
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const u = new URL(raw);
    if (ALLOWED_ORIGINS.includes(u.origin)) return u.toString();
  } catch {
    // fall through
  }
  return null;
}

/** Resolve the return URL given the incoming request's `next` query param. */
export function resolveNext(raw: string | null | undefined): string {
  return sanitizeNext(raw) ?? DEFAULT_NEXT;
}

/**
 * Build a final redirect URL by appending query params to the sanitized return URL,
 * handling both absolute and relative forms.
 */
export function withQuery(
  nextUrl: string,
  params: Record<string, string>,
  baseUrl: string,
): string {
  const isAbsolute = /^https?:\/\//i.test(nextUrl);
  const u = new URL(nextUrl, isAbsolute ? undefined : baseUrl);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

/**
 * Is the resolved `next` URL on a different origin than the request that's running
 * the OAuth callback? When yes, we can't rely on cookies — the callback origin won't
 * match the design-ui origin — so tokens have to ride along in the redirect itself.
 */
export function isCrossOrigin(nextUrl: string, baseUrl: string): boolean {
  if (!/^https?:\/\//i.test(nextUrl)) return false;
  try {
    return new URL(nextUrl).origin !== new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Build a final redirect URL with tokens encoded in the fragment. Fragments are never
 * sent to servers or logged in Referer, so passing short-lived OAuth tokens this way is
 * acceptable for a local hackathon demo. Query params from `params` still go in the
 * query string; tokens live in the hash.
 */
export function withQueryAndHash(
  nextUrl: string,
  params: Record<string, string>,
  hashParams: Record<string, string>,
  baseUrl: string,
): string {
  const isAbsolute = /^https?:\/\//i.test(nextUrl);
  const u = new URL(nextUrl, isAbsolute ? undefined : baseUrl);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const hash = new URLSearchParams();
  for (const [k, v] of Object.entries(hashParams)) hash.set(k, v);
  const hashStr = hash.toString();
  if (hashStr) u.hash = hashStr;
  return u.toString();
}

/** Read an OAuth token from either the `Authorization: Bearer <token>` header or a cookie. */
export function readBearer(req: { headers: Headers }, cookieValue: string | undefined): string | undefined {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return cookieValue;
}
