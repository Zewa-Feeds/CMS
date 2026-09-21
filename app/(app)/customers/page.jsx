"use client";

import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Eye, Users, BadgeCheck } from "lucide-react";
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
  const [sortKey, setSortKey] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");

  /** Search and sort run server-side (§7.1) — name, email, phone, spend, and alphabetical. */
  const refetch = useCallback(
    () =>
      loadCustomers({
        q: q.trim() || undefined,
        status: status === "All" ? undefined : status.toUpperCase(),
        sort: sortKey,
        dir: sortDir,
        limit: 100,
      }).catch(() => undefined),
    [loadCustomers, q, status, sortKey, sortDir],
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

  const handleSortSelect = (val) => {
    const [key, dir] = val.split("_");
    setSortKey(key);
    setSortDir(dir);
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const rows = data ?? [];

  // Instant client-side sorting gives snappy feedback while refetch keeps pagination in sync
  const sortedRows = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      if (sortKey === "name") {
        const diff = (a.name || a.email || "").localeCompare(b.name || b.email || "", undefined, { sensitivity: "base" });
        return sortDir === "desc" ? -diff : diff;
      }
      if (sortKey === "orders") {
        const diff = sortDir === "asc" ? (a.orders ?? 0) - (b.orders ?? 0) : (b.orders ?? 0) - (a.orders ?? 0);
        if (diff !== 0) return diff;
        return (a.name || a.email || "").localeCompare(b.name || b.email || "", undefined, { sensitivity: "base" });
      }
      if (sortKey === "registered") {
        const aTime = new Date(a.registeredAt).getTime();
        const bTime = new Date(b.registeredAt).getTime();
        return sortDir === "asc" ? aTime - bTime : bTime - aTime;
      }
      // "spend" — Total ordered value
      const aSpend = a.spentPaise ?? (a.spent ? Math.round(a.spent * 100) : 0);
      const bSpend = b.spentPaise ?? (b.spent ? Math.round(b.spent * 100) : 0);
      const diff = sortDir === "asc" ? aSpend - bSpend : bSpend - aSpend;
      if (diff !== 0) return diff;
      return (a.name || a.email || "").localeCompare(b.name || b.email || "", undefined, { sensitivity: "base" });
    });
    return list;
  }, [rows, sortKey, sortDir]);

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
          <Select
            value={`${sortKey}_${sortDir}`}
            onChange={(e) => handleSortSelect(e.target.value)}
            className="w-auto"
            aria-label="Sort by"
          >
            <option value="spend_desc">Total ordered value (High to Low)</option>
            <option value="spend_asc">Total ordered value (Low to High)</option>
            <option value="name_asc">Alphabetical (A–Z)</option>
            <option value="name_desc">Alphabetical (Z–A)</option>
            <option value="orders_desc">Orders (Most to Least)</option>
            <option value="orders_asc">Orders (Least to Most)</option>
            <option value="registered_desc">Newest registered</option>
            <option value="registered_asc">Oldest registered</option>
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
        ) : sortedRows.length === 0 ? (
          <EmptyState icon={Users} title="No customers match">Try a different search.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th sortable active={sortKey === "name"} dir={sortDir} onSort={() => toggleSort("name")}>
                    Customer
                  </Th>
                  <Th>Phone</Th>
                  <Th sortable active={sortKey === "registered"} dir={sortDir} onSort={() => toggleSort("registered")}>
                    Registered
                  </Th>
                  <Th right sortable active={sortKey === "orders"} dir={sortDir} onSort={() => toggleSort("orders")}>
                    Orders
                  </Th>
                  <Th right sortable active={sortKey === "spend"} dir={sortDir} onSort={() => toggleSort("spend")}>
                    Lifetime Spend
                  </Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((c) => (
                  <Tr key={c.email}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-[11.5px] font-semibold text-teal">
                          {initials(c.name)}
                        </span>
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <CellSub>
                            <span className="inline-flex items-center gap-1">
                              {c.email}
                              {c.emailVerified && (
                                <BadgeCheck size={13} className="shrink-0 text-teal-deep" title="Email verified" />
                              )}
                            </span>
                          </CellSub>
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
