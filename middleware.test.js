/**
 * CMS route protection.
 *
 * The rule that matters most is not "protect the app" — it is that /login stays
 * reachable. A stale `zewa_cms_session` marker used to bounce /login back to /,
 * and because nothing on that path cleared the marker, the user was locked out
 * of the page they needed in order to sign in again. Reloading did not help;
 * only clearing cookies did.
 */
import { describe, expect, it } from "vitest";
import { middleware, SESSION_MARKER } from "./middleware";

/**
 * A NextRequest-shaped object with just what the middleware reads.
 *
 * `clone()` returns a real URL: the middleware mutates `pathname` and
 * `searchParams` on it and then hands it to NextResponse.redirect, so a stub
 * whose toString() ignored those mutations would silently assert nothing.
 */
function makeRequest(path, { marker = false, search = "" } = {}) {
  const href = `https://cms.test${path}${search}`;
  const url = new URL(href);
  return {
    nextUrl: {
      pathname: url.pathname,
      search: url.search,
      searchParams: url.searchParams,
      origin: url.origin,
      clone: () => new URL(href),
    },
    cookies: { has: (name) => marker && name === SESSION_MARKER },
  };
}

const location = (response) => response.headers.get("location");
const isRedirect = (response) => response.status >= 300 && response.status < 400;

describe("the sign-in page is always reachable", () => {
  it("renders with a STALE marker — the lock-out that started all this", () => {
    /*
     * Marker present, session actually dead. Before the fix this returned a 307
     * to "/", the shell restored, failed, redirected back here, and the user was
     * trapped with no way out but clearing cookies.
     */
    expect(isRedirect(middleware(makeRequest("/login", { marker: true })))).toBe(false);
  });

  it("renders with no marker", () => {
    expect(isRedirect(middleware(makeRequest("/login")))).toBe(false);
  });

  it("renders with a marker AND a ?next= — never bounces to the destination", () => {
    const res = middleware(makeRequest("/login", { marker: true, search: "?next=%2Fproducts" }));
    expect(isRedirect(res)).toBe(false);
  });

  it("renders /accept-invitation without session marker", () => {
    expect(isRedirect(middleware(makeRequest("/accept-invitation", { search: "?token=xyz" })))).toBe(false);
  });

  it("cannot produce /login -> / -> /login", () => {
    // The loop needed BOTH halves. This is the half middleware owned.
    const toLogin = middleware(makeRequest("/login", { marker: true }));
    expect(location(toLogin)).toBeNull();
  });
});

describe("protecting app pages", () => {
  it("sends an unauthenticated visitor to /login", () => {
    const res = middleware(makeRequest("/products"));
    expect(isRedirect(res)).toBe(true);
    expect(location(res)).toContain("/login");
  });

  it("remembers where they were headed", () => {
    const res = middleware(makeRequest("/products", { search: "?page=2" }));
    expect(location(res)).toContain("next=%2Fproducts%3Fpage%3D2");
  });

  it("does not append next= for the dashboard — it would be noise", () => {
    expect(location(middleware(makeRequest("/")))).not.toContain("next=");
  });

  it("lets a marked session through", () => {
    expect(isRedirect(middleware(makeRequest("/products", { marker: true })))).toBe(false);
  });

  it("still protects a deep path", () => {
    const res = middleware(makeRequest("/products/guppy-bites/edit"));
    expect(location(res)).toContain("/login");
  });
});
