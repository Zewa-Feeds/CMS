"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ShoppingCart,
  ShieldCheck,
  Truck,
  Tag,
  MapPin,
  User,
  Layers,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useData } from "@/lib/store";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { inr } from "@/lib/utils";

const INDIAN_STATES = [
  "All states (Nationwide)",
  "Kerala",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Delhi",
  "Telangana",
  "Gujarat",
  "Uttar Pradesh",
  "West Bengal",
  "Rajasthan",
  "Andhra Pradesh",
  "Punjab",
  "Haryana",
  "Bihar",
  "Madhya Pradesh",
  "Goa",
  "Assam",
  "Odisha",
];

const CUSTOMER_PRESETS = [
  { value: "guest", label: "Guest / First-time buyer (0 orders)", email: "" },
  { value: "returning", label: "Returning customer (2+ orders)", email: "returning.customer@example.com" },
  { value: "specific", label: "Authorized specific customer", email: "" },
  { value: "custom", label: "Custom email address…", email: "" },
];

/**
 * Interactive Promotion Preview & Dry-Run Simulator.
 *
 * Runs the authoritative backend promotion engine against an unsaved or saved
 * promotion configuration without persisting any state or consuming limits.
 */
export function PromotionPreview({ code, payload }) {
  const previewCoupon = useData((s) => s.previewCoupon);
  const loadProducts = useData((s) => s.loadProducts);
  const { data: catalogueProducts, loading: productsLoading } = useData((s) => s.products);

  // Load catalogue on mount so products and variants are available in test cart
  useEffect(() => {
    if (typeof loadProducts === "function") {
      Promise.resolve(loadProducts({ limit: 100 })).catch(() => undefined);
    }
  }, [loadProducts]);

  // Flatten products and variants from catalogue for easy selection
  const variantOptions = useMemo(() => {
    const list = [];
    (catalogueProducts ?? []).forEach((p) => {
      (p.variants ?? []).forEach((v) => {
        list.push({
          sku: v.sku,
          name: p.name,
          pack: v.pack,
          pricePaise: v.pricePaise ?? (v.price ? Math.round(v.price * 100) : 0),
          familyId: p.id,
          variantId: v.id,
          category: p.category,
        });
      });
    });
    return list;
  }, [catalogueProducts]);

  // Test cart lines: [{ sku, name, pack, qty, unitPricePaise }]
  const [cartLines, setCartLines] = useState([
    {
      sku: "F3-45G",
      name: "Slow-Sinking Granules F3",
      pack: "45g Bottle",
      qty: 2,
      unitPricePaise: 18900,
    },
  ]);

  // Selector for adding products to cart
  const [selectedSku, setSelectedSku] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [customSku, setCustomSku] = useState("");

  // Customer context
  const [customerPreset, setCustomerPreset] = useState("guest");
  const [customEmail, setCustomEmail] = useState("");

  // Location and stacking context
  const [deliveryState, setDeliveryState] = useState("All states (Nationwide)");
  const [appliedCodes, setAppliedCodes] = useState("");

  // Evaluation outcome state
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Auto-fill selected SKU when catalogue loads if not set
  useEffect(() => {
    if (!selectedSku && variantOptions.length > 0) {
      setSelectedSku(variantOptions[0].sku);
    }
  }, [selectedSku, variantOptions]);

  // Compute effective customer email
  const effectiveEmail = useMemo(() => {
    if (customerPreset === "returning") return "returning.customer@example.com";
    if (customerPreset === "specific") {
      // If payload specifies customer emails, pick the first one as default
      const list = payload?.customerEmails ?? [];
      return list.length > 0 ? list[0] : (customEmail || "authorized.customer@example.com");
    }
    if (customerPreset === "custom") return customEmail.trim();
    return "";
  }, [customerPreset, customEmail, payload]);

  // Cart modification handlers
  const handleAddLine = () => {
    const skuToAdd = (selectedSku === "CUSTOM" ? customSku.trim() : selectedSku).toUpperCase();
    if (!skuToAdd) return;

    const variant = variantOptions.find((v) => v.sku.toUpperCase() === skuToAdd);
    const existingIndex = cartLines.findIndex((l) => l.sku.toUpperCase() === skuToAdd);

    if (existingIndex >= 0) {
      const updated = [...cartLines];
      updated[existingIndex].qty += Number(selectedQty) || 1;
      setCartLines(updated);
    } else {
      setCartLines([
        ...cartLines,
        {
          sku: skuToAdd,
          name: variant?.name ?? `Item (${skuToAdd})`,
          pack: variant?.pack ?? "Standard",
          qty: Number(selectedQty) || 1,
          unitPricePaise: variant?.pricePaise ?? 25000,
        },
      ]);
    }
    setSelectedQty(1);
  };

  const handleUpdateQty = (sku, newQty) => {
    const qty = Math.max(1, Number(newQty) || 1);
    setCartLines(cartLines.map((l) => (l.sku === sku ? { ...l, qty } : l)));
  };

  const handleRemoveLine = (sku) => {
    setCartLines(cartLines.filter((l) => l.sku !== sku));
  };

  // Run dry-run evaluation against backend
  const runPreview = async () => {
    setError("");
    setResult(null);

    if (cartLines.length === 0) {
      setError("Add at least one product to the test cart.");
      return;
    }

    setBusy(true);
    try {
      const stateParam =
        deliveryState === "All states (Nationwide)" ? undefined : deliveryState;

      const appliedList = appliedCodes
        .split(/[\n,]/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const requestBody = {
        code: code || payload?.code || "PREVIEW",
        coupon: payload ?? undefined,
        lines: cartLines.map((l) => ({ sku: l.sku, qty: l.qty })),
        email: effectiveEmail || undefined,
        state: stateParam,
        applied: appliedList,
      };

      const data = await previewCoupon(requestBody);
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not evaluate promotion preview.");
    } finally {
      setBusy(false);
    }
  };

  // Pre-discount estimated subtotal in cart
  const estimatedSubtotalPaise = cartLines.reduce(
    (sum, l) => sum + l.unitPricePaise * l.qty,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header explanation */}
      <div className="flex items-start gap-3 rounded-lg border border-teal-light/40 bg-teal-wash/30 p-3.5">
        <FlaskConical size={18} className="mt-0.5 shrink-0 text-teal-deep" />
        <div className="text-[13px] leading-relaxed">
          <span className="font-semibold text-ink">Authoritative Engine Preview:</span>{" "}
          Test your unsaved and stored promotion configuration against a simulated cart. The backend
          evaluates dates, product targeting, customer eligibility, location rules, and stacking in real time.
          No usage counts or redemptions are written.
        </div>
      </div>

      {/* Test Cart & Environment Setup */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Test Cart Builder */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ShoppingCart size={16} className="text-muted" /> Test Cart Items
            </h3>
            <span className="text-[12px] text-muted">
              {cartLines.length} item{cartLines.length === 1 ? "" : "s"} in cart
            </span>
          </div>

          {/* Cart items list */}
          <div className="overflow-hidden rounded-lg border border-line bg-card shadow-sm">
            {cartLines.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-muted">
                Your test cart is empty. Add a product below to simulate checkout.
              </div>
            ) : (
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b border-line-soft bg-canvas text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                  <tr>
                    <th className="px-3.5 py-2.5">Product & SKU</th>
                    <th className="px-3.5 py-2.5 text-center">Qty</th>
                    <th className="px-3.5 py-2.5 text-right">Unit Price</th>
                    <th className="px-3.5 py-2.5 text-right">Line Total</th>
                    <th className="w-10 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {cartLines.map((line) => (
                    <tr key={line.sku} className="hover:bg-canvas/50">
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium text-ink">{line.name}</div>
                        <div className="mono text-[11px] text-muted-2">
                          {line.sku} {line.pack && `· ${line.pack}`}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="inline-flex items-center rounded border border-line bg-canvas">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(line.sku, line.qty - 1)}
                            className="px-2 py-0.5 text-muted hover:text-ink disabled:opacity-30"
                            disabled={line.qty <= 1}
                          >
                            −
                          </button>
                          <span className="mono w-6 text-center text-[12px] font-medium">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(line.sku, line.qty + 1)}
                            className="px-2 py-0.5 text-muted hover:text-ink"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="mono px-3.5 py-2.5 text-right text-muted">
                        {inr(line.unitPricePaise / 100)}
                      </td>
                      <td className="mono px-3.5 py-2.5 text-right font-medium text-ink">
                        {inr((line.unitPricePaise * line.qty) / 100)}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.sku)}
                          aria-label={`Remove ${line.sku}`}
                          className="grid h-6 w-6 place-items-center rounded text-muted-2 hover:bg-red-wash hover:text-red-deep"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-canvas/40">
                  <tr>
                    <td colSpan={3} className="px-3.5 py-2.5 font-medium text-muted">
                      Estimated Subtotal
                    </td>
                    <td className="mono px-3.5 py-2.5 text-right text-[13.5px] font-bold text-ink">
                      {inr(estimatedSubtotalPaise / 100)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Add product to cart controls */}
            <div className="border-t border-line-soft bg-canvas/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[200px] flex-1">
                  <Select
                    value={selectedSku}
                    onChange={(e) => setSelectedSku(e.target.value)}
                    className="text-[12.5px]"
                  >
                    {variantOptions.map((v) => (
                      <option key={v.sku} value={v.sku}>
                        {v.name} — {v.pack} ({inr(v.pricePaise / 100)}) [{v.sku}]
                      </option>
                    ))}
                    <option value="CUSTOM">+ Custom SKU…</option>
                  </Select>
                </div>

                {selectedSku === "CUSTOM" && (
                  <div className="w-32">
                    <Input
                      placeholder="e.g. G2-100G"
                      value={customSku}
                      onChange={(e) => setCustomSku(e.target.value)}
                      className="mono text-[12px]"
                    />
                  </div>
                )}

                <div className="w-20">
                  <Input
                    type="number"
                    min={1}
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(e.target.value)}
                    className="text-center text-[12.5px]"
                    placeholder="Qty"
                  />
                </div>

                <Button variant="default" size="sm" onClick={handleAddLine}>
                  <Plus size={14} /> Add Item
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Checkout Simulation Context */}
        <div className="space-y-4 lg:col-span-5">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <User size={16} className="text-muted" /> Shopper & Checkout Context
          </h3>

          <div className="rounded-lg border border-line bg-card p-4 shadow-sm space-y-4">
            <Field label="Customer profile" hint="Simulate customer order history eligibility.">
              <Select
                value={customerPreset}
                onChange={(e) => setCustomerPreset(e.target.value)}
                className="text-[13px]"
              >
                {CUSTOMER_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>

            {(customerPreset === "custom" || customerPreset === "specific") && (
              <Field
                label="Customer email"
                hint={
                  customerPreset === "specific"
                    ? "Checked against specific authorized customer list."
                    : "Email for order history lookup."
                }
              >
                <Input
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="text-[13px]"
                />
              </Field>
            )}

            <Field label="Delivery destination" hint="Simulate state location restrictions.">
              <Select
                value={deliveryState}
                onChange={(e) => setDeliveryState(e.target.value)}
                className="text-[13px]"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Other applied coupon codes"
              hint="Comma separated. Test stacking & priority conflicts."
            >
              <Input
                value={appliedCodes}
                onChange={(e) => setAppliedCodes(e.target.value)}
                className="mono uppercase text-[12.5px]"
                placeholder="e.g. WELCOME10, FIRSTORDER"
              />
            </Field>

            <Button
              variant="primary"
              className="w-full justify-center py-2.5 text-[13.5px] font-semibold"
              onClick={runPreview}
              disabled={busy || cartLines.length === 0}
            >
              <FlaskConical size={16} /> {busy ? "Evaluating Engine…" : "Run Promotion Test"}
            </Button>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-lg border border-red/40 bg-red-wash px-4 py-3 text-[13px] text-red-deep">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview Evaluation Results */}
      {result && (
        <div className="space-y-6 rounded-xl border border-line bg-card p-5 shadow-card">
          {/* Top Overall Result Banner */}
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 ${
              result.eligible
                ? "border-green/30 bg-green-wash text-green-deep"
                : "border-red/30 bg-red-wash text-red-deep"
            }`}
          >
            <div className="flex items-center gap-3">
              {result.eligible ? (
                <CheckCircle2 size={24} className="shrink-0 text-green" />
              ) : (
                <XCircle size={24} className="shrink-0 text-red-deep" />
              )}
              <div>
                <div className="text-[15px] font-semibold">
                  {result.eligible
                    ? `Promotion Applied: ${result.discountLabel ?? "Discount Active"}`
                    : "Promotion Was Not Applied"}
                </div>
                <div className="text-[12.5px] opacity-90">
                  {result.eligible
                    ? `Saved ${inr(result.discountPaise / 100)} on this order${
                        result.freeShipping ? " + Free Shipping" : ""
                      }`
                    : result.reason}
                </div>
              </div>
            </div>

            {result.eligible ? (
              <div className="text-right">
                <span className="mono text-[20px] font-bold">
                  −{inr(result.discountPaise / 100)}
                </span>
                {result.freeShipping && (
                  <div className="text-[11.5px] font-medium">Free Shipping included</div>
                )}
              </div>
            ) : (
              result.reasonCode && (
                <Pill tone="red" className="mono text-[11px]">
                  {result.reasonCode}
                </Pill>
              )
            )}
          </div>

          {/* Rule Evaluation Checklist (§ Requirement 7) */}
          {result.evaluationChecks && result.evaluationChecks.length > 0 && (
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <ShieldCheck size={16} className="text-teal-deep" /> Promotion Evaluation Reasons
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {result.evaluationChecks.map((check) => (
                  <div
                    key={check.key}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px] transition-colors ${
                      check.passed
                        ? "border-green/20 bg-green-wash/40 text-ink"
                        : "border-red/20 bg-red-wash/40 text-ink"
                    }`}
                  >
                    {check.passed ? (
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green" />
                    ) : (
                      <XCircle size={16} className="mt-0.5 shrink-0 text-red-deep" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{check.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted">{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cart Line-by-Line Breakdown Table (§ Requirement 6) */}
          {result.cart?.lines && result.cart.lines.length > 0 && (
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Tag size={16} className="text-teal-deep" /> Line-by-Line Product Impact
              </h4>
              <div className="overflow-hidden rounded-lg border border-line bg-canvas/30">
                <table className="w-full text-left text-[12.5px]">
                  <thead className="border-b border-line-soft bg-canvas text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                    <tr>
                      <th className="px-3.5 py-2.5">Product & SKU</th>
                      <th className="px-3.5 py-2.5 text-center">Qty</th>
                      <th className="px-3.5 py-2.5 text-right">Line Total</th>
                      <th className="px-3.5 py-2.5">Targeting Effect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {result.cart.lines.map((line) => (
                      <tr key={line.sku} className="hover:bg-canvas">
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-ink">{line.name}</div>
                          <div className="mono text-[11px] text-muted-2">
                            {line.sku} {line.pack && `· ${line.pack}`}
                          </div>
                        </td>
                        <td className="mono px-3.5 py-2.5 text-center text-muted">{line.qty}</td>
                        <td className="mono px-3.5 py-2.5 text-right font-medium text-ink">
                          {inr(line.lineTotalPaise / 100)}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {line.isDiscounted ? (
                            <Pill tone="green">Discounted</Pill>
                          ) : line.isExcluded ? (
                            <Pill tone="grey" title={line.excludeReason ?? "Excluded"}>
                              ✕ Excluded by rule
                            </Pill>
                          ) : line.isQualifying ? (
                            <Pill tone="blue">Qualifying item</Pill>
                          ) : (
                            <span className="text-muted-2">Standard price</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pricing & Cart Outcome Summary */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Stacking Breakdown */}
            <div className="rounded-lg border border-line bg-canvas/40 p-4">
              <h4 className="flex items-center gap-2 text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                <Layers size={15} /> Promotions On Cart
              </h4>
              {result.stack?.length > 0 ? (
                <ul className="mt-3 divide-y divide-line-soft">
                  {result.stack.map((s) => (
                    <li
                      key={s.code}
                      className="flex items-center justify-between py-2 text-[12.5px]"
                    >
                      <div>
                        <span className="mono font-bold text-ink">{s.code}</span>
                        <span className="ml-2 text-muted">{s.discountLabel}</span>
                        {s.automatic && (
                          <span className="ml-2 rounded bg-grey-wash px-1.5 py-0.5 text-[10.5px] font-medium text-muted">
                            automatic
                          </span>
                        )}
                      </div>
                      <span className="mono font-semibold text-green">
                        −{inr(s.discountPaise / 100)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[12.5px] text-muted">
                  No active promotions applied to this cart.
                </p>
              )}

              {result.otherRejections?.length > 0 && (
                <div className="mt-3 border-t border-line-soft pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                    Other Codes Refused
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {result.otherRejections.map((r) => (
                      <li key={r.code} className="text-[12px] text-red-deep">
                        <span className="mono font-semibold">{r.code}</span>: {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Cart Totals Breakdown */}
            <div className="rounded-lg border border-line bg-canvas/40 p-4">
              <h4 className="text-[12.5px] font-semibold uppercase tracking-wider text-muted">
                Final Cart Outcome
              </h4>
              <dl className="mt-3 space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal (pre-discount)</dt>
                  <dd className="mono font-medium text-ink">
                    {inr((result.cart?.subtotalPaise ?? 0) / 100)}
                  </dd>
                </div>
                <div className="flex justify-between text-green">
                  <dt>Total Promotional Discounts</dt>
                  <dd className="mono font-bold">
                    −{inr((result.cart?.discountPaise ?? 0) / 100)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Estimated Shipping</dt>
                  <dd className="mono font-medium text-ink">
                    {result.cart?.shippingPaise === 0 || result.freeShipping
                      ? "FREE"
                      : inr((result.cart?.shippingPaise ?? 0) / 100)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Estimated Tax (GST)</dt>
                  <dd className="mono font-medium text-ink">
                    {inr((result.cart?.taxPaise ?? 0) / 100)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2.5 text-[15px] font-bold text-ink">
                  <dt>Final Total Payable</dt>
                  <dd className="mono text-teal-deep">
                    {inr((result.cart?.totalPaise ?? 0) / 100)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
