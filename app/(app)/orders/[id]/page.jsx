"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FileText,
  RotateCcw,
  RefreshCw,
  MapPin,
  Package,
  Mail,
  ArrowRight,
  Ban,
  Tag,
  Save,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { ORDER_STATUS_PILL, PAY_STATUS_PILL } from "@/lib/constants";
import { formatPaise } from "@/lib/api";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Modal, InfoBox, WarnBox } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";
import { AdvanceStatusModal } from "@/components/orders/AdvanceStatusModal";
import { OrderTimeline } from "@/components/orders/OrderTimeline";

export default function OrderDetailPage() {
  const { id } = useParams();
  const permissions = useAuth((s) => s.permissions);
  const getOrder = useData((s) => s.getOrder);
  const refundOrder = useData((s) => s.refundOrder);
  const reconcilePayment = useData((s) => s.reconcilePayment);
  const downloadInvoice = useData((s) => s.downloadInvoice);
  const updateOrderNote = useData((s) => s.updateOrderNote);
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [pageState, setPageState] = useState("loading"); // loading | ready | missing
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmt, setRefundAmt] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const [internalNote, setInternalNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  /*
   * The PDF is generated on demand, so there is a real pause between the click
   * and the browser's download prompt. Tracking it lets the button show a
   * spinner and disable itself; without that the click looks inert and a
   * second one generates the invoice twice.
   *
   * Declared here with the other hooks: this component returns early while
   * loading, so a useState below that point would run conditionally and break
   * the rules of hooks.
   */
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const data = await getOrder(id);
      if (data) {
        setOrder(data);
        setInternalNote(data.internalNote || "");
        setPageState("ready");
      } else {
        setPageState("missing");
      }
    } catch {
      setPageState("missing");
    }
  }, [id, getOrder]);

  useEffect(() => {
    void fetchOrder();
  }, [fetchOrder]);

  if (pageState === "loading") {
    return <div className="py-20 text-center text-[13px] text-muted">Loading order…</div>;
  }

  if (pageState === "missing" || !order) {
    return (
      <div className="py-20 text-center">
        <h1 className="mb-2 text-[17px] font-semibold">Order not found</h1>
        <p className="mb-4 text-[13px] text-muted">No order matching “{id}”.</p>
        <Link href="/orders" className={button({ variant: "dark" })}>
          Back to Orders
        </Link>
      </div>
    );
  }

  const orderNo = order.orderNo || id;
  const items = order.items || [];
  const totals = order.totals || {};
  const emails = order.emails || [];
  const refunds = order.refunds || [];
  const fulfilment = order.fulfilment || {};
  const availableTransitions = order.availableTransitions || [];

  const canRefund = permissions.includes("orders.refund") && order.canRefund;
  const maxRefundRupees = (order.refundableePaise ?? (order.totalPaise || 0)) / 100;

  const openRefundModal = () => {
    setRefundAmt(String(maxRefundRupees));
    setRefundReason("");
    setRefundOpen(true);
  };

  const doRefund = async () => {
    const amt = Number(refundAmt);
    if (!amt || amt <= 0) {
      toast.push("Enter a valid refund amount.", { bad: true });
      return;
    }
    if (amt > maxRefundRupees) {
      toast.push(`Maximum refundable amount is ₹${maxRefundRupees}.`, { bad: true });
      return;
    }
    if (!refundReason.trim()) {
      toast.push("A refund reason is required.", { bad: true });
      return;
    }

    setRefundBusy(true);
    try {
      await refundOrder(orderNo, amt, refundReason.trim());
      toast.push(`Refund of ₹${amt} processed.`);
      setRefundOpen(false);
      await fetchOrder();
    } catch (err) {
      toast.push(err.message || "Failed to process refund.", { bad: true });
    } finally {
      setRefundBusy(false);
    }
  };

  const saveNote = async () => {
    setNoteSaving(true);
    try {
      await updateOrderNote(orderNo, internalNote.trim());
      toast.push("Internal note updated.");
      await fetchOrder();
    } catch (err) {
      toast.push(err.message || "Failed to update note.", { bad: true });
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (downloadingInvoice) return;
    setDownloadingInvoice(true);
    try {
      toast.push("Downloading invoice PDF…");
      const invNum = (fulfilment.invoiceNumber || order.invoiceNumber || orderNo).trim().replace(/[/\\?%*:|"<>]/g, "-");
      const custName = (order.customerName || order.cust || "").trim().replace(/[/\\?%*:|"<>]/g, "");
      const filename = custName ? `${invNum}-${custName}.pdf` : `${invNum}.pdf`;
      await downloadInvoice(orderNo, filename);
    } catch (err) {
      toast.push(err.message || "Failed to download invoice.", { bad: true });
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const handleReconcile = async () => {
    if (reconciling) return;
    setReconciling(true);
    try {
      toast.push("Checking payment status with Razorpay…");
      const res = await reconcilePayment(orderNo);
      if (res.reconciled) {
        toast.push(res.message || "Payment verified and order confirmed!");
        await fetchOrder();
      } else {
        toast.push(res.message || "No captured payment found on Razorpay.", { bad: true });
      }
    } catch (err) {
      toast.push(err.message || "Failed to reconcile payment with Razorpay.", { bad: true });
    } finally {
      setReconciling(false);
    }
  };

  const forwardMoves = availableTransitions.filter((t) => t.to !== "CANCELLED");
  const cancelMove = availableTransitions.find((t) => t.to === "CANCELLED");
  const showReconcile =
    order.paymentMethod === "RAZORPAY" &&
    (order.paymentStatus === "UNPAID" || order.status === "CANCELLED");

  return (
    <RoleGate perm="orders.view">
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Orders", href: "/orders" },
          { label: orderNo },
        ]}
      />
      <PageHeader
        title={<span className="mono">{orderNo}</span>}
        sub={
          order.placedAt
            ? new Date(order.placedAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""
        }
        actions={
          <>
            {showReconcile && (
              <Button
                variant="outline"
                onClick={handleReconcile}
                disabled={reconciling}
                title="Check Razorpay for captured payment and verify/restore order"
              >
                <RefreshCw size={15} className={reconciling ? "animate-spin" : ""} />
                {reconciling ? "Checking Razorpay…" : "Verify with Razorpay"}
              </Button>
            )}
            {forwardMoves.map((m) => (
              <Button key={m.to} variant="primary" onClick={() => setAdvanceTarget(m)}>
                {m.verb || m.label} <ArrowRight size={15} />
              </Button>
            ))}
            {cancelMove && (
              <Button variant="danger" onClick={() => setAdvanceTarget(cancelMove)}>
                <Ban size={15} /> Cancel Order
              </Button>
            )}
            {canRefund && (
              <Button
                variant="danger"
                onClick={openRefundModal}
                title={`Refund up to ₹${maxRefundRupees} to the customer`}
              >
                <RotateCcw size={15} /> Refund
              </Button>
            )}
          </>
        }
      />

      {/*
        Cancelled but still holding the customer's money.

        Cancelling restocks and reverses the coupon, but never moves money —
        that is a separate, irreversible action. Without this banner the only
        signal is a PAID pill next to a CANCELLED pill, which is easy to read
        past, and the customer stays out of pocket for an order that will
        never ship.
      */}
      {order.awaitingRefund && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-[#F5D9D6] bg-red-wash px-4 py-3 text-[12.5px] leading-snug text-red-deep">
          <AlertTriangle size={16} className="shrink-0" />
          <div className="flex-1 min-w-[240px]">
            <strong className="font-semibold">This cancelled order has not been refunded.</strong>{" "}
            The customer was charged {formatPaise(order.totalPaise ?? 0)} and
            {(order.refundedPaise ?? 0) > 0
              ? ` only ${formatPaise(order.refundedPaise)} has been returned.`
              : " nothing has been returned."}{" "}
            Cancelling does not move money — issue the refund here.
          </div>
          {canRefund && (
            <Button variant="danger" size="sm" onClick={openRefundModal}>
              <RotateCcw size={14} /> Refund {formatPaise((order.refundableePaise ?? 0))}
            </Button>
          )}
        </div>
      )}

      {/* lifecycle tracker */}
      <Card className="mb-4">
        <CardBody>
          <OrderTimeline order={order} />
          {availableTransitions.length === 0 && order.status !== "CANCELLED" && (
            <div className="mt-4 border-t border-line-soft pt-3 text-center text-[12.5px] text-muted">
              This order is complete.
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHead>
              <CardTitle>Items Ordered</CardTitle>
              <div className="ml-auto flex gap-2">
                <Pill tone={ORDER_STATUS_PILL[order.statusLabel || order.status] || "grey"}>
                  {order.statusLabel || order.status}
                </Pill>
                <Pill tone={PAY_STATUS_PILL[order.paymentLabel || order.paymentStatus] || "grey"}>
                  {order.paymentLabel || order.paymentStatus}
                </Pill>
              </div>
            </CardHead>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>SKU</Th>
                    <Th right>Qty</Th>
                    <Th right>Price</Th>
                    <Th right>Line Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((l, i) => (
                    <Tr key={l.id || i}>
                      <Td className="font-medium">
                        {l.productName}
                        {l.pack ? <span className="ml-1.5 text-[11.5px] text-muted-2">({l.pack})</span> : null}
                      </Td>
                      <Td>
                        <span className="mono text-[12.5px]">{l.sku}</span>
                      </Td>
                      <Td right>{l.qty}</Td>
                      <Td right>
                        <span className="mono">{formatPaise(l.unitPricePaise ?? l.unitPrice * 100)}</span>
                      </Td>
                      <Td right>
                        <span className="mono font-medium">
                          {formatPaise(l.lineTotalPaise ?? l.lineTotal * 100)}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <CardBody>
              <div className="ml-auto max-w-[240px] space-y-1.5 text-[13px]">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="mono">{formatPaise(totals.subtotalPaise ?? order.subtotalPaise)}</span>
                </div>
                {Boolean(totals.discountPaise) && (
                  <div className="flex justify-between text-teal-deep">
                    <span>Discount</span>
                    <span className="mono">−{formatPaise(totals.discountPaise)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted">
                  <span>Shipping</span>
                  <span className="mono">{formatPaise(totals.shippingPaise ?? order.shippingPaise)}</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>GST Tax</span>
                  <span className="mono">{formatPaise(totals.taxPaise ?? order.taxPaise)}</span>
                </div>
                <div className="flex justify-between border-t border-line-soft pt-1.5 font-semibold">
                  <span>Total</span>
                  <span className="mono">{formatPaise(totals.totalPaise ?? order.totalPaise)}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Coupon Used */}
          {order.couponCode && (
            <Card>
              <CardBody className="flex items-center gap-2.5 text-[13px]">
                <Tag size={16} className="text-teal-deep shrink-0" />
                <span>
                  Coupon applied: <strong className="mono">{order.couponCode}</strong>
                </span>
              </CardBody>
            </Card>
          )}

          {/* Customer Emails card (spec §6.3, §15) */}
          <Card>
            <CardHead>
              <CardTitle>Customer Emails</CardTitle>
              <span className="ml-auto font-mono text-[11px] text-muted-2">
                {emails.length} record{emails.length === 1 ? "" : "s"}
              </span>
            </CardHead>
            {emails.length === 0 ? (
              <CardBody>
                <InfoBox>
                  No email records yet. Emails go out automatically on lifecycle transitions when "Notify customer" is checked.
                </InfoBox>
              </CardBody>
            ) : (
              <CardBody className="space-y-2.5">
                {emails.map((e) => (
                  <div
                    key={e.id || e.subject}
                    className="flex items-start gap-2.5 rounded-md border border-line-soft p-2.5"
                  >
                    <Mail size={15} className="mt-0.5 shrink-0 text-teal-deep" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{e.subject}</div>
                      <div className="mono truncate text-[11.5px] text-muted-2">
                        to {e.toEmail || e.to} · {e.sentAt || e.queuedAt ? new Date(e.sentAt || e.queuedAt).toLocaleString("en-IN") : "Queued"}
                      </div>
                    </div>
                    {e.status && (
                      <Pill tone={e.status === "SENT" || e.status === "DELIVERED" ? "green" : "grey"}>
                        {e.status}
                      </Pill>
                    )}
                  </div>
                ))}
              </CardBody>
            )}
          </Card>

          {/* Refund History */}
          {refunds.length > 0 && (
            <Card>
              <CardHead>
                <CardTitle>Refund History</CardTitle>
                <span className="ml-auto font-mono text-[11px] text-muted-2">
                  Total refunded: {formatPaise(order.refundedPaise)}
                </span>
              </CardHead>
              <CardBody className="space-y-2.5">
                {refunds.map((r) => (
                  <div key={r.id} className="rounded-md border border-line-soft p-3 text-[13px]">
                    <div className="flex items-center justify-between font-medium">
                      <span>Refund: {formatPaise(r.amountPaise)}</span>
                      <span className="mono text-[11.5px] text-muted-2">
                        {new Date(r.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-muted">{r.reason}</div>
                    {r.processedBy && (
                      <div className="mt-1 text-[11.5px] text-muted-2">Processed by: {r.processedBy}</div>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Status & Payment Overview Card */}
          <Card>
            <CardHead>
              <CardTitle>Status & Payment</CardTitle>
            </CardHead>
            <CardBody className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between border-b border-line-soft pb-2">
                <span className="text-muted">Order Status</span>
                <Pill tone={ORDER_STATUS_PILL[order.statusLabel || order.status] || "grey"}>
                  {order.statusLabel || order.status}
                </Pill>
              </div>

              <div className="flex items-center justify-between border-b border-line-soft pb-2">
                <span className="text-muted">Payment Status</span>
                <div className="flex items-center gap-1.5">
                  <Pill tone={PAY_STATUS_PILL[order.paymentLabel || order.paymentStatus] || "grey"}>
                    {order.paymentLabel || order.paymentStatus}
                  </Pill>
                  <span className="text-[11.5px] text-muted-2">
                    ({order.paymentMethod === "COD" ? "COD" : "Online"})
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted">Refund Status</span>
                {order.paymentStatus === "REFUNDED" ? (
                  <Pill tone="green">Refunded</Pill>
                ) : order.paymentStatus === "PARTIALLY_REFUNDED" ? (
                  <Pill tone="amber">Partially Refunded</Pill>
                ) : order.awaitingRefund || (order.status === "CANCELLED" && order.paymentStatus === "PAID") ? (
                  <Pill tone="red">Refund Pending</Pill>
                ) : order.paymentMethod === "COD" && order.status === "CANCELLED" ? (
                  <span className="text-[12px] text-muted-2">No Refund (COD)</span>
                ) : (
                  <span className="text-[12px] text-muted-2">None</span>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHead>
              <CardTitle>Customer</CardTitle>
            </CardHead>
            <CardBody className="space-y-2 text-[13px]">
              <div className="font-medium">{order.customerName || order.cust}</div>
              <Link
                href={`/customers/${order.customerId || encodeURIComponent(order.email)}`}
                className="block text-teal-deep hover:underline"
              >
                {order.email}
              </Link>
              <div className="text-muted">{order.phone}</div>
            </CardBody>
          </Card>

          <Card>
            <CardHead>
              <CardTitle>Delivery Address</CardTitle>
            </CardHead>
            <CardBody>
              <div className="flex gap-2.5 text-[13px] leading-relaxed">
                <MapPin size={16} className="mt-0.5 shrink-0 text-muted-2" />
                {order.addressLine || order.addr}
              </div>
            </CardBody>
          </Card>

          {/* Invoice */}
          <Card>
            <CardHead>
              <CardTitle>Invoice</CardTitle>
            </CardHead>
            <CardBody>
              {fulfilment.invoiceNumber || order.invoiceNumber ? (
                <div className="flex items-center gap-2 text-[13px]">
                  <FileText size={15} className="shrink-0 text-muted-2" />
                  <span className="mono font-medium">{fulfilment.invoiceNumber || order.invoiceNumber}</span>
                  {order.canDownloadInvoice && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={handleDownloadInvoice}
                      disabled={downloadingInvoice}
                      aria-busy={downloadingInvoice}
                      title={`Download invoice ${fulfilment.invoiceNumber || order.invoiceNumber} as PDF`}
                    >
                      {downloadingInvoice ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Download size={15} />
                      )}
                      {downloadingInvoice ? "Preparing…" : "Download PDF"}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px] text-muted">
                  No invoice number yet. One is issued automatically when the order is
                  accepted.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Shipping fulfilment */}
          {(fulfilment.carrier || fulfilment.trackingNumber || order.carrier || order.track) && (
            <Card>
              <CardHead>
                <CardTitle>Shipping</CardTitle>
              </CardHead>
              <CardBody className="space-y-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <Package size={15} className="text-muted-2" />
                  <span>{fulfilment.carrier || order.carrier || "—"}</span>
                </div>
                {(fulfilment.trackingNumber || order.track) && (
                  <div className="mono text-[12.5px]">
                    Tracking: {fulfilment.trackingNumber || order.track}
                  </div>
                )}
                {(fulfilment.trackingUrl || order.trackUrl) && (
                  <a
                    href={fulfilment.trackingUrl || order.trackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[12.5px] text-teal-deep hover:underline"
                  >
                    {fulfilment.trackingUrl || order.trackUrl}
                  </a>
                )}
              </CardBody>
            </Card>
          )}

          {/* Customer note — what the shopper typed at checkout. Read-only. */}
          {order.customerNote && (
            <Card>
              <CardHead>
                <CardTitle>Customer Note</CardTitle>
              </CardHead>
              <CardBody>
                <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
                  {order.customerNote}
                </p>
                <p className="mt-2.5 text-[11px] text-muted-2">
                  Entered by the customer at checkout. Not editable.
                </p>
              </CardBody>
            </Card>
          )}

          {/* Internal Note — staff only, never sent to the customer. */}
          <Card>
            <CardHead>
              <CardTitle>Internal Note</CardTitle>
            </CardHead>
            <CardBody className="space-y-2 text-[13px]">
              <Textarea
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="Staff-only internal note…"
                className="text-[12.5px]"
              />
              <Button size="sm" variant="default" onClick={saveNote} disabled={noteSaving}>
                <Save size={13} /> {noteSaving ? "Saving…" : "Save note"}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      {advanceTarget && (
        <AdvanceStatusModal
          order={order}
          target={advanceTarget}
          onFinished={fetchOrder}
          onClose={() => setAdvanceTarget(null)}
        />
      )}

      {/* refund (spec §6.4, Admin only) */}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title="Process refund"
        sub={orderNo}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundOpen(false)} disabled={refundBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doRefund} disabled={refundBusy}>
              {refundBusy ? "Processing…" : "Confirm Refund"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-2">
          <WarnBox>
            This sends a refund via Razorpay (or records a COD refund) and updates the payment status.
            It is recorded in the audit log.
          </WarnBox>
          <Field
            label="Refund Amount (₹)"
            required
            hint={`Maximum refundable: ₹${maxRefundRupees}`}
          >
            <Input
              type="number"
              step="0.01"
              value={refundAmt}
              onChange={(e) => setRefundAmt(e.target.value)}
              placeholder={String(maxRefundRupees)}
            />
          </Field>
          <Field label="Reason" required>
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Damaged in transit, customer requested refund"
            />
          </Field>
        </div>
      </Modal>
    </RoleGate>
  );
}

