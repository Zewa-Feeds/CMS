import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Give Coins — the admin credit workflow.
 *
 * What earns tests here is the part that moves money: that the endpoint is not
 * called until the admin confirms, that ONE idempotency key is generated per
 * submission (the whole point of the backend change), and that the permission
 * gate renders. The layout is not asserted — a snapshot of a form proves it
 * changed, not that it broke.
 */

const list = vi.fn();
const customer = vi.fn();
const adjust = vi.fn();
const push = vi.fn();

let permissions = ["loyalty.adjust"];

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions }),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ push }),
}));

vi.mock("@/lib/api", () => ({
  customers: { list: (...a) => list(...a) },
  loyalty: { customer: (...a) => customer(...a), adjust: (...a) => adjust(...a) },
}));

const { default: GiveCoinsPage } = await import("./page");

const CUSTOMER = {
  id: "c-1",
  firstName: "Parth",
  lastName: "Tandalwade",
  email: "parth@example.com",
  phone: "+919000000000",
};

beforeEach(() => {
  permissions = ["loyalty.adjust"];
  list.mockResolvedValue({ data: [CUSTOMER] });
  customer.mockResolvedValue({ availableCoins: 250 });
  adjust.mockResolvedValue({ coins: 500, lotId: "lot-1" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Search, pick the customer, and fill the form with a valid grant. */
async function fillValidGrant(coins = "500") {
  render(<GiveCoinsPage />);

  fireEvent.change(screen.getByLabelText(/find the customer/i), {
    target: { value: "parth" },
  });
  const hit = await screen.findByText("Parth Tandalwade");
  fireEvent.click(hit);

  await waitFor(() => expect(customer).toHaveBeenCalledWith("c-1"));

  // `Field` appends a "*" to the label of a required control, so the accessible
  // name is "Coins *" — matched unanchored, and narrowed by element type because
  // "coins" also appears in the heading and the submit button.
  fireEvent.change(coinsInput(), { target: { value: coins } });
  fireEvent.change(noteInput(), {
    target: { value: "Promotional reward for customer" },
  });
}

const coinsInput = () => screen.getByLabelText(/coins/i, { selector: "input#give-coins" });
const noteInput = () => screen.getByLabelText(/note/i, { selector: "textarea#give-note" });

describe("permissions", () => {
  it("renders the workflow for an admin holding loyalty.adjust", async () => {
    render(<GiveCoinsPage />);
    // Scoped to the heading: "Give Zewa Coins" is also the submit button's label.
    expect(await screen.findByRole("heading", { name: /give zewa coins/i })).toBeTruthy();
    expect(screen.getByLabelText(/find the customer/i)).toBeTruthy();
  });

  it("refuses the page without loyalty.adjust — the gate is not a hidden button", () => {
    permissions = ["loyalty.view"];
    render(<GiveCoinsPage />);
    expect(screen.queryByLabelText(/find the customer/i)).toBeNull();
  });
});

describe("customer selection", () => {
  it("searches server-side and shows enough identity to pick the right person", async () => {
    render(<GiveCoinsPage />);
    fireEvent.change(screen.getByLabelText(/find the customer/i), {
      target: { value: "parth" },
    });

    expect(await screen.findByText("Parth Tandalwade")).toBeTruthy();
    expect(screen.getByText(/parth@example\.com/)).toBeTruthy();
    await waitFor(() => expect(list).toHaveBeenCalled());
  });

  it("does not search on a single character", async () => {
    render(<GiveCoinsPage />);
    fireEvent.change(screen.getByLabelText(/find the customer/i), { target: { value: "p" } });
    await new Promise((r) => setTimeout(r, 30));
    expect(list).not.toHaveBeenCalled();
  });

  it("loads the selected customer's balance", async () => {
    await fillValidGrant();
    // "250" also appears in the preview rows, so assert on the labelled line.
    expect(await screen.findByText(/250 Zewa Coins/i)).toBeTruthy();
    expect(customer).toHaveBeenCalledWith("c-1");
  });
});

describe("the balance preview is display only", () => {
  it("shows current, added and resulting balance", async () => {
    await fillValidGrant("500");
    expect(await screen.findByText("+500")).toBeTruthy();
    expect(screen.getByText("750")).toBeTruthy();
  });
});

describe("confirmation gates the credit", () => {
  it("does NOT call the API until the admin confirms", async () => {
    await fillValidGrant();
    fireEvent.click(screen.getByRole("button", { name: /give 500 zewa coins/i }));

    expect(await screen.findByText(/cannot be undone/i)).toBeTruthy();
    expect(adjust).not.toHaveBeenCalled();
  });

  it("credits once confirmed, sending a positive integer and the note", async () => {
    await fillValidGrant();
    fireEvent.click(screen.getByRole("button", { name: /give 500 zewa coins/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm & give/i }));

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1));
    const [id, body] = adjust.mock.calls[0];
    expect(id).toBe("c-1");
    expect(body.coins).toBe(500);
    expect(body.note).toBe("Promotional reward for customer");
    expect(body.reason).toBe("GOODWILL");
  });

  it("sends an Idempotency-Key — one per submission", async () => {
    await fillValidGrant();
    fireEvent.click(screen.getByRole("button", { name: /give 500 zewa coins/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm & give/i }));

    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(1));
    const [, , opts] = adjust.mock.calls[0];
    expect(opts?.idempotencyKey).toBeTruthy();
    expect(String(opts.idempotencyKey).length).toBeGreaterThanOrEqual(8);
  });

  it("reports success with a toast and refreshes the balance from the server", async () => {
    customer.mockResolvedValueOnce({ availableCoins: 250 }).mockResolvedValueOnce({
      availableCoins: 750,
    });

    await fillValidGrant();
    fireEvent.click(screen.getByRole("button", { name: /give 500 zewa coins/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm & give/i }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(String(push.mock.calls[0][0])).toMatch(/500 Zewa Coins given/i);
    // Re-read rather than trusting the local sum.
    await waitFor(() => expect(customer).toHaveBeenCalledTimes(2));
  });
});

describe("validation happens before anything is sent", () => {
  it("refuses zero coins", async () => {
    await fillValidGrant("0");
    const btn = screen.getByRole("button", { name: /give zewa coins/i });
    expect(btn.disabled).toBe(true);
    expect(adjust).not.toHaveBeenCalled();
  });

  it("strips anything that is not a digit, so a decimal cannot be typed", async () => {
    await fillValidGrant();
    const field = coinsInput();
    fireEvent.change(field, { target: { value: "12.5" } });
    expect(field.value).toBe("125");
  });

  it("requires a note of at least three characters", async () => {
    render(<GiveCoinsPage />);
    fireEvent.change(screen.getByLabelText(/find the customer/i), { target: { value: "parth" } });
    fireEvent.click(await screen.findByText("Parth Tandalwade"));
    fireEvent.change(coinsInput(), { target: { value: "100" } });
    fireEvent.change(noteInput(), { target: { value: "x" } });

    expect(screen.getByRole("button", { name: /give 100 zewa coins/i }).disabled).toBe(true);
    expect(adjust).not.toHaveBeenCalled();
  });
});

describe("failure is surfaced, never swallowed", () => {
  it("shows the server's own message", async () => {
    adjust.mockRejectedValueOnce(
      new Error("Adjustments above 500 coins need a second approver."),
    );

    await fillValidGrant();
    fireEvent.click(screen.getByRole("button", { name: /give 500 zewa coins/i }));
    fireEvent.click(await screen.findByRole("button", { name: /confirm & give/i }));

    expect(await screen.findByText(/need a second approver/i)).toBeTruthy();
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(/second approver/i),
      expect.objectContaining({ bad: true }),
    );
  });
});
