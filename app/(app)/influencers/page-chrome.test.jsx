/**
 * The influencer pages must RENDER.
 *
 * A passing `next build` did not catch that Breadcrumbs takes `parts`, not
 * `items` — the mismatch is only reachable at runtime, where `parts.map` threw
 * "Cannot read properties of undefined (reading 'map')" and the whole page
 * became an error boundary. These mount the real components.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { RoleGate } from "@/components/shell/RoleGate";

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions: ["coupons.edit"] }),
}));

afterEach(cleanup);

describe("the shared page chrome, as the influencer pages call it", () => {
  it("renders breadcrumbs from `parts`", () => {
    render(<Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Influencers" }]} />);
    expect(screen.getByText("Influencers")).toBeTruthy();
  });

  it("throws when handed `items` — the shape that broke the page", () => {
    // Pinning the trap: anything passing `items` renders nothing and crashes.
    expect(() => render(<Breadcrumbs items={[{ label: "x" }]} />)).toThrow(/map/);
  });

  it("renders a subtitle from `sub`", () => {
    render(<PageHeader title="Influencers" sub="2 affiliates" />);
    expect(screen.getByText("2 affiliates")).toBeTruthy();
  });

  it("gates on `perm`", () => {
    render(<RoleGate perm="coupons.edit"><span>allowed</span></RoleGate>);
    expect(screen.getByText("allowed")).toBeTruthy();
  });

  it("denies when the permission is missing", () => {
    render(<RoleGate perm="nope.perm"><span>allowed</span></RoleGate>);
    expect(screen.queryByText("allowed")).toBeNull();
  });
});
