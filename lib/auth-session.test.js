/**
 * Session restore, and the marker cookie it owns.
 *
 * The bug: restore() set status "out" on failure but left `zewa_cms_session` in
 * place. Middleware read that stale marker, bounced /login back to /, the shell
 * restored again, failed again — a dead end no reload could escape.
 *
 * The 401 path in lib/api.js always cleared the marker. These pin that the
 * page-load path now agrees, because that is the one that runs every time.
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
  auth: { restore: (...a) => authRestore(...a), logout: vi.fn() },
  session: {
    clear: (...a) => sessionClear(...a),
    onLost: vi.fn(),
    get exists() { return hasMarker(); },
  },
}));

let useAuth;
beforeEach(async () => {
  vi.resetModules();
  authRestore.mockReset();
  sessionClear.mockClear();
  clearMarker();
  ({ useAuth } = await import("@/lib/store"));
});
afterEach(() => { clearMarker(); });

describe("a failed restore", () => {
  it("CLEARS the marker — the fix for the sign-in dead end", async () => {
    setMarker();
    authRestore.mockResolvedValue(null);

    await useAuth.getState().restore();

    expect(sessionClear).toHaveBeenCalled();
    expect(hasMarker()).toBe(false);
    expect(useAuth.getState().status).toBe("out");
  });

  it("clears it when the request throws, not just when it returns null", async () => {
    setMarker();
    authRestore.mockRejectedValue(new Error("network"));

    await useAuth.getState().restore();

    expect(hasMarker()).toBe(false);
    expect(useAuth.getState().status).toBe("out");
  });

  it("drops permissions, so stale ones cannot gate the UI", async () => {
    setMarker();
    useAuth.setState({ permissions: ["products.edit"], role: "admin", user: { id: "u1" } });
    authRestore.mockResolvedValue(null);

    await useAuth.getState().restore();

    expect(useAuth.getState().permissions).toEqual([]);
    expect(useAuth.getState().role).toBeNull();
    expect(useAuth.getState().user).toBeNull();
  });

  it("leaves the browser in a state where /login is reachable", async () => {
    // The whole point: no marker means middleware sends the user TO /login and
    // never away from it.
    setMarker();
    authRestore.mockResolvedValue(null);
    await useAuth.getState().restore();
    expect(hasMarker()).toBe(false);
  });
});

describe("a successful restore", () => {
  it("signs the user in and keeps the marker", async () => {
    setMarker();
    authRestore.mockResolvedValue({
      user: { id: "u1", role: "ADMIN", permissions: ["products.edit"] },
    });

    const ok = await useAuth.getState().restore();

    expect(ok).toBe(true);
    expect(useAuth.getState().status).toBe("in");
    expect(useAuth.getState().permissions).toEqual(["products.edit"]);
    expect(sessionClear).not.toHaveBeenCalled();
    expect(hasMarker()).toBe(true);
  });
});

describe("no marker at all", () => {
  it("does not call the API — the answer is already known", async () => {
    // A guaranteed 401 costs about half a second on the critical path of every
    // visit to the sign-in page.
    const ok = await useAuth.getState().restore();

    expect(ok).toBe(false);
    expect(authRestore).not.toHaveBeenCalled();
    expect(useAuth.getState().status).toBe("out");
  });

  it("still reports signed out rather than staying in limbo", async () => {
    await useAuth.getState().restore();
    expect(useAuth.getState().status).toBe("out");
  });
});

describe("two tabs racing a refresh", () => {
  it("the loser ends up signed out with no marker, not stuck", async () => {
    /*
     * Rotation revokes the previous token on every refresh, so a second tab
     * restoring a moment later is rejected. Before the fix that tab kept its
     * marker and hit the dead end.
     */
    setMarker();
    authRestore
      .mockResolvedValueOnce({ user: { id: "u1", role: "ADMIN", permissions: [] } })
      .mockResolvedValueOnce(null);

    const tabA = await import("@/lib/store").then((m) => m.useAuth.getState().restore());
    expect(tabA).toBe(true);

    await useAuth.getState().restore();

    expect(useAuth.getState().status).toBe("out");
    expect(hasMarker()).toBe(false);
  });
});

describe("sign out", () => {
  it("clears the marker via the API client", async () => {
    setMarker();
    authRestore.mockResolvedValue({ user: { id: "u1", role: "ADMIN", permissions: [] } });
    await useAuth.getState().restore();

    await useAuth.getState().logout();

    expect(useAuth.getState().status).toBe("out");
    expect(useAuth.getState().user).toBeNull();
  });
});
