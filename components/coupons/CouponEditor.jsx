"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Package, Pencil } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ProductPicker, SelectedProducts } from "./ProductPicker";

/**
 * Coupon editor (§10.2).
 *
 * Two things beyond the base spec:
 *
 *  - **Scope.** A coupon applies to all products, or to a chosen set. For a
 *    specific-products coupon the discount lands on the ELIGIBLE lines only —
 *    the server computes that, so a 10%-off coupon cannot quietly discount
 *    products it was never meant to cover.
 *  - **Revenue.** Read-only totals from confirmed orders, shown when editing.
 */

const EMPTY = {
  code: "",
  type: "Percentage",
  val: "",
  min: "",
  from: "",
  to: "",
  limit: "",
  perCust: 1,
  isActive: true,
  scope: "ALL_PRODUCTS",
  products: [],
};

/** API record -> form state. */
function toForm(api) {
  if (!api) return EMPTY;
  return {
    code: api.code,
    type: api.type, // "Percentage" | "Flat"
    val: String(api.val ?? ""),
    min: api.min ? String(api.min) : "",
    // <input type="date"> wants YYYY-MM-DD.
    from: api.startsAt ? String(api.startsAt).slice(0, 10) : "",
    to: api.endsAt ? String(api.endsAt).slice(0, 10) : "",
    limit: api.limit == null ? "" : String(api.limit),
    perCust: api.perCust ?? 1,
    isActive: api.isActive ?? true,
    scope: api.scope ?? "ALL_PRODUCTS",
    products: api.products ?? [],
  };
}

export function CouponEditor({ initial }) {
  const router = useRouter();
  const createCoupon = useData((s) => s.createCoupon);
  const updateCoupon = useData((s) => s.updateCoupon);
  const toast = useToast();

  const isNew = !initial;
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // §10.2 — expired coupons cannot be reactivated; the server enforces this too.
  const expired = initial?.status === "Expired";
  const specific = form.scope === "SPECIFIC_PRODUCTS";

  const validate = () => {
    const e = {};
    if (!/^[A-Z0-9][A-Z0-9-]{2,}$/.test(form.code))
      e.code = "At least 3 characters: uppercase letters, numbers and hyphens.";
    if (form.val === "" || Number(form.val) <= 0) e.val = "Enter a discount value.";
    if (form.type === "Percentage" && Number(form.val) > 100)
      e.val = "A percentage discount cannot exceed 100%.";
    if (!form.from) e.from = "Start date is required.";
    if (!form.to) e.to = "End date is required.";
    if (form.from && form.to && new Date(form.to) <= new Date(form.from))
      e.to = "The end date must be after the start date.";
    if (specific && form.products.length === 0)
      e.productIds = "Choose at least one product, or switch to all products.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.push("Fix the highlighted fields.", { bad: true });
      return;
    }

    const payload = {
      code: form.code,
      discountType: form.type === "Percentage" ? "PERCENTAGE" : "FLAT",
      discountValue: Number(form.val),
      minOrder: Number(form.min) || 0,
      // Dates go as ISO; the API treats them as inclusive window bounds.
      startsAt: new Date(`${form.from}T00:00:00`).toISOString(),
      endsAt: new Date(`${form.to}T23:59:59`).toISOString(),
      totalUsageLimit: form.limit === "" ? null : Number(form.limit),
      perCustomerLimit: Number(form.perCust) || 1,
      isActive: Boolean(form.isActive),
      scope: form.scope,
      productIds: specific ? form.products.map((p) => p.id) : [],
    };

    setBusy(true);
    try {
      if (isNew) await createCoupon(payload);
      else await updateCoupon(initial.id, payload);
      toast.push(isNew ? "Coupon created." : "Coupon saved.");
      router.push("/coupons");
    } catch (err) {
      if (err.fields) {
        // Map the API's field keys onto this form's.
        setErrors({
          ...err.fields,
          val: err.fields.discountValue ?? err.fields.val,
          to: err.fields.endsAt ?? err.fields.to,
        });
        toast.push("Fix the highlighted fields.", { bad: true });
      } else {
        toast.push(err.message, { bad: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Coupons", href: "/coupons" },
          { label: isNew ? "Add Coupon" : form.code },
        ]}
      />
      <PageHeader
        title={isNew ? "Add Coupon" : `Edit ${form.code}`}
        actions={
          <Button variant="primary" onClick={save} disabled={expired || busy}>
            <Save size={15} /> {busy ? "Saving…" : isNew ? "Create coupon" : "Save changes"}
          </Button>
        }
      />

      {expired && (
        <div className="mb-4">
          <InfoBox>
            This coupon has expired. Expired coupons can&apos;t be reactivated — create a new one
            instead.
          </InfoBox>
        </div>
      )}

      {/* Revenue attribution — confirmed orders only (§10 extension). */}
      {!isNew && initial?.confirmedOrders > 0 && (
        <Card className="mb-[18px]">
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Revenue generated" value={`₹${initial.revenue.toLocaleString("en-IN")}`} tone="#34D399" />
              <Metric label="Discount given" value={`−₹${initial.discounted.toLocaleString("en-IN")}`} tone="#F59E0B" />
              <Metric label="Confirmed orders" value={String(initial.confirmedOrders)} tone="#60A5FA" />
            </div>
            <p className="mt-3 text-[11.5px] text-muted-2">
              Counts orders that were paid, or accepted for cash on delivery. Cancelled and fully
              refunded orders are excluded.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <fieldset disabled={expired} className="grid gap-x-[18px] md:grid-cols-2">
            <Field
              label="Coupon Code"
              required
              error={errors.code}
              hint="Uppercase, alphanumeric + hyphens."
            >
              <Input
                value={form.code}
                bad={!!errors.code}
                onChange={(e) =>
                  set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })
                }
                className="mono"
                placeholder="MONSOON10"
              />
            </Field>
            <Field label="Discount Type" required>
              <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="Percentage">Percentage % off</option>
                <option value="Flat">Flat ₹ off</option>
              </Select>
            </Field>
            <Field
              label={`Discount Value (${form.type === "Percentage" ? "%" : "₹"})`}
              required
              error={errors.val}
            >
              <Input
                type="number"
                value={form.val}
                bad={!!errors.val}
                onChange={(e) => set({ val: e.target.value })}
              />
            </Field>
            <Field label="Minimum Order Value (₹)" hint="Optional.">
              <Input
                type="number"
                value={form.min}
                onChange={(e) => set({ min: e.target.value })}
              />
            </Field>
            <Field label="Start Date" required error={errors.from}>
              <Input
                type="date"
                value={form.from}
                bad={!!errors.from}
                onChange={(e) => set({ from: e.target.value })}
              />
            </Field>
            <Field label="End Date" required error={errors.to}>
              <Input
                type="date"
                value={form.to}
                bad={!!errors.to}
                onChange={(e) => set({ to: e.target.value })}
              />
            </Field>
            <Field label="Total Usage Limit" hint="Blank means unlimited.">
              <Input
                type="number"
                value={form.limit}
                onChange={(e) => set({ limit: e.target.value })}
              />
            </Field>
            <Field label="Per-Customer Limit">
              <Input
                type="number"
                value={form.perCust}
                onChange={(e) => set({ perCust: e.target.value })}
              />
            </Field>

            {/* ---- Scope ------------------------------------------------- */}
            <div className="md:col-span-2">
              <Field
                label="Applies to"
                required
                error={errors.productIds}
                hint="A product-specific coupon only discounts the eligible items in a cart."
              >
                <Select value={form.scope} onChange={(e) => set({ scope: e.target.value })}>
                  <option value="ALL_PRODUCTS">All products</option>
                  <option value="SPECIFIC_PRODUCTS">Specific products…</option>
                </Select>
              </Field>

              {specific && (
                <div className="mb-4 rounded-lg border border-line bg-canvas p-3.5">
                  <div className="mb-2.5 flex items-center justify-between gap-3">
                    <span className="text-[12.5px] font-medium">
                      {form.products.length} product{form.products.length === 1 ? "" : "s"} selected
                    </span>
                    <Button variant="default" size="sm" onClick={() => setPickerOpen(true)}>
                      {form.products.length === 0 ? (
                        <>
                          <Package size={14} /> Choose products
                        </>
                      ) : (
                        <>
                          <Pencil size={14} /> Change
                        </>
                      )}
                    </Button>
                  </div>
                  <SelectedProducts
                    products={form.products}
                    onRemove={(id) =>
                      set({ products: form.products.filter((p) => p.id !== id) })
                    }
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <Switch
                checked={form.isActive}
                onChange={(v) => set({ isActive: v })}
                label={form.isActive ? "Active" : "Inactive"}
              />
            </div>
          </fieldset>
        </CardBody>
      </Card>

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedIds={form.products.map((p) => p.id)}
        onConfirm={(ids) => {
          // The picker returns ids; look the names back up so the chips render
          // without another fetch.
          const known = new Map(form.products.map((p) => [p.id, p]));
          const catalogue = useData.getState().products.data ?? [];
          set({
            products: ids.map(
              (id) =>
                known.get(id) ??
                (() => {
                  const p = catalogue.find((x) => x.id === id);
                  return { id, name: p?.name ?? id, slug: p?.slug, category: p?.category };
                })(),
            ),
          });
          setPickerOpen(false);
        }}
      />
    </>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div
        className="mt-1 font-mono text-[20px] font-medium leading-none tracking-[-.02em]"
        style={{ color: tone }}
      >
        {value}
      </div>
    </div>
  );
}
