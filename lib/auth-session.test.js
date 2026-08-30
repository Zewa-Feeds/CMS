/**
 * Session restore, and the rule that "could not confirm" is not "signed out".
 *
 * ── THE BUG THESE PIN ───────────────────────────────────────────────────────
 * restore() used to treat every failure identically: any falsy result cleared
 * the session and dropped the user on /login. Since a thrown fetch and a
 * server-rejected token looked the same from here, a blocked CORS preflight — 
 * which is what /auth/refresh actually hit in production, on every page load —
 * was reported to the user as "your 7-day session expired".
 *
 * The three outcomes are now distinct, and only one of them may sign anyone out.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MARKER = "zewa_cms_session";

const setMarker = () => { document.cookie = `${MARKER}=1; Path=/`; };
const hasMarker = () =>
  document.cookie.split("; ").some((c) => c.startsWith(`${MARKER}=`));
const clearMarker = () => { document.cookie = `${MARKER}=; Path=/; Max-Age=0`; };

/** Stub the API module; the store is what is under test. */
const authRestore = vi.fn();
const sessionClear = vi.fn(() => clearMarker());
vi.mock("@/lib/api", () => ({
  REFRESH_OK: "ok",
  REFRESH_INVALID: "invalid",
  REFRESH_UNREACHABLE: "unreachable",
  auth: {
    restore: (...a) => authRestore(...a),
    logout: vi.fn(),
    login: vi.fn().mockResolvedValue({ challengeToken: "tok1", twofaEnrolled: true, twofaMethod: "EMAIL_OTP" }),
  },
  session: {
    clear: (...a) => sessionClear(...a),
    onLost: vi.fn(),
    onRenewed: vi.fn(() => () => {}),
    get exists() { return hasMarker(); },
  },
}));

const ok = (user) => ({ status: "ok", data: { user } });
const invalid = () => ({ status: "invalid" });
const unreachable = () => ({ status: "unreachable" });

let useAuth;
beforeEach(async () => {
  vi.resetModules();
  authRestore.mockReset();
  sessionClear.mockClear();
  clearMarker();
  ({ useAuth } = await import("@/lib/store"));
});
afterEach(() => { clearMarker(); });

describe("the API cannot be reached", () => {
  it("does NOT sign the user out — this is the whole bug", async () => {
    setMarker();
    authRestore.mockResolvedValue(unreachable());

    await useAuth.getState().restore();

    expect(useAuth.getState().status).toBe("offline");
    expect(useAuth.getState().status).not.toBe("out");
  });

  it("leaves the stored credential completely alone", async () => {
    setMarker();
    authRestore.mockResolvedValue(unreachable());

    await useAuth.getState().restore();

    // Clearing here is what destroyed a live 7-day session over a network blip.
    expect(sessionClear).not.toHaveBeenCalled();
    expect(hasMarker()).toBe(true);
  });

  it("treats a thrown request as unreachable, not as a dead session", async () => {
    setMarker();
    authRestore.mockRejectedValue(new TypeError("Failed to fetch"));

    await useAuth.getState().restore();

    expect(useAuth.getState().status).toBe("offline");
    expect(sessionClear).not.toHaveBeenCalled();
  });
});

describe("the server rejects the refresh credential", () => {
  it("signs the user out", async () => {
    setMarker();
    authRestore.mockResolvedValue(invalid());

    await useAuth.getState().restore();

    expect(useAuth.getState().status).toBe("out");
  });

  it("drops permissions, so stale ones cannot gate the UI", async () => {
    setMarker();
    useAuth.setState({ permissions: ["products.edit"], role: "admin", user: { id: "u1" } });
    authRestore.mockResolvedValue(invalid());

    await useAuth.getState().restore();

    expect(useAuth.getState().permissions).toEqual([]);
    expect(useAuth.getState().role).toBeNull();
    expect(useAuth.getState().user).toBeNull();
  });
});

describe("a successful restore", () => {
  it("signs the user in and keeps the marker", async () => {
    setMarker();
    authRestore.mockResolvedValue(ok({ id: "u1", role: "ADMIN", permissions: ["products.edit"] }));

    const result = await useAuth.getState().restore();

    expect(result).toBe(true);
    expect(useAuth.getState().status).toBe("in");
    expect(useAuth.getState().permissions).toEqual(["products.edit"]);
    expect(sessionClear).not.toHaveBeenCalled();
    expect(hasMarker()).toBe(true);
  });

  it("clears the offline flag it may have been carrying", async () => {
    setMarker();
    useAuth.setState({ status: "offline", offline: true });
    authRestore.mockResolvedValue(ok({ id: "u1", role: "ADMIN", permissions: [] }));

    await useAuth.getState().restore();

    expect(useAuth.getState().offline).toBe(false);
  });
});

describe("no credential at all", () => {
  it("does not call the API — the answer is already known", async () => {
    const result = await useAuth.getState().restore();

    expect(result).toBe(false);
    expect(authRestore).not.toHaveBeenCalled();
    expect(useAuth.getState().status).toBe("out");
  });
});

describe("two tabs restoring at once", () => {
  it("a tab that cannot reach the API never ends the other tab's session", async () => {
    /*
     * The race that used to kill a working session: tab B fails, clears the
     * shared credential, and tab A — perfectly healthy — is signed out with it.
     */
    setMarker();
    authRestore
      .mockResolvedValueOnce(ok({ id: "u1", role: "ADMIN", permissions: [] }))
      .mockResolvedValueOnce(unreachable());

    expect(await useAuth.getState().restore()).toBe(true);
    await useAuth.getState().restore();

    expect(sessionClear).not.toHaveBeenCalled();
    expect(hasMarker()).toBe(true);
  });
});
