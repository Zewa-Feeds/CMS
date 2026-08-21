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
 * It is used in ONE direction only: to send someone WITHOUT a marker to /login.
 * It is never used to send someone AWAY from /login, because the marker can
 * outlive the session it stands for, and a stale one must not be able to lock a
 * user out of the page they need in order to sign in again.
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

  /*
   * /login ALWAYS RENDERS. It is never redirected away from.
   *
   * This used to bounce anyone holding the marker to `?next=` or the dashboard,
   * which read well until the marker outlived the session it stood for. Then:
   * the shell restored, the refresh cookie was rejected, it redirected to
   * /login, and this rule sent them straight back — a dead end showing
   * "Redirecting to sign-in…" that survived every reload, because nothing on
   * that path ever cleared the marker.
   *
   * restore() now clears it, which fixes the cause. This is the other half:
   * a sign-in page must be reachable whenever someone asks for it, or a stale
   * client-side cookie can lock a user out of their own admin panel. The marker
   * is set by JavaScript and holds no secret — it was never a safe thing to
   * gate a recovery route on.
   *
   * Nothing is lost. A genuinely signed-in user who opens /login is redirected
   * by the page itself once restore() confirms the session — a decision made
   * from a verified session rather than guessed from a cookie, and one that
   * honours ?next= exactly as before (see nextPath in app/login/page.jsx).
   */
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
