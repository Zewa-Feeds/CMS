"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Ban, ShieldCheck, MapPin, Star } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { ORDER_STATUS_PILL, PAY_STATUS_PILL, REVIEW_STATE_PILL } from "@/lib/constants";
import { formatPaise } from "@/lib/api";
import { initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

export default function CustomerProfilePage() {
  const { id } = useParams();
  const permissions = useAuth((s) => s.permissions);
  const getCustomer = useData((s) => s.getCustomer);
  const setCustomerStatus = useData((s) => s.setCustomerStatus);
  const toast = useToast();

  const [cust, setCust] = useState(null);
  const [pageState, setPageState] = useState("loading"); // loading | ready | missing
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchCustomer = useCallback(async () => {
    try {
      const data = await getCustomer(id);
      if (data) {
        setCust(data);
        setPageState("ready");
      } else {
        setPageState("missing");
      }
    } catch {
      setPageState("missing");
    }
  }, [id, getCustomer]);

  useEffect(() => {
    void fetchCustomer();
  }, [fetchCustomer]);

  if (pageState === "loading") {
    return <div className="py-20 text-center text-[13px] text-muted">Loading customer profile…</div>;
  }

  if (pageState === "missing" || !cust) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-[17px] font-semibold">Customer not found</h1>
        <p className="mb-4 text-[13px] text-muted">No customer profile matching that ID.</p>
        <Link href="/customers" className={button({ variant: "dark" })}>
          Back to Customers
        </Link>
      </div>
    );
  }

  const banned = cust.status === "BANNED" || cust.status === "Banned";
  const canBan = permissions.includes("customers.ban");

  const toggleBan = async () => {
    const nextStatus = banned ? "ACTIVE" : "BANNED";
    setBusy(true);
    try {
      await setCustomerStatus(cust.id, nextStatus);
      toast.push(`${cust.name} ${banned ? "reactivated" : "banned"}.`);
      setConfirm(false);
      await fetchCustomer();
    } catch (err) {
      toast.push(err.message || "Failed to update customer status.", { bad: true });
    } finally {
      setBusy(false);
    }
  };

  const orderHistory = cust.orderHistory || [];
  const addresses = cust.addresses || [];
  const reviews = cust.reviews || [];

  return (
    <RoleGate perm="customers.view">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Customers", href: "/customers" },
          { label: cust.name },
        ]}
      />
      <PageHeader
        title={cust.name}
        sub={cust.email}
        actions={
          canBan &&
          (banned ? (
            <Button variant="primary" onClick={() => setConfirm(true)}>
              <ShieldCheck size={15} /> Unban customer
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              <Ban size={15} /> Ban customer
            </Button>
          ))
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.8fr]">
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-navy text-[15px] font-semibold text-teal">
                  {initials(cust.name)}
                </span>
                <div>
                  <div className="font-semibold">{cust.name}</div>
                  <Pill tone={banned ? "red" : "green"}>
                    {cust.statusLabel || cust.status}
                  </Pill>
                </div>
              </div>
              <dl className="space-y-2.5 text-[13px]">
                {[
                  ["Email", cust.email],
                  ["Phone", cust.phone || "—"],
                  [
                    "Registered",
                    cust.registeredAt
                      ? new Date(cust.registeredAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—",
                  ],
                  ["Email Verified", cust.emailVerified ? "Yes" : "No"],
                  ["Total orders", cust.orderCount ?? cust.orders ?? 0],
                  [
                    "Lifetime spend (paid orders)",
                    formatPaise(cust.spentPaise ?? (cust.spent ? cust.spent * 100 : 0)),
                  ],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-line-soft pb-2.5 last:border-b-0 last:pb-0"
                  >
                    <dt className="text-muted">{k}</dt>
                    <dd className="mono font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHead>
              <CardTitle>Saved Addresses</CardTitle>
            </CardHead>
            <CardBody>
              {addresses.length === 0 ? (
                <p className="text-[12.5px] text-muted">No saved addresses.</p>
              ) : (
                <div className="space-y-2.5">
                  {addresses.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-md border border-line-soft p-3 text-[12.5px] leading-relaxed"
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-muted-2" />
                          {a.name || cust.name}
                        </span>
                        {a.isDefault && <Pill tone="teal">Default</Pill>}
                      </div>
                      <div className="mt-1 text-muted">
                        {[a.line1, a.line2, a.city, a.state, a.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      {a.phone && <div className="mt-0.5 mono text-[11.5px]">{a.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Reviews */}
          {reviews.length > 0 && (
            <Card>
              <CardHead>
                <CardTitle>Submitted Reviews</CardTitle>
              </CardHead>
              <CardBody className="space-y-2.5">
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-md border border-line-soft p-3 text-[12.5px]">
                    <div className="flex items-center justify-between font-medium">
                      <span>{r.product}</span>
                      <Pill tone={REVIEW_STATE_PILL[r.state] || "grey"}>{r.state}</Pill>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-amber-deep">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          fill={i < r.rating ? "currentColor" : "none"}
                          className={i < r.rating ? "" : "text-muted-2"}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 text-muted">{r.excerpt}</div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        <Card>
          <CardHead>
            <CardTitle>Order History</CardTitle>
          </CardHead>
          {orderHistory.length === 0 ? (
            <EmptyState title="No orders yet">This customer hasn't placed an order.</EmptyState>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Order</Th>
                    <Th right>Items</Th>
                    <Th right>Total</Th>
                    <Th>Payment</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map((o) => (
                    <Tr key={o.orderNo} clickable>
                      <Td>
                        <Link
                          href={`/orders/${o.orderNo}`}
                          className="font-mono text-[12.5px] font-medium hover:underline"
                        >
                          {o.orderNo}
                        </Link>
                        <CellSub>
                          {o.placedAt
                            ? new Date(o.placedAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : ""}
                        </CellSub>
                      </Td>
                      <Td right>
                        <span className="mono">{o.itemCount}</span>
                      </Td>
                      <Td right>
                        <span className="mono font-medium">
                          {formatPaise(o.totalPaise ?? (o.total ? o.total * 100 : 0))}
                        </span>
                      </Td>
                      <Td>
                        <Pill tone={PAY_STATUS_PILL[o.paymentLabel || o.paymentStatus] || "grey"}>
                          {o.paymentLabel || o.paymentStatus}
                        </Pill>
                      </Td>
                      <Td>
                        <Pill tone={ORDER_STATUS_PILL[o.statusLabel || o.status] || "grey"}>
                          {o.statusLabel || o.status}
                        </Pill>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={toggleBan}
        danger={!banned}
        title={banned ? "Reactivate this customer?" : "Ban this customer?"}
        confirmLabel={banned ? "Unban" : busy ? "Working…" : "Ban customer"}
        message={
          banned
            ? `${cust.name} will be able to place orders and sign in again.`
            : `${cust.name} will be blocked from placing orders and signing in. Order history is preserved.`
        }
      />
    </RoleGate>
  );
}

