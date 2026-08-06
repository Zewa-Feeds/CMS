"use client";

import { useCallback, useEffect, useState, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Download, Eye, ClipboardList } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { ORDER_STATUS_PILL, PAY_STATUS_PILL } from "@/lib/constants";
import { inr } from "@/lib/utils";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import {
  TableWrap,
  Table,
  Th,
  Td,
  Tr,
  CellSub,
  EmptyState,
  Pager,
} from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

const PER_PAGE = 6;

/** ISO -> "24 Jul 2026, 09:14". */
function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** CMS label -> the enum the API expects. */
const STATUS_ENUM = {
  Pending: "PENDING",
  Processing: "PROCESSING",
  Shipped: "SHIPPED",
  Delivered: "DELIVERED",
  Cancelled: "CANCELLED",
};
const PAY_ENUM = {
  Paid: "PAID",
  Unpaid: "UNPAID",
  Refunded: "REFUNDED",
  "Partially Refunded": "PARTIALLY_REFUNDED",
};

function OrdersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const permissions = useAuth((s) => s.permissions);
  const { data, meta, loading, error } = useData((s) => s.orders);
  const loadOrders = useData((s) => s.loadOrders);
  const exportOrdersCsv = useData((s) => s.exportOrdersCsv);
  const toast = useToast();

  const [q, setQ] = useState("");
  const [pay, setPay] = useState("All");
  const [page, setPage] = useState(1);

  // The URL owns the status filter so the sidebar's Pending/Shipped links work
  // on client-side navigation (this component does not remount between them).
  const status = params.get("status") || "All";
  const setStatus = (next) => {
    const qs = new URLSearchParams(params.toString());
    if (next === "All") qs.delete("status");
    else qs.set("status", next);
    const s = qs.toString();
    router.replace(s ? `/orders?${s}` : "/orders", { scroll: false });
  };

  // Reset to page 1 whenever a filter changes.
  useEffect(() => setPage(1), [status, pay, q]);

  /**
   * Filtering and pagination are SERVER-side (§6.1). Filtering here would only
   * cover the current page and would disagree with the dashboard's counters.
   */
  const refetch = useCallback(() => {
    const query = {
      page,
      limit: PER_PAGE,
      q: q.trim() || undefined,
      status: status === "All" ? undefined : STATUS_ENUM[status] ?? status,
      paymentStatus: pay === "All" ? undefined : PAY_ENUM[pay] ?? pay,
    };
    return loadOrders(query).catch(() => undefined);
  }, [loadOrders, page, q, status, pay]);

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
  const pages = meta?.pages ?? 1;

  return (
    <RoleGate perm="orders.view">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Orders" }]} />
      <PageHeader
        title="Orders"
        sub={`${meta?.total ?? rows.length} orders`}
        actions={
          permissions.includes("orders.export") && (
            <Button
              variant="default"
              onClick={async () => {
                try {
                  // Exports the CURRENT filter set, not just the visible page.
                  await exportOrdersCsv({
                    q: q.trim() || undefined,
                    status: status === "All" ? undefined : STATUS_ENUM[status] ?? status,
                    paymentStatus: pay === "All" ? undefined : PAY_ENUM[pay] ?? pay,
                  });
                  toast.push("Orders exported.");
                } catch (err) {
                  toast.push(err.message, { bad: true });
                }
              }}
            >
              <Download size={15} /> Export CSV
            </Button>
          )
        }
      />

      <Card>
        <FilterBar>
          <SearchInput
            className="min-w-[220px] flex-1"
            placeholder="Search order #, customer, or email…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            {["All", "Pending", "Processing", "Shipped", "Delivered", "Cancelled"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
            ))}
          </Select>
          <Select value={pay} onChange={(e) => { setPay(e.target.value); setPage(1); }} className="w-auto">
            {["All", "Paid", "Unpaid", "Refunded"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All payments" : s}</option>
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
          <EmptyState icon={ClipboardList} title="No orders match">Adjust the filters above.</EmptyState>
        ) : (
          <>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th>Items</Th>
                    <Th right>Total</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                    <Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <Tr key={o.orderNo} clickable>
                      <Td>
                        <Link
                          href={`/orders/${o.orderNo}`}
                          className="font-mono text-[12.5px] font-medium hover:underline"
                        >
                          {o.orderNo}
                        </Link>
                        <CellSub>{fmtDateTime(o.placedAt)}</CellSub>
                      </Td>
                      <Td>
                        <div className="font-medium">{o.customerName}</div>
                        <CellSub>{o.email}</CellSub>
                      </Td>
                      <Td>
                        {/* §6.1 — hover shows the full item list. */}
                        <span
                          title={(o.itemSummary ?? []).join("\n")}
                          className="cursor-help underline decoration-dotted underline-offset-2"
                        >
                          {o.itemCount} {o.itemCount === 1 ? "item" : "items"}
                        </span>
                      </Td>
                      <Td right>
                        <span className="mono font-medium">{inr(o.total)}</span>
                      </Td>
                      <Td>
                        <Pill tone={PAY_STATUS_PILL[o.paymentLabel]}>{o.paymentLabel}</Pill>
                        <CellSub>
                          <span className="mono">{o.razorpayPaymentId ?? o.paymentMethod}</span>
                        </CellSub>
                      </Td>
                      <Td>
                        <Pill tone={ORDER_STATUS_PILL[o.statusLabel]}>{o.statusLabel}</Pill>
                      </Td>
                      <Td right>
                        <Link
                          href={`/orders/${o.orderNo}`}
                          className={button({ variant: "ghost", size: "icon-sm" })}
                          title="View"
                        >
                          <Eye size={14} />
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <Pager page={page} pages={pages} total={meta?.total ?? rows.length} onPage={setPage} unit="orders" />
          </>
        )}
      </Card>
    </RoleGate>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersInner />
    </Suspense>
  );
}
