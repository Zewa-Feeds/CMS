"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Megaphone, Eye, Pencil, Power, PowerOff } from "lucide-react";
import { influencers as api } from "@/lib/api";
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

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export default function InfluencersPage() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  /** The influencer whose activation is being confirmed. */
  const [pending, setPending] = useState(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list({
        q: q.trim() || undefined,
        status: status === "All" ? undefined : status,
        limit: 100,
      });
      setRows(res.data ?? []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  // First load must not wait on the debounce; only later edits are delayed.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      void refetch();
      return;
    }
    const t = setTimeout(() => void refetch(), 250);
    return () => clearTimeout(t);
  }, [refetch]);

  const toggle = async () => {
    if (!pending) return;
    const goingOff = pending.status === "ACTIVE";
    try {
      await (goingOff ? api.deactivate(pending.id) : api.activate(pending.id));
      toast.success(
        goingOff
          ? `${pending.name} deactivated. Their past orders and figures are unchanged.`
          : `${pending.name} reactivated.`,
      );
      setPending(null);
      void refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Influencers" }]} />
      <PageHeader
        title="Influencers"
        subtitle={`${rows.length} affiliate${rows.length === 1 ? "" : "s"}`}
        actions={
          <RoleGate permission="coupons.edit">
            <Link href="/influencers/new" className={button({ variant: "primary" })}>
              <Plus size={15} /> Add influencer
            </Link>
          </RoleGate>
        }
      />

      <Card>
        <FilterBar>
          <SearchInput value={q} onChange={setQ} placeholder="Search name, code or handle…" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </FilterBar>

        {error ? (
          <EmptyState icon={Megaphone} title="Could not load influencers">{error}</EmptyState>
        ) : loading ? (
          <EmptyState icon={Megaphone} title="Loading…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Megaphone} title="No influencers yet">
            Create one to generate their personal coupon code and start attributing sales.
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Influencer</Th>
                  <Th>Code</Th>
                  <Th>Discount</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Successful</Th>
                  <Th className="text-right">Net revenue</Th>
                  <Th>Created</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Link href={`/influencers/${r.id}`} className="font-semibold hover:underline">
                        {r.name}
                      </Link>
                      {r.socialHandle && <CellSub>{r.socialHandle}</CellSub>}
                    </Td>
                    <Td className="mono">{r.coupon?.code ?? "—"}</Td>
                    <Td>
                      {r.coupon
                        ? r.coupon.discountType === "PERCENTAGE"
                          ? `${r.coupon.discountValue}%`
                          : inr(r.coupon.discountValue)
                        : "—"}
                    </Td>
                    <Td>
                      <Pill tone={r.status === "ACTIVE" ? "green" : "grey"}>
                        {r.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Pill>
                    </Td>
                    <Td className="text-right tabular-nums">{r.totalOrders}</Td>
                    <Td className="text-right tabular-nums">{r.successfulOrders}</Td>
                    <Td className="text-right tabular-nums font-semibold">{inr(r.netRevenue)}</Td>
                    <Td>{fmtDate(r.createdAt)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Link
                          href={`/influencers/${r.id}`}
                          className={button({ variant: "ghost", size: "icon-sm" })}
                          aria-label={`View ${r.name}`}
                        >
                          <Eye size={14} />
                        </Link>
                        <RoleGate permission="coupons.edit">
                          <Link
                            href={`/influencers/${r.id}?edit=1`}
                            className={button({ variant: "ghost", size: "icon-sm" })}
                            aria-label={`Edit ${r.name}`}
                          >
                            <Pencil size={14} />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPending(r)}
                            aria-label={`${r.status === "ACTIVE" ? "Deactivate" : "Activate"} ${r.name}`}
                          >
                            {r.status === "ACTIVE" ? <PowerOff size={14} /> : <Power size={14} />}
                          </Button>
                        </RoleGate>
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
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={toggle}
        title={pending?.status === "ACTIVE" ? "Deactivate influencer?" : "Reactivate influencer?"}
        confirmLabel={pending?.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
        danger={pending?.status === "ACTIVE"}
        message={
          pending?.status === "ACTIVE"
            ? `${pending?.name}'s code ${pending?.coupon?.code ?? ""} stops working immediately. Nothing is deleted — every order already attributed to them, and all of their reporting, stays exactly as it is.`
            : `${pending?.name}'s code ${pending?.coupon?.code ?? ""} starts working again for new orders.`
        }
      />
    </>
  );
}
