"use client";

import { useState } from "react";
import { FlaskConical, Check, X } from "lucide-react";
import { useData } from "@/lib/store";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { InfoBox } from "@/components/ui/Modal";
import { inr } from "@/lib/utils";

/**
 * Test a promotion against a hypothetical cart.
 *
 * Answers "why is this not applying?" without anyone having to place a real
 * order to find out. It calls the backend preview endpoint, which runs the SAME
 * engine checkout runs — a reimplementation here would drift and start lying,
 * which is worse than having no preview at all.
 *
 * READ-ONLY. The endpoint prices but never writes: usage counts, redemptions and
 * revenue totals are only touched inside the checkout transaction, which a
 * preview never enters. Running this a hundred times changes nothing.
 */
export function PromotionPreview({ code, disabled }) {
  const previewCoupon = useData((s) => s.previewCoupon);
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [applied, setApplied] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError("");
    setResult(null);
    if (!sku.trim()) {
      setError("Enter at least one SKU to test against.");
      return;
    }
    setBusy(true);
    try {
      const data = await previewCoupon({
        code,
        lines: sku
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => ({ sku: s, qty: Number(qty) || 1 })),
        email: email.trim() || undefined,
        state: state.trim() || undefined,
        applied: applied
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      });
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not run the preview.");
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <InfoBox>
        Save the promotion first — the preview runs against the stored configuration, so there is
        nothing to test until it exists.
      </InfoBox>
    );
  }

  return (
    <div>
      <p className="mb-4 max-w-[62ch] text-[13px] text-muted">
        Runs the real promotion engine against a cart you describe. Nothing is saved and no usage
        is consumed.
      </p>

      <div className="grid gap-x-[18px] md:grid-cols-2">
        <Field label="SKUs" required hint="Comma separated, e.g. F3-45G, G2-1KG.">
          <Input value={sku} onChange={(e) => setSku(e.target.value)} className="mono" placeholder="F3-45G" />
        </Field>
        <Field label="Quantity per SKU">
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Customer email" hint="Order history and per-customer limits are read for this address.">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
        </Field>
        <Field label="Delivery state" hint="For location-restricted promotions.">
          <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Kerala" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Other coupons already applied" hint="Comma separated. Use this to test stacking.">
            <Input value={applied} onChange={(e) => setApplied(e.target.value)} className="mono" />
          </Field>
        </div>
      </div>

      <Button variant="primary" onClick={run} disabled={busy}>
        <FlaskConical size={15} /> {busy ? "Testing…" : "Test promotion"}
      </Button>

      {error && <p className="mt-3 text-[12.5px] text-red-deep">{error}</p>}

      {result && (
        <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
          <div className="mb-3 flex items-center gap-2">
            {result.eligible ? (
              <>
                <Check size={16} className="text-green" />
                <span className="text-[14px] font-semibold text-green">Eligible</span>
              </>
            ) : (
              <>
                <X size={16} className="text-red-deep" />
                <span className="text-[14px] font-semibold text-red-deep">Not eligible</span>
              </>
            )}
          </div>

          {!result.eligible && (
            <p className="mb-3 text-[13px]">
              {result.reason}
              {result.reasonCode && (
                <span className="ml-2 font-mono text-[11px] text-muted-2">{result.reasonCode}</span>
              )}
            </p>
          )}

          {result.eligible && (
            <dl className="mb-3 grid gap-2 text-[13px] sm:grid-cols-2">
              <Row label="Discount from this promotion" value={inr(result.discountPaise / 100)} />
              <Row label="Label" value={result.discountLabel ?? "—"} />
              <Row
                label="Applies to"
                value={result.appliedTo?.length ? result.appliedTo.join(", ") : "Whole cart"}
              />
              <Row label="Free shipping" value={result.freeShipping ? "Yes" : "No"} />
            </dl>
          )}

          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Cart totals
            </div>
            <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
              <Row label="Subtotal" value={inr(result.cart.subtotalPaise / 100)} />
              <Row label="Total discount" value={`−${inr(result.cart.discountPaise / 100)}`} />
              <Row label="Shipping" value={inr(result.cart.shippingPaise / 100)} />
              <Row label="Total payable" value={inr(result.cart.totalPaise / 100)} />
            </dl>
          </div>

          {result.stack?.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Promotions on this cart
              </div>
              <ul className="flex flex-col gap-1.5">
                {result.stack.map((s) => (
                  <li key={s.code} className="flex items-center justify-between text-[12.5px]">
                    <span>
                      <span className="mono font-semibold">{s.code}</span>
                      <span className="ml-2 text-muted">{s.discountLabel}</span>
                      {s.automatic && (
                        <span className="ml-2 rounded bg-grey-wash px-1.5 py-0.5 text-[10px] text-muted">
                          automatic
                        </span>
                      )}
                    </span>
                    <span className="mono">−{inr(s.discountPaise / 100)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.otherRejections?.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Other codes refused
              </div>
              <ul className="flex flex-col gap-1">
                {result.otherRejections.map((r) => (
                  <li key={r.code} className="text-[12.5px] text-muted">
                    <span className="mono">{r.code}</span> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="mono font-medium">{value}</dd>
    </div>
  );
}
