import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * "Give coins" on the customer profile.
 *
 * The action exists here because this is where the operator already has the
 * customer in front of them. It NAVIGATES to the Give Coins workflow with the
 * customer preselected rather than reimplementing the credit — there must stay
 * exactly one audited path by which coins are created by hand.
 */

const getCustomer = vi.fn();
const setCustomerStatus = vi.fn();
const push = vi.fn();

let permissions = ["customers.view", "loyalty.adjust"];

const CUSTOMER = {
  id: "cust-42",
  name: "Parth Tandalwade",
  email: "parth@example.com",
  status: "ACTIVE",
  statusLabel: "Active",
  emailVerified: true,
  addresses: [],
  orders: [],
  reviews: [],
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cust-42" }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions }),
  useData: (sel) => sel({ getCustomer, setCustomerStatus }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ push }),
}));

const { default: CustomerProfilePage } = await import("./page");

beforeEach(() => {
  permissions = ["customers.view", "loyalty.adjust"];
  getCustomer.mockResolvedValue(CUSTOMER);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the Give coins action", () => {
  it("is offered to an admin holding loyalty.adjust", async () => {
    render(<CustomerProfilePage />);
    expect(await screen.findByText(/give coins/i)).toBeTruthy();
  });

  it("carries the customer id so the workflow opens preselected", async () => {
    render(<CustomerProfilePage />);
    const link = (await screen.findByText(/give coins/i)).closest("a");
    expect(link.getAttribute("href")).toBe("/loyalty/give?customerId=cust-42");
  });

  it("is hidden from an operator without loyalty.adjust", async () => {
    permissions = ["customers.view", "customers.ban"];
    render(<CustomerProfilePage />);

    // The profile still renders — only the privileged action is absent. Asserted
    // on the heading: the email appears twice (page subtitle and details list).
    expect(
      await screen.findByRole("heading", { name: "Parth Tandalwade" }),
    ).toBeTruthy();
    expect(screen.queryByText(/give coins/i)).toBeNull();
  });

  it("does not award coins itself — it only links", async () => {
    render(<CustomerProfilePage />);
    await screen.findByText(/give coins/i);
    // No adjustment call exists on this page at all.
    expect(setCustomerStatus).not.toHaveBeenCalled();
  });
});
