"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Ticket } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { inr } from "@/lib/utils";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

const STATUS_TONE = { Active: "green", Inactive: "grey", Expired: "red" };
const STACKING_TONE = { STACKABLE: "green", NON_STACKABLE: "grey", EXCLUSIVE: "amber" };

/** ISO -> "01 Jul 2026". */
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function CouponsPage() {
  const permissions = useAuth((s) => s.permissions);
  const { data, meta, loading, error } = useData((s) => s.coupons);
  const loadCoupons = useData((s) => s.loadCoupons);
  const deleteCoupon = useData((s) => s.deleteCoupon);
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  /*
   * Trigger and exhaustion are derived, not stored, so they filter here rather
   * than in SQL — the same reasoning the server applies to status. The coupon
   * table is tens of rows, so this is cheaper than another query parameter.
   */
  const [kind, setKind] = useState("All");
  const [del, setDel] = useState(null);

  /** Status is DERIVED server-side from the dates (§10.2), so it filters there. */
  const refetch = useCallback(
    () => loadCoupons({ q: q.trim() || undefined, status, limit: 100 }).catch(() => undefined),
    [loadCoupons, q, status],
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

  const all = data ?? [];
  const rows = all.filter((c) => {
    if (kind === "Automatic") return c.automatic;
    if (kind === "Code-based") return !c.automatic;
    if (kind === "Exhausted") return c.limit != null && c.used >= c.limit;
    if (kind === "Stackable") return c.stackingMode === "STACKABLE";
    if (kind === "Exclusive") return c.stackingMode === "EXCLUSIVE";
    return true;
  });

  /** Totals across the loaded set, so a manager sees the headline immediately. */
  /*
   * Summed in PAISE, converted once at the end.
   *
   * These read `revenuePaise` and `discountedPaise` — the API serves both those
   * and their rupee twins (`revenue`, `discounted`). Summing the paise fields
   * and handing them to inr(), which formats a RUPEE amount, reported every
   * figure a hundred times over: ₹1,287 of real coupon revenue showed as
   * ₹1,28,700. Adding up paise and dividing once is also exact, where summing
   * pre-rounded rupees would drift.
   */
  const totalsPaise = all.reduce(
    (acc, c) => ({
      revenue: acc.revenue + (c.revenuePaise ?? 0),
      discounted: acc.discounted + (c.discountedPaise ?? 0),
      orders: acc.orders + (c.confirmedOrders ?? 0),
    }),
    { revenue: 0, discounted: 0, orders: 0 },
  );
  const totals = {
    revenue: totalsPaise.revenue / 100,
    discounted: totalsPaise.discounted / 100,
    orders: totalsPaise.orders,
  };

  return (
    <RoleGate perm="coupons.edit">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Coupons" }]} />
      <PageHeader
        title="Coupons"
        sub={`${meta?.total ?? rows.length} discount codes`}
        actions={<Link href="/coupons/new" className={button({ variant: "primary" })}><Plus size={15} /> Add Coupon</Link>}
      />

      {/*
        Headline revenue attributable to coupons, so a manager does not have to
        add the column up. Confirmed orders only.
      */}
      {totals.orders > 0 && (
        <div className="mb-[18px] grid gap-3.5 sm:grid-cols-3">
          <Stat label="Revenue from coupons" value={inr(totals.revenue)} tone="#34D399" />
          <Stat label="Discount given" value={`−${inr(totals.discounted)}`} tone="#F59E0B" />
          <Stat label="Confirmed orders" value={String(totals.orders)} tone="#60A5FA" />
        </div>
      )}

      <Card>
        <FilterBar>
          <SearchInput className="min-w-[200px] flex-1" placeholder="Search by code…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            {["All", "Active", "Inactive", "Expired"].map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
          </Select>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto">
            {["All", "Automatic", "Code-based", "Stackable", "Exclusive", "Exhausted"].map((k) => (
              <option key={k} value={k}>{k === "All" ? "All types" : k}</option>
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
          <EmptyState icon={Ticket} title="No coupons match">Adjust the filters or create a new coupon.</EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Discount</Th>
                  <Th>Eligibility</Th>
                  <Th>Stacking</Th>
                  <Th right>Priority</Th>
                  <Th right>Min. Order</Th>
                  <Th>Valid</Th>
                  <Th>Usage</Th>
                  <Th>Applies to</Th>
                  <Th right>Revenue generated</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <span className="mono font-semibold">{c.code}</span>
                      {c.name && <CellSub>{c.name}</CellSub>}
                      {c.automatic && (
                        <CellSub>
                          <span className="rounded bg-grey-wash px-1.5 py-0.5 text-[10px]">automatic</span>
                        </CellSub>
                      )}
                    </Td>
                    <Td>
                      {c.discountLabel ?? (c.type === "Percentage" ? `${c.val}% off` : `${inr(c.val)} off`)}
                    </Td>
                    <Td><span className="text-[12.5px]">{c.eligibilityLabel ?? "All customers"}</span></Td>
                    <Td>
                      <Pill tone={STACKING_TONE[c.stackingMode] ?? "grey"}>
                        {c.stackingLabel ?? "Cannot be combined"}
                      </Pill>
                    </Td>
                    <Td right><span className="mono text-[12.5px]">{c.priority ?? 0}</span></Td>
                    <Td right>{c.min ? <span className="mono">{inr(c.min)}</span> : <span className="text-muted-2">—</span>}</Td>
                    <Td>
                      <div className="text-[12.5px]">{fmtDate(c.startsAt)}</div>
                      <CellSub>to {fmtDate(c.endsAt)}</CellSub>
                    </Td>
                    <Td><span className="mono text-[12.5px]">{c.used}{c.limit ? ` / ${c.limit}` : " / ∞"}</span></Td>
                    <Td>
                      {c.scope === "SPECIFIC_PRODUCTS" ? (
                        <>
                          <div className="text-[12.5px]">{c.products.length} product{c.products.length === 1 ? "" : "s"}</div>
                          <CellSub title={c.products.map((p) => p.name).join(", ")}>
                            {c.products.slice(0, 2).map((p) => p.name).join(", ")}
                            {c.products.length > 2 ? ` +${c.products.length - 2}` : ""}
                          </CellSub>
                        </>
                      ) : (
                        <span className="text-[12.5px] text-muted">All products</span>
                      )}
                    </Td>
                    {/*
                      Revenue counts CONFIRMED orders only — an abandoned or
                      cancelled cart never inflates it.
                    */}
                    <Td right>
                      {c.confirmedOrders > 0 ? (
                        <>
                          <div className="mono text-[13px] font-medium">{inr(c.revenue)}</div>
                          <CellSub>
                            {c.confirmedOrders} order{c.confirmedOrders === 1 ? "" : "s"} · −{inr(c.discounted)} given
                          </CellSub>
                        </>
                      ) : (
                        <span className="text-muted-2">—</span>
                      )}
                    </Td>
                    <Td><Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill></Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/coupons/${c.id}/edit`} className={button({ variant: "ghost", size: "icon-sm" })} title="Edit">
                          <Pencil size={14} />
                        </Link>
                        {permissions.includes("coupons.delete") && (
                          <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => setDel(c)}>
                            <Trash2 size={14} className="text-muted" />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await deleteCoupon(del.id);
            toast.push("Coupon deleted.");
            setDel(null);
            await refetch();
          } catch (err) {
            toast.push(err.message, { bad: true });
          }
        }}
        title="Delete this coupon?"
        confirmLabel="Delete coupon"
        message={del && <>This removes <b className="mono">{del.code}</b> permanently. Customers can no longer redeem it.</>}
      />
    </RoleGate>
  );
}

/** Compact figure tile for the coupon revenue summary. */
function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 shadow-card">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 font-mono text-[22px] font-medium leading-none tracking-[-.02em]" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}
