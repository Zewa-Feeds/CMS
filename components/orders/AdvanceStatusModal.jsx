"use client";

import { useState, useEffect } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { useData } from "@/lib/store";
import { STEPS } from "@/lib/orderFlow";
import { Modal, WarnBox } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input, Textarea, Checkbox } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Advances an order one step along its lifecycle. The server-driven transition
 * spec decides which fields are required before the move is allowed and which
 * email goes out afterwards (§6.3, §6.5, §15).
 */
export function AdvanceStatusModal({ order, target, onFinished, onClose }) {
  const transitionOrder = useData((s) => s.transitionOrder);
  const toast = useToast();

  // Handle target as either a transition object or a target string
  const transitionSpec =
    typeof target === "object" && target !== null
      ? target
      : order?.availableTransitions?.find(
          (t) => t.to === target || t.to === target?.toUpperCase()
        ) || STEPS[target];

  const targetCode = transitionSpec?.to || target;
  const verb = transitionSpec?.verb || transitionSpec?.label || `Move to ${targetCode}`;
  const isDanger = targetCode === "CANCELLED" || targetCode === "Cancelled";

  const [vals, setVals] = useState({});
  const [errs, setErrs] = useState({});
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const fieldsList = transitionSpec?.fields || [];
  const emailInfo = transitionSpec?.email || { subject: "Order status update" };

  useEffect(() => {
    const init = {};
    fieldsList.forEach((f) => {
      const existingKey = f.key === "invoiceNumber" ? order?.fulfilment?.invoiceNumber || order?.invoiceNumber : order?.[f.key];
      init[f.key] = existingKey || (f.key === "deliveredOn" ? todayISO() : "");
    });
    setVals(init);
    setErrs({});
  }, [order, transitionSpec]);

  if (!transitionSpec) return null;

  const setField = (k, v) => {
    setVals((s) => ({ ...s, [k]: v }));
    if (errs[k]) setErrs((e) => ({ ...e, [k]: "" }));
  };

  const submit = async () => {
    const e = {};
    fieldsList.forEach((f) => {
      if (f.required && !String(vals[f.key] || "").trim()) {
        e[f.key] = `${f.label} is required to continue.`;
      }
    });

    if (Object.keys(e).length > 0) {
      setErrs(e);
      toast.push("Fill in the required fields first.", { bad: true });
      return;
    }

    setBusy(true);
    try {
      await transitionOrder(order.orderNo || order.no, {
        to: targetCode,
        fields: vals,
        internalNote: note.trim() || undefined,
        notifyCustomer: notify,
      });

      toast.push(
        notify ? `Order moved to ${transitionSpec.label || targetCode}. Customer emailed.` : `Order moved to ${transitionSpec.label || targetCode}.`
      );
      if (onFinished) await onFinished();
      onClose();
    } catch (err) {
      if (err.fields) {
        setErrs(err.fields);
        toast.push(Object.values(err.fields)[0] || "Fix the highlighted fields.", { bad: true });
      } else {
        toast.push(err.message, { bad: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const renderField = (f) => (
    <Field
      key={f.key}
      label={f.label}
      required={f.required}
      hint={f.hint}
      error={errs[f.key]}
    >
      {f.textarea || f.key === "cancelReason" ? (
        <Textarea
          value={vals[f.key] || ""}
          bad={!!errs[f.key]}
          placeholder={f.placeholder}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      ) : (
        <Input
          type={f.type || (f.key === "deliveredOn" ? "date" : "text")}
          value={vals[f.key] || ""}
          bad={!!errs[f.key]}
          placeholder={f.placeholder}
          className={f.mono || f.key === "invoiceNumber" || f.key === "trackingNumber" ? "mono" : ""}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      )}
    </Field>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={verb}
      sub={order.orderNo || order.no}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={submit} disabled={busy}>
            {busy ? "Working…" : verb}
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <div className="mb-4 flex items-center gap-2 text-[12.5px]">
          <Pill tone="grey">{order.statusLabel || order.status}</Pill>
          <ArrowRight size={14} className="text-muted-2" />
          <Pill tone={isDanger ? "red" : "green"}>{transitionSpec.label || targetCode}</Pill>
        </div>

        {isDanger && (
          <div className="mb-4">
            {/*
              When the order is actually paid, name the amount.

              The generic "if it was already paid" wording left the operator to
              work out whether money was involved. Cancelling never refunds, so
              on a paid order this is the last screen before the customer is
              left out of pocket — it should say so in rupees.
            */}
            {order?.paymentStatus === "PAID" || order?.paymentStatus === "PARTIALLY_REFUNDED" ? (
              <WarnBox>
                <strong className="font-semibold">
                  This order is paid — cancelling will NOT refund it.
                </strong>{" "}
                ₹
                {(
                  Math.max(0, (order.totalPaise ?? 0) - (order.refundedPaise ?? 0)) / 100
                ).toLocaleString("en-IN")}{" "}
                will still be held from the customer. Stock is returned and the coupon reversed,
                but you must issue the refund yourself from the order page afterwards.
              </WarnBox>
            ) : (
              <WarnBox>
                Cancelling stops fulfilment for this order. Stock is returned and any coupon
                redemption is reversed.
              </WarnBox>
            )}
          </div>
        )}

        {fieldsList.map((f) => renderField(f))}

        <Field label="Internal note" hint="Saved to the order. Never sent to the customer.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {/* email preview — spec §15 */}
        <div className="rounded-md border border-line-soft bg-canvas p-3">
          <Checkbox
            checked={notify}
            onChange={setNotify}
            label={
              <span>
                <span className="font-medium">Email the customer</span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  {emailInfo.blurb || "Sends automated customer notification"}
                </span>
              </span>
            }
          />
          {notify && (
            <div className="mt-2.5 flex items-start gap-2 border-t border-line-soft pt-2.5 text-[12px]">
              <Mail size={14} className="mt-px shrink-0 text-muted-2" />
              <div className="min-w-0">
                <div className="font-medium">{emailInfo.subject}</div>
                <div className="mono truncate text-[11.5px] text-muted-2">
                  to {order.email}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

