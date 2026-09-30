/**
 * "SENT" does not tell an operator what the customer received.
 *
 * The log row proves delivery and nothing else — not the total, not the
 * address, not whether the body rendered at all. That gap is exactly how the
 * staff alerts shipped with invisible text for weeks: every row read SENT.
 *
 * The preview replays `EmailLog.bodyHtml`, the HTML actually handed to the
 * provider. Two properties matter and are pinned here: it must never
 * re-render from today's order (the order has moved on), and it must degrade
 * honestly for rows stored before the body was kept.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { EmailPreviewModal } from "@/components/orders/EmailPreviewModal";

const get = vi.fn();
vi.mock("@/lib/api", () => ({ emails: { get: (...a) => get(...a) } }));

afterEach(() => {
  cleanup();
  get.mockReset();
});

const SENT_BODY = "<html><body><h1>Order 27ZFO115 confirmed</h1><p>Total ₹449.10</p></body></html>";

const row = (over = {}) => ({
  id: "log-1",
  subject: "Order 27ZFO115 confirmed",
  toEmail: "abhipm388@gmail.com",
  status: "SENT",
  template: "order-placed",
  sentAt: "2026-09-26T17:09:12.000Z",
  bodyHtml: SENT_BODY,
  ...over,
});

const frame = () => document.querySelector("iframe");

describe("the email preview", () => {
  it("shows the stored body, not a re-render of the order", () => {
    render(<EmailPreviewModal open onClose={() => {}} email={row()} />);
    expect(frame()?.getAttribute("srcdoc")).toBe(SENT_BODY);
  });

  it("uses the body already on the row without calling the API", () => {
    render(<EmailPreviewModal open onClose={() => {}} email={row()} />);
    expect(get).not.toHaveBeenCalled();
  });

  it("fetches the body when the row does not carry one", async () => {
    get.mockResolvedValue({ bodyHtml: SENT_BODY });
    render(<EmailPreviewModal open onClose={() => {}} email={row({ bodyHtml: undefined })} />);

    await waitFor(() => expect(frame()?.getAttribute("srcdoc")).toBe(SENT_BODY));
    expect(get).toHaveBeenCalledWith("log-1");
  });

  it("says so plainly when no copy was stored, rather than showing a blank frame", async () => {
    get.mockResolvedValue({ bodyHtml: null });
    render(<EmailPreviewModal open onClose={() => {}} email={row({ bodyHtml: undefined })} />);

    await waitFor(() => expect(screen.getByText(/No stored copy/)).toBeTruthy());
    expect(frame()).toBeNull();
  });

  it("surfaces a fetch failure instead of pretending the email was empty", async () => {
    get.mockRejectedValue(new Error("Network unreachable"));
    render(<EmailPreviewModal open onClose={() => {}} email={row({ bodyHtml: undefined })} />);

    await waitFor(() => expect(screen.getByText("Network unreachable")).toBeTruthy());
  });

  it("renders the replayed HTML inert — no scripts, opaque origin", () => {
    render(<EmailPreviewModal open onClose={() => {}} email={row()} />);
    // Stored third-party HTML must paint and do nothing else.
    expect(frame()?.getAttribute("sandbox")).toBe("");
  });

  it("shows the recipient and the delivery status", () => {
    render(<EmailPreviewModal open onClose={() => {}} email={row()} />);
    expect(screen.getByText(/abhipm388@gmail.com/)).toBeTruthy();
    expect(screen.getByText("SENT")).toBeTruthy();
  });

  it("shows the failure reason on a failed send", () => {
    render(
      <EmailPreviewModal
        open
        onClose={() => {}}
        email={row({ status: "FAILED", error: "550 mailbox unavailable" })}
      />
    );
    expect(screen.getByText("550 mailbox unavailable")).toBeTruthy();
    expect(screen.getByText("FAILED")).toBeTruthy();
  });

  it("renders nothing when closed, and does not fetch", () => {
    render(<EmailPreviewModal open={false} onClose={() => {}} email={row({ bodyHtml: undefined })} />);
    expect(frame()).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("renders nothing without an email row", () => {
    const { container } = render(<EmailPreviewModal open onClose={() => {}} email={null} />);
    expect(container.textContent).toBe("");
  });
});
