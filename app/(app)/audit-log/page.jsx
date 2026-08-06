"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { ScrollText } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Pill, Chip } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/** The API's AuditModule enum values, with display labels. */
const MODULES = [
  "PRODUCTS", "ORDERS", "CONTENT", "REVIEWS",
  "COUPONS", "CUSTOMERS", "USERS", "SETTINGS", "AUTH",
];
const MOD_LABEL = {
  PRODUCTS: "Products", ORDERS: "Orders", CONTENT: "Content", REVIEWS: "Reviews",
  COUPONS: "Coupons", CUSTOMERS: "Customers", USERS: "Users", SETTINGS: "Settings",
  AUTH: "Auth",
};
const MOD_TONE = {
  PRODUCTS: "blue", ORDERS: "amber", CONTENT: "teal", REVIEWS: "purple",
  COUPONS: "green", CUSTOMERS: "blue", USERS: "red", SETTINGS: "grey", AUTH: "grey",
};

export default function AuditLogPage() {
  const { data, meta, loading, error } = useData((s) => s.audit);
  const loadAudit = useData((s) => s.loadAudit);
  const permissions = useAuth((s) => s.permissions);

  const [q, setQ] = useState("");
  const [mod, setMod] = useState("All");

  /**
   * §12.2 row-level scoping is enforced SERVER-side: an Ops Manager holding only
   * `audit.own` receives their own entries regardless of what is requested, and
   * `meta.scope` reports which applied. Filtering here would be decoration.
   */
  const seesAll = permissions.includes("audit.all");

  const refetch = useCallback(
    () => loadAudit({ q: q.trim() || undefined, module: mod, limit: 100 }).catch(() => undefined),
    [loadAudit, q, mod],
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
    <RoleGate perm="audit.own">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Audit Log" }]} />
      <PageHeader title="Audit Log" sub="Append-only record of every change. Nobody can edit or delete entries." />

      {!seesAll && (
        <div className="mb-4">
          <InfoBox>As Ops Manager you see your own actions only. Admins see the full log.</InfoBox>
        </div>
      )}

      <Card>
        <FilterBar>
          <SearchInput className="min-w-[220px] flex-1" placeholder="Search actions or record IDs…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={mod} onChange={(e) => setMod(e.target.value)} className="w-auto">
            <option value="All">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{MOD_LABEL[m]}</option>)}
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
          <EmptyState icon={ScrollText} title="No matching entries">Adjust the filters above.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Timestamp</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Module</Th>
                  <Th>Record</Th>
                  <Th>IP</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <Tr key={i}>
                    <Td><span className="mono text-[12px]">{new Date(a.ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></Td>
                    <Td>
                      <div className="text-[13px] font-medium">{a.user}</div>
                      <CellSub>{a.role}</CellSub>
                    </Td>
                    <Td className="max-w-[320px] text-[13px]">{a.act}</Td>
                    <Td><Pill tone={MOD_TONE[a.mod]} dot={false}>{MOD_LABEL[a.mod] ?? a.mod}</Pill></Td>
                    <Td><Chip>{a.rec}</Chip></Td>
                    <Td><span className="mono text-[12px] text-muted">{a.ip}</span></Td>
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
