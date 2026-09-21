import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";

const loadCustomers = vi.fn().mockResolvedValue({});
let permissions = ["customers.view"];

const SAMPLE_CUSTOMERS = [
  {
    id: "cust-1",
    name: "Alice Adams",
    email: "alice@example.com",
    phone: "9111111111",
    registeredAt: "2026-01-01T10:00:00.000Z",
    orders: 2,
    spentPaise: 10000,
    spent: 100,
    status: "Active",
    emailVerified: true,
  },
  {
    id: "cust-2",
    name: "Charlie Clark",
    email: "charlie@example.com",
    phone: "9222222222",
    registeredAt: "2026-03-01T10:00:00.000Z",
    orders: 5,
    spentPaise: 50000,
    spent: 500,
    status: "Active",
    emailVerified: false,
  },
  {
    id: "cust-3",
    name: "Bob Baker",
    email: "bob@example.com",
    phone: "9333333333",
    registeredAt: "2026-02-01T10:00:00.000Z",
    orders: 1,
    spentPaise: 0,
    spent: 0,
    status: "Active",
    emailVerified: true,
  },
];

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/store", () => ({
  useAuth: (sel) => sel({ permissions }),
  useData: (sel) =>
    sel({
      customers: {
        data: SAMPLE_CUSTOMERS,
        meta: { total: 3 },
        loading: false,
        error: null,
      },
      loadCustomers,
    }),
}));

const { default: CustomersPage } = await import("./page");

beforeEach(() => {
  permissions = ["customers.view"];
  loadCustomers.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Customers page sorting", () => {
  it("defaults to sorting by Total ordered value (Lifetime Spend) descending", () => {
    render(<CustomersPage />);

    const rows = screen.getAllByRole("row");
    // Row 0 is the table header, rows 1-3 are customer rows
    expect(rows[1].textContent).toContain("Charlie Clark");
    expect(rows[1].textContent).toContain("₹500");
    expect(rows[2].textContent).toContain("Alice Adams");
    expect(rows[2].textContent).toContain("₹100");
    expect(rows[3].textContent).toContain("Bob Baker");
    expect(rows[3].textContent).toContain("₹0");
  });

  it("sorts alphabetically (A–Z) when selected from dropdown", () => {
    render(<CustomersPage />);

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: "name_asc" } });

    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Alice Adams");
    expect(rows[2].textContent).toContain("Bob Baker");
    expect(rows[3].textContent).toContain("Charlie Clark");
  });

  it("sorts alphabetically (Z–A) when selected from dropdown", () => {
    render(<CustomersPage />);

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: "name_desc" } });

    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Charlie Clark");
    expect(rows[2].textContent).toContain("Bob Baker");
    expect(rows[3].textContent).toContain("Alice Adams");
  });

  it("sorts by Total ordered value (Low to High) when selected from dropdown", () => {
    render(<CustomersPage />);

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: "spend_asc" } });

    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Bob Baker");
    expect(rows[2].textContent).toContain("Alice Adams");
    expect(rows[3].textContent).toContain("Charlie Clark");
  });

  it("toggles alphabetical sort when clicking the Customer column header", () => {
    render(<CustomersPage />);

    const customerHeader = screen.getByText("Customer");
    // First click switches to name (A-Z)
    fireEvent.click(customerHeader);

    let rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Alice Adams");
    expect(rows[2].textContent).toContain("Bob Baker");
    expect(rows[3].textContent).toContain("Charlie Clark");

    // Second click switches to name (Z-A)
    fireEvent.click(customerHeader);

    rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Charlie Clark");
    expect(rows[2].textContent).toContain("Bob Baker");
    expect(rows[3].textContent).toContain("Alice Adams");
  });

  it("toggles spend sort when clicking the Lifetime Spend column header", () => {
    render(<CustomersPage />);

    const spendHeader = screen.getByText("Lifetime Spend");
    // It already defaults to spend desc; clicking toggles to spend asc (Low to High)
    fireEvent.click(spendHeader);

    const rows = screen.getAllByRole("row");
    expect(rows[1].textContent).toContain("Bob Baker");
    expect(rows[2].textContent).toContain("Alice Adams");
    expect(rows[3].textContent).toContain("Charlie Clark");
  });

  it("calls loadCustomers on initial render with sort and dir parameters", () => {
    render(<CustomersPage />);
    expect(loadCustomers).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: "spend",
        dir: "desc",
        limit: 100,
      }),
    );
  });
});
