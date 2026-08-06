"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Eye, Users } from "lucide-react";
import { useData } from "@/lib/store";
import { inr, initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import {
  TableWrap,
  Table,
  Th,
  Td,
  Tr,
  CellSub,
  EmptyState,
} from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

export default function CustomersPage() {
  const { data, meta, loading, error } = useData((s) => s.customers);
  const loadCustomers = useData((s) => s.loadCustomers);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");

  /** Search runs server-side (§7.1) — name, email and phone. */
  const refetch = useCallback(
    () =>
      loadCustomers({
        q: q.trim() || undefined,
        status: status === "All" ? undefined : status.toUpperCase(),
        limit: 100,
      }).catch(() => undefined),
    [loadCustomers, q, status],
  );

  // The FIRST load must not wait for the debounce — a 250ms delay on mount is
  // pure latency on top of an already ~1s round trip. Only subsequent changes
  // (typing in the search box, flipping a filter) are debounced.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      void refetch();
      return;
    }
    const timer = setTimeout(() => void refetch(), 250);
    return () => clearTimeout(timer);
  }, [refetch]);

  const rows = data ?? [];

  return (
    <RoleGate perm="customers.view">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Customers" }]} />
      <PageHeader title="Customers" sub={`${meta?.total ?? rows.length} customers`} />

      <Card>
        <FilterBar>
          <SearchInput
            className="min-w-[220px] flex-1"
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            {["All", "Active", "Banned"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
            ))}
          </Select>
        </FilterBar>

        {/*
          `data === null` means the first fetch has not resolved. Showing the empty
          state then would read as "nothing here" when rows are still in flight.
        */}
        {error ? (
          <div className="px-4 py-12 text-center text-[13px] text-red-deep">{error}</div>
        ) : data === null ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No customers match">Try a different search.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Phone</Th>
                  <Th>Registered</Th>
                  <Th right>Orders</Th>
                  <Th right>Lifetime Spend</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <Tr key={c.email}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-[11.5px] font-semibold text-teal">
                          {initials(c.name)}
                        </span>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <CellSub>{c.email}</CellSub>
                        </div>
                      </div>
                    </Td>
                    <Td><span className="mono text-[12.5px]">{c.phone}</span></Td>
                    <Td>{new Date(c.registeredAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Td>
                    <Td right><span className="mono">{c.orders}</span></Td>
                    <Td right><span className="mono font-medium">{inr(c.spent)}</span></Td>
                    <Td><Pill tone={c.status === "Active" ? "green" : "red"}>{c.status}</Pill></Td>
                    <Td right>
                      <Link href={`/customers/${c.id}`} className={button({ variant: "ghost", size: "icon-sm" })} title="View profile">
                        <Eye size={14} />
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </RoleGate>
  );
}
