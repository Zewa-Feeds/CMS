import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

/**
 * The Zewa Coins submenu must actually render.
 *
 * It did not: `lib/nav.js` declared the group's items under `children` while
 * `Sidebar.jsx` reads `n.sub` (lines 26, 72, 124). `hasSub` was therefore false
 * and the entire submenu — Balances, Liability, Risk, Rules and Give Coins —
 * was unreachable from the rail, while the section header still rendered and
 * looked correct. A key name is exactly the sort of mismatch a build cannot
 * catch and a screenshot barely shows.
 */

let permissions = ["loyalty.view", "loyalty.adjust", "loyalty.config"];

vi.mock("next/navigation", () => ({
  usePathname: () => "/loyalty",
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }) => <img alt={alt} {...rest} />,
}));

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions }),
}));

const { Sidebar } = await import("./Sidebar");

afterEach(() => {
  cleanup();
  permissions = ["loyalty.view", "loyalty.adjust", "loyalty.config"];
});

/** The group is expanded by default only for the active route; open it anyway. */
function openZewaCoins() {
  const toggle = screen.getByRole("button", { name: /zewa coins/i });
  fireEvent.click(toggle);
}

describe("the Zewa Coins submenu", () => {
  it("renders every item for an admin", () => {
    render(<Sidebar />);
    // /loyalty is the active path, so the group starts expanded.
    for (const label of ["Balances", "Give Coins", "Liability", "Risk", "Rules"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("links Give Coins at /loyalty/give", () => {
    render(<Sidebar />);
    expect(screen.getByText("Give Coins").closest("a").getAttribute("href")).toBe("/loyalty/give");
  });

  it("survives collapsing and reopening the group", () => {
    render(<Sidebar />);
    openZewaCoins(); // collapse
    expect(screen.queryByText("Give Coins")).toBeNull();
    openZewaCoins(); // reopen
    expect(screen.getByText("Give Coins")).toBeTruthy();
  });
});

describe("permission gating", () => {
  it("hides Give Coins from an operator without loyalty.adjust", () => {
    permissions = ["loyalty.view"];
    render(<Sidebar />);

    expect(screen.queryByText("Give Coins")).toBeNull();
    // The rest of the section stays — only the privileged entry goes.
    expect(screen.getByText("Balances")).toBeTruthy();
    expect(screen.getByText("Liability")).toBeTruthy();
  });

  it("hides Rules without loyalty.config while keeping Give Coins", () => {
    permissions = ["loyalty.view", "loyalty.adjust"];
    render(<Sidebar />);

    expect(screen.getByText("Give Coins")).toBeTruthy();
    expect(screen.queryByText("Rules")).toBeNull();
  });

  it("hides the whole section without loyalty.view", () => {
    permissions = [];
    render(<Sidebar />);
    expect(screen.queryByRole("button", { name: /zewa coins/i })).toBeNull();
    expect(screen.queryByText("Give Coins")).toBeNull();
  });
});
