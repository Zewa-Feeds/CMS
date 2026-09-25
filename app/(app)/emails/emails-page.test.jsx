import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Email log page.
 *
 * Exists because of the Sep 2026 ZeptoMail outage, where the mail that failed was
 * the mail nobody could see or replay. What is asserted is the behaviour that
 * makes recovery possible and the two guards that must never regress: a security
 * template is never resendable from here, and OPS cannot resend at all.
 */

const list = vi.fn();
const templates = vi.fn();
const resend = vi.fn();
const resendMany = vi.fn();
const push = vi.fn();

let permissions = ["emails.view", "emails.resend"];

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ push }),
}));

vi.mock("@/lib/api", () => ({
  emails: {
    list: (...a) => list(...a),
    templates: (...a) => templates(...a),
    resend: (...a) => resend(...a),
    resendMany: (...a) => resendMany(...a),
  },
}));

const { default: EmailsPage } = await import("./page");

const ORDER_ROW = {
  id: "e-order",
  template: "order-placed",
  subject: "Your order 27ZFO001",
  toEmail: "buyer@example.com",
  status: "FAILED",
  error: "ZeptoMail is unavailable. Please try again.",
  queuedAt: "2026-09-25T04:00:00.000Z",
  sentAt: null,
  isResend: false,
  orderNo: "27ZFO001",
  customerName: "Aarav Sharma",
  resendable: true,
  resendBlockedReason: null,
};

const OTP_ROW = {
  id: "e-otp",
  template: "cms-login-otp",
  subject: "Your CMS login code",
  toEmail: "admin@zewafeeds.com",
  status: "SKIPPED",
  error: "ZeptoMail not configured — send skipped",
  queuedAt: "2026-09-25T04:01:00.000Z",
  sentAt: null,
  isResend: false,
  orderNo: null,
  customerName: null,
  resendable: false,
  resendBlockedReason:
    "This email contains a single-use code that has expired. Ask the recipient to request a new one.",
};

beforeEach(() => {
  permissions = ["emails.view", "emails.resend"];
  list.mockResolvedValue({
    data: [ORDER_ROW, OTP_ROW],
    meta: { page: 1, perPage: 25, total: 2, totalPages: 1 },
  });
  templates.mockResolvedValue(["order-placed", "cms-login-otp"]);
  resend.mockResolvedValue({ id: "e-new", sent: true, resentFromId: "e-order" });
  resendMany.mockResolvedValue({ requested: 1, sent: 1, failed: 0, results: [] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function renderPage() {
  render(<EmailsPage />);
  await waitFor(() => expect(list).toHaveBeenCalled());
  await screen.findByText(/Your order 27ZFO001/);
}

describe("the log", () => {
  it("shows a failed row with the provider's own error when expanded", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Your order 27ZFO001/ }));

    // Before this the string only existed in the Render logs.
    expect(await screen.findByText(/ZeptoMail is unavailable/i)).toBeTruthy();
  });

  /*
   * SKIPPED must read differently from FAILED. "There was no provider" is a
   * settings fix; "the provider refused" is an investigation. Conflating them is
   * what made the outage slow to diagnose.
   */
  it("distinguishes Skipped from Failed", async () => {
    await renderPage();

    // Scoped to each row: "Skipped" and "Failed" are also filter options, so a
    // bare getByText matches the dropdown too.
    const otpRow = screen.getByText("admin@zewafeeds.com").closest("tr");
    const orderRow = screen.getByText("buyer@example.com").closest("tr");

    expect(within(otpRow).getByText("Skipped")).toBeTruthy();
    expect(within(orderRow).getByText("Failed")).toBeTruthy();
    expect(within(otpRow).queryByText("Failed")).toBeNull();
  });

  it("asks the server for the did-not-arrive view, not a client-side guess", async () => {
    await renderPage();

    fireEvent.click(screen.getByLabelText(/did not arrive/i));

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ unsentOnly: true })),
    );
  });
});

describe("resend", () => {
  it("resends a single ordinary email", async () => {
    await renderPage();

    const row = screen.getByText("buyer@example.com").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: /^resend$/i }));

    await waitFor(() => expect(resend).toHaveBeenCalledWith("e-order"));
    // Re-read rather than patching the row locally: the new row is a separate
    // record, so the list has genuinely changed.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  /* The rule that matters most: a single-use code is never replayed from here. */
  it("will not resend a security template, and cannot select it", async () => {
    await renderPage();

    const row = screen.getByText("admin@zewafeeds.com").closest("tr");
    expect(within(row).getByRole("button", { name: /^resend$/i }).disabled).toBe(true);
    expect(within(row).getByRole("checkbox").disabled).toBe(true);
  });

  it("names the count before a bulk resend", async () => {
    await renderPage();

    const row = screen.getByText("buyer@example.com").closest("tr");
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /resend 1/i }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/1/)));
    await waitFor(() => expect(resendMany).toHaveBeenCalledWith(["e-order"]));
  });

  it("sends nothing when the confirmation is dismissed", async () => {
    window.confirm.mockReturnValue(false);
    await renderPage();

    const row = screen.getByText("buyer@example.com").closest("tr");
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /resend 1/i }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(resendMany).not.toHaveBeenCalled();
  });

  it("selects only resendable rows when selecting all", async () => {
    await renderPage();

    fireEvent.click(screen.getByLabelText(/select all resendable/i));
    fireEvent.click(screen.getByRole("button", { name: /resend 1/i }));

    // The OTP row is excluded, so the count is 1 of 2 visible rows.
    await waitFor(() => expect(resendMany).toHaveBeenCalledWith(["e-order"]));
  });

  it("reports a partial bulk failure rather than claiming success", async () => {
    resendMany.mockResolvedValue({ requested: 2, sent: 1, failed: 1, results: [] });
    await renderPage();

    fireEvent.click(screen.getByLabelText(/select all resendable/i));
    fireEvent.click(screen.getByRole("button", { name: /resend 1/i }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/could not be sent/i), { bad: true }),
    );
  });
});

describe("permissions", () => {
  it("hides every resend control from OPS", async () => {
    permissions = ["emails.view"];
    await renderPage();

    expect(screen.queryByRole("button", { name: /^resend$/i })).toBeNull();
    expect(screen.queryByLabelText(/select all resendable/i)).toBeNull();
  });
});
