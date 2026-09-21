import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Table, Th, Tr, Td, useSortableTable } from "./Table";

describe("Th component sort button", () => {
  it("renders a neutral sort icon when sortable but not active", () => {
    render(
      <Table>
        <thead>
          <tr>
            <Th sortable onSort={vi.fn()}>
              Product
            </Th>
          </tr>
        </thead>
      </Table>
    );

    const th = screen.getByRole("button", { name: /product/i });
    expect(th).toBeTruthy();
    expect(th.getAttribute("aria-sort")).toBe("none");
    expect(th.getAttribute("title")).toBe("Click to sort");
  });

  it("renders ascending sort icon and aria-sort when active asc", () => {
    render(
      <Table>
        <thead>
          <tr>
            <Th sortable active dir="asc" onSort={vi.fn()}>
              Price
            </Th>
          </tr>
        </thead>
      </Table>
    );

    const th = screen.getByRole("button", { name: /price/i });
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    expect(th.getAttribute("title")).toBe("Sorted ascending. Click to sort descending.");
  });

  it("renders descending sort icon and aria-sort when active desc", () => {
    render(
      <Table>
        <thead>
          <tr>
            <Th sortable active dir="desc" onSort={vi.fn()}>
              Orders
            </Th>
          </tr>
        </thead>
      </Table>
    );

    const th = screen.getByRole("button", { name: /orders/i });
    expect(th.getAttribute("aria-sort")).toBe("descending");
    expect(th.getAttribute("title")).toBe("Sorted descending. Click to reset to normal.");
  });

  it("triggers onSort via click and keyboard (Enter/Space)", () => {
    const handleSort = vi.fn();
    render(
      <Table>
        <thead>
          <tr>
            <Th onSort={handleSort}>Category</Th>
          </tr>
        </thead>
      </Table>
    );

    const th = screen.getByRole("button", { name: /category/i });
    fireEvent.click(th);
    expect(handleSort).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(th, { key: "Enter" });
    expect(handleSort).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(th, { key: " " });
    expect(handleSort).toHaveBeenCalledTimes(3);
  });
});

function SortableTableTestComponent({ items, customExtractors }) {
  const { sortedItems, sortKey, sortDir, toggleSort } = useSortableTable(
    items,
    { key: null, dir: "asc" },
    customExtractors
  );

  return (
    <Table>
      <thead>
        <tr>
          <Th
            sortable
            active={sortKey === "name"}
            dir={sortDir}
            onSort={() => toggleSort("name", "asc")}
          >
            Name
          </Th>
          <Th
            sortable
            right
            active={sortKey === "price"}
            dir={sortDir}
            onSort={() => toggleSort("price", "desc")}
          >
            Price
          </Th>
        </tr>
      </thead>
      <tbody>
        {sortedItems.map((item) => (
          <Tr key={item.id}>
            <Td>{item.name}</Td>
            <Td right>{item.price}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

describe("useSortableTable hook", () => {
  const sample = [
    { id: 1, name: "Betta Bites", price: 299 },
    { id: 2, name: "Goldfish Pellets", price: 499 },
    { id: 3, name: "Algae Wafers", price: 150 },
  ];

  it("sorts strings ascending and descending on toggle, then resets to normal on 3rd click", () => {
    render(<SortableTableTestComponent items={sample} />);

    const nameTh = screen.getByRole("button", { name: /name/i });
    // Click 1: asc
    fireEvent.click(nameTh);

    let cells = screen.getAllByRole("cell");
    expect(cells[0].textContent).toBe("Algae Wafers");
    expect(cells[2].textContent).toBe("Betta Bites");
    expect(cells[4].textContent).toBe("Goldfish Pellets");

    // Click 2: desc
    fireEvent.click(nameTh);
    cells = screen.getAllByRole("cell");
    expect(cells[0].textContent).toBe("Goldfish Pellets");
    expect(cells[2].textContent).toBe("Betta Bites");
    expect(cells[4].textContent).toBe("Algae Wafers");

    // Click 3: resets back to normal (original unsorted order)
    fireEvent.click(nameTh);
    cells = screen.getAllByRole("cell");
    expect(cells[0].textContent).toBe("Betta Bites");
    expect(cells[2].textContent).toBe("Goldfish Pellets");
    expect(cells[4].textContent).toBe("Algae Wafers");
  });

  it("sorts numbers with custom default direction (desc), flips to asc, then resets to normal", () => {
    render(<SortableTableTestComponent items={sample} />);

    const priceTh = screen.getByRole("button", { name: /price/i });
    // Click 1: desc
    fireEvent.click(priceTh);

    let cells = screen.getAllByRole("cell");
    // First item is Goldfish Pellets (price 499)
    expect(cells[0].textContent).toBe("Goldfish Pellets");
    expect(cells[1].textContent).toBe("499");

    // Click 2: asc
    fireEvent.click(priceTh);
    cells = screen.getAllByRole("cell");
    // Flipped to ascending: Algae Wafers (150)
    expect(cells[0].textContent).toBe("Algae Wafers");
    expect(cells[1].textContent).toBe("150");

    // Click 3: resets back to normal
    fireEvent.click(priceTh);
    cells = screen.getAllByRole("cell");
    expect(cells[0].textContent).toBe("Betta Bites");
    expect(cells[1].textContent).toBe("299");
  });

  it("handles null / undefined values and custom extractors", () => {
    const dataWithNulls = [
      { id: 1, date: "2026-03-01", meta: { rank: 2 } },
      { id: 2, date: null, meta: { rank: 1 } },
      { id: 3, date: "2026-01-15", meta: { rank: null } },
    ];

    function NullsTestComponent() {
      const {
        items,
        requestSort,
        getSortDirection,
      } = useSortableTable(
        dataWithNulls,
        { key: "rank", direction: "asc" },
        {
          rank: (item) => item.meta.rank,
          date: (item) => (item.date ? new Date(item.date).getTime() : null),
        }
      );

      return (
        <Table>
          <thead>
            <tr>
              <Th
                sortable
                sortDirection={getSortDirection("rank")}
                onSort={() => requestSort("rank", "asc")}
              >
                Rank
              </Th>
              <Th
                sortable
                sortDirection={getSortDirection("date")}
                onSort={() => requestSort("date", "desc")}
              >
                Date
              </Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <Tr key={row.id}>
                <Td>{row.meta.rank ?? "null"}</Td>
                <Td>{row.date ?? "null"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      );
    }

    render(<NullsTestComponent />);

    // Initially sorted by rank asc: 1, 2, null (null at bottom in asc)
    let cells = screen.getAllByRole("cell");
    expect(cells[0].textContent).toBe("1");
    expect(cells[2].textContent).toBe("2");
    expect(cells[4].textContent).toBe("null");

    // Click Date header to sort by date desc
    const dateTh = screen.getByRole("button", { name: /date/i });
    fireEvent.click(dateTh);

    cells = screen.getAllByRole("cell");
    // Descending dates: 2026-03-01, 2026-01-15, null
    expect(cells[1].textContent).toBe("2026-03-01");
    expect(cells[3].textContent).toBe("2026-01-15");
    expect(cells[5].textContent).toBe("null");
  });
});
