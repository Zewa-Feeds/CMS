import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * "Resend link" on an unverified customer.
 *
 * The page already displayed "Email Verified: No" and offered nothing to do about
 * it, so support could see a stranded signup and not fix it. That happens whenever
 * mail is down at the moment someone registers — which is exactly what the Sep 2026
 * ZeptoMail outage caused.
 *
 * The server mints a FRESH token rather than resending the original message; that
 * token is single-use and 24-hour-bound, so replaying the old email would deliver a
 * dead link. These tests pin that the action is offered only when it applies, and
 * only to operators allowed to email a customer.
 */

const getCustomer = vi.fn();
const setCustomerStatus = vi.fn();
const resendVerification = vi.fn();
const push = vi.fn();

let permissions = ["customers.view", "customers.ban"];

const UNVERIFIED = {
  id: "cust-42",
  name: "Parth Tandalwade",
  email: "parth@example.com",
  status: "ACTIVE",
  statusLabel: "Active",
  emailVerified: false,
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

vi.mock("@/lib/api", () => ({
  formatPaise: (p) => `₹${((p ?? 0) / 100).toFixed(2)}`,
  customers: { resendVerification: (...a) => resendVerification(...a) },
}));

const { default: CustomerProfilePage } = await import("./page");

beforeEach(() => {
  permissions = ["customers.view", "customers.ban"];
  getCustomer.mockResolvedValue(UNVERIFIED);
  resendVerification.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("resending a verification link", () => {
  it("offers the action on an unverified customer", async () => {
    render(<CustomerProfilePage />);
    expect(await screen.findByRole("button", { name: /resend link/i })).toBeTruthy();
  });

  it("calls the admin endpoint with the customer id", async () => {
    render(<CustomerProfilePage />);
    fireEvent.click(await screen.findByRole("button", { name: /resend link/i }));

    await waitFor(() => expect(resendVerification).toHaveBeenCalledWith("cust-42"));
    // Re-read so the row reflects the server rather than an optimistic guess.
    await waitFor(() => expect(getCustomer).toHaveBeenCalledTimes(2));
  });

  /* Nothing to re-issue — offering it would imply the account is stuck. */
  it("is absent once the customer is verified", async () => {
    getCustomer.mockResolvedValue({ ...UNVERIFIED, emailVerified: true });
    render(<CustomerProfilePage />);

    await screen.findByText(/email verified/i);
    expect(screen.queryByRole("button", { name: /resend link/i })).toBeNull();
  });

  /* Emailing a customer is outward-facing, so plain view access is not enough. */
  it("is hidden from an operator who cannot email customers", async () => {
    permissions = ["customers.view"];
    render(<CustomerProfilePage />);

    await screen.findByText(/email verified/i);
    expect(screen.queryByRole("button", { name: /resend link/i })).toBeNull();
  });

  it("surfaces a failure instead of claiming the link went out", async () => {
    resendVerification.mockRejectedValue(new Error("This customer is banned."));
    render(<CustomerProfilePage />);

    fireEvent.click(await screen.findByRole("button", { name: /resend link/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("This customer is banned.", { bad: true }),
    );
  });
});
