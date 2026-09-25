import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Coin liability — the finance CSV export.
 *
 * This exists because the export shipped as `<a href={`${API_BASE}/loyalty/export`}>`.
 * The admin API authenticates on the Authorization header, and a browser
 * navigation carries none, so the endpoint answered 401 and finance got a login
 * page instead of a CSV. A comment on the link claimed it rode a session cookie;
 * the CMS holds its access token in JS, so there was no such cookie.
 *
 * What is asserted is the contract that was broken: the download goes through
 * the API client (which attaches the Bearer token), and never through a bare
 * link to the endpoint.
 */

const liability = vi.fn();
const reconcile = vi.fn();
const exportCsv = vi.fn();

let permissions = ["loyalty.view"];

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions }),
}));

vi.mock("@/lib/api", () => ({
  loyalty: {
    liability: (...a) => liability(...a),
    reconcile: (...a) => reconcile(...a),
    exportCsv: (...a) => exportCsv(...a),
  },
}));

const { default: LiabilityPage } = await import("./page");

beforeEach(() => {
  permissions = ["loyalty.view"];
  liability.mockResolvedValue({
    outstandingLiabilityPaise: 120000,
    outstandingCoins: 1200,
    pendingCoins: 300,
    ageing: [],
    exceptions: [],
  });
  reconcile.mockResolvedValue({ checked: 0, repaired: 0 });
  exportCsv.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderPage() {
  render(<LiabilityPage />);
  await waitFor(() => expect(liability).toHaveBeenCalled());
}

describe("the liability CSV export", () => {
  it("downloads through the authenticated API client", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    await waitFor(() => expect(exportCsv).toHaveBeenCalledTimes(1));
  });

  /*
   * The regression itself. A link navigation cannot carry the Bearer token, so
   * an anchor pointing at the export endpoint is the bug coming back — whatever
   * its href is built from.
   */
  it("is not a bare link to the export endpoint", async () => {
    await renderPage();

    const control = screen.getByRole("button", { name: /export csv/i });
    expect(control.tagName).toBe("BUTTON");

    const anchors = Array.from(document.querySelectorAll("a[href]"));
    expect(anchors.filter((a) => a.getAttribute("href").includes("/loyalty/export"))).toEqual([]);
  });

  it("reports a failed export instead of failing silently", async () => {
    exportCsv.mockRejectedValue(new Error("Session expired."));
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(await screen.findByText(/session expired/i)).toBeTruthy();
  });
});
