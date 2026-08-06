import { NextResponse } from "next/server";

/**
 * CMS route protection.
 *
 * ── WHY A SEPARATE MARKER COOKIE ────────────────────────────────────────────
 * The real session lives in `zewa_rt`, an httpOnly refresh cookie issued by the
 * API on :4000 with `path=/api/v1/admin/auth`. Per RFC 6265, the browser only
 * attaches it to requests matching that path — so a page request to :3001/orders
 * never carries it, and middleware CANNOT see it. Widening the API cookie's path
 * would ship a credential on every CSS and JS request for no benefit.
 *
 * So the CMS sets its own cookie, `zewa_cms_session`, on successful sign-in and
 * clears it on sign-out. It is a PRESENCE MARKER, nothing more:
 *
 *   - it contains no token, no user id, no role — forging it grants nothing
 *   - it is NOT httpOnly, because the client has to set and clear it
 *   - every API call is still independently authenticated and permission-checked
 *
 * What this buys: an unauthenticated visitor gets redirected to /login instead of
 * downloading an admin shell that would immediately bounce them. It is a UX and
 * information-disclosure improvement, not an authentication control.
 *
 * ── WHY NOT VERIFY A JWT HERE ───────────────────────────────────────────────
 * The access token lives in memory by design (an XSS must not be able to read a
 * staff token from storage), so middleware has nothing to verify. Validating the
 * refresh token would need a network call per navigation, which is slower and
 * still not authoritative. The API remains the enforcement point — as it must,
 * since anyone can call it directly without going through this app at all.
 */

/** Presence marker set by CMS/lib/api.js on sign-in. Holds no secret. */
export const SESSION_MARKER = "zewa_cms_session";

/** Reachable without a session. */
const PUBLIC_PATHS = ["/login"];

/**
 * Validate a `?next=` value before redirecting to it — an unchecked one is an
 * open redirect, which is a credible phishing vector on a sign-in page.
 *
 * Accepts only a root-relative path. Rejected: absolute URLs
 * ("https://evil.com"), protocol-relative ("//evil.com"), backslash variants
 * that some browsers normalise to "//" ("/\evil.com"), and /login itself, which
 * would bounce forever.
 *
 * @param {string | null} raw
 * @returns {string | null} a safe path, or null to fall back to "/"
 */
function safeNext(raw) {
  if (!raw || !raw.startsWith("/")) return null;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (raw === "/login" || raw.startsWith("/login?")) return null;
  return raw;
}

export function middleware(request) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const hasSession = request.cookies.has(SESSION_MARKER);

  // Unauthenticated and asking for an app page -> /login, remembering where they
  // were headed so sign-in can return them there.
  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Only round-trip a genuine destination; sending "/" would be noise.
    if (pathname !== "/") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  // Already signed in and hitting /login -> honour ?next= if it is a safe
  // same-origin path, otherwise the dashboard. Dropping `next` here would lose
  // the destination for anyone who arrives at the sign-in link with a live
  // session (a second tab, or a refresh after the marker came back).
  if (isPublic && hasSession) {
    const target = safeNext(request.nextUrl.searchParams.get("next")) ?? "/";
    return NextResponse.redirect(new URL(target, request.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static files. `api` is excluded too:
     * the CMS has no API routes of its own, but excluding it keeps the matcher
     * correct if one is ever added.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)",
  ],
};
