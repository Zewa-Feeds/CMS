"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Package, Pencil, Sparkles } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Switch, RadioGroup, Textarea } from "@/components/ui/Field";
import { Tabs } from "@/components/ui/Tabs";
import { InfoBox, WarnBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ProductPicker, SelectedProducts } from "./ProductPicker";
import { PromotionPreview } from "./PromotionPreview";

/**
 * Promotion editor (§10.2, extended).
 *
 * Ten sections is too many for one scrolling form, so they are grouped into
 * tabs — the same pattern ProductEditor uses, including the field→tab map that
 * sends a validation failure to the tab holding the offending field. "Fix the
 * highlighted fields" is useless when the highlighted field is on a tab you are
 * not looking at.
 *
 * Nothing here decides eligibility or discount. The form edits configuration;
 * the backend evaluates it. The Preview tab proves that by running the real
 * engine rather than reimplementing it.
 */

const TABS = [
  { key: "basics", label: "Basics" },
  { key: "discount", label: "Discount" },
  { key: "eligibility", label: "Eligibility" },
  { key: "products", label: "Products" },
  { key: "limits", label: "Limits & schedule" },
  { key: "stacking", label: "Stacking" },
  { key: "preview", label: "Preview" },
];

const TAB_LABELS = Object.fromEntries(TABS.map((t) => [t.key, t.label]));

/** Which tab each field lives on, so an error can navigate to it. */
const FIELD_TAB = {
  code: "basics",
  name: "basics",
  description: "basics",
  val: "discount",
  discountValue: "discount",
  maxDiscount: "discount",
  bxgy: "discount",
  customerEmails: "eligibility",
  firstNOrders: "eligibility",
  productIds: "products",
  minQty: "limits",
  maxQty: "limits",
  from: "limits",
  to: "limits",
  endsAt: "limits",
  limit: "limits",
  perCust: "limits",
  priority: "stacking",
};

/**
 * How a coupon behaves when the customer already has another one applied.
 *
 * The copy names REAL codes rather than describing the rule in the abstract:
 * whoever picks one of these is deciding whether two discounts can land on the
 * same order, and "combines with other stackable coupons" does not make that
 * consequence visible. Each option therefore answers the same three questions —
 * what happens, what it is for, and what it costs you.
 */
/** Two discounts applied in series: 15% then 10% is 23.5% off, not 25%. */
const combinedPct = (a, b) => {
  const x = Number(a) || 0;
  return Math.round((1 - (1 - x / 100) * (1 - b / 100)) * 1000) / 10;
};

const STACKING_OPTIONS = [
  {
    value: "NON_STACKABLE",
    label: "On its own — one discount per order",
    hint: "The safe choice, and the right one for almost every percentage discount. If the customer already has another code applied, they are told the two cannot be combined and asked to remove one. Nothing silently adds up.",
  },
  {
    value: "STACKABLE",
    label: "Adds on top of other stackable coupons",
    hint: "This discount and any other stackable one BOTH apply, and the savings add together. A 15% code beside SPECIAL10's 10% takes roughly 24% off, not 15%. Choose this only when you mean to give away both.",
  },
  {
    value: "EXCLUSIVE",
    label: "Blocks everything else",
    hint: "Applies alone, and wins when the engine has to pick between offers. Stronger than 'on its own': that one loses to a code already on the cart, this one takes precedence. For your single best offer — BENS12 uses it.",
  },
  {
    value: "GLOBALLY_STACKABLE",
    label: "Always applies, alongside anything",
    hint: "Ignores every restriction above — it rides along even beside an exclusive coupon. Only ever use it for a perk that is NOT money off the cart, such as free shipping (ZEWA1). A percentage set this way would stack on top of every other discount, which is the one thing this mode is designed to make impossible. Two of these can never combine with each other.",
  },
];

const ELIGIBILITY_OPTIONS = [
  { value: "ALL_CUSTOMERS", label: "All customers" },
  { value: "FIRST_ORDER", label: "First order only" },
  { value: "FIRST_N_ORDERS", label: "First N orders" },
  { value: "EXISTING_CUSTOMER", label: "Returning customers only" },
  { value: "SPECIFIC_CUSTOMERS", label: "Specific customers" },
];

const EMPTY = {
  code: "",
  name: "",
  description: "",
  type: "Percentage",
  val: "",
  maxDiscount: "",
  min: "",
  from: "",
  to: "",
  limit: "",
  perCust: 1,
  isActive: true,
  scope: "ALL_PRODUCTS",
  products: [],
  qualifyingProducts: [],
  excludedProducts: [],
  stackingMode: "NON_STACKABLE",
  priority: 0,
  trigger: "CODE",
  combinesWithAutomatic: true,
  showAtCheckout: false,
  customerEligibility: "ALL_CUSTOMERS",
  firstNOrders: 2,
  minQty: "",
  maxQty: "",
  allowedStates: "",
  requireAllQualifiers: false,
  customerEmails: "",
  bxgyBuy: 2,
  bxgyGet: 1,
  bxgyPercent: 100,
  bxgyMaxRepeats: "",
};

/** API record -> form state. */
function toForm(api) {
  if (!api) return EMPTY;
  return {
    ...EMPTY,
    code: api.code,
    name: api.name ?? "",
    description: api.description ?? "",
    type:
      api.discountType === "FREE_SHIPPING"
        ? "FreeShipping"
        : api.discountType === "BUY_X_GET_Y"
          ? "Bxgy"
          : api.type,
    val: String(api.val ?? ""),
    maxDiscount: api.maxDiscount == null ? "" : String(api.maxDiscount),
    min: api.min ? String(api.min) : "",
    from: api.startsAt ? String(api.startsAt).slice(0, 10) : "",
    to: api.endsAt ? String(api.endsAt).slice(0, 10) : "",
    limit: api.limit == null ? "" : String(api.limit),
    perCust: api.perCust ?? 1,
    isActive: api.isActive ?? true,
    scope: api.scope ?? "ALL_PRODUCTS",
    products: api.products ?? [],
    qualifyingProducts: api.qualifyingProducts ?? [],
    excludedProducts: api.excludedProducts ?? [],
    stackingMode: api.stackingMode ?? "NON_STACKABLE",
    priority: api.priority ?? 0,
    trigger: api.trigger ?? "CODE",
    combinesWithAutomatic: api.combinesWithAutomatic ?? true,
    showAtCheckout: api.showAtCheckout ?? false,
    customerEligibility: api.customerEligibility ?? "ALL_CUSTOMERS",
    firstNOrders: api.firstNOrders ?? 2,
    minQty: api.minQty == null ? "" : String(api.minQty),
    maxQty: api.maxQty == null ? "" : String(api.maxQty),
    allowedStates: (api.allowedStates ?? []).join(", "),
    requireAllQualifiers: api.requireAllQualifiers ?? false,
    customerEmails: (api.customerEmails ?? []).join("\n"),
    bxgyBuy: api.bxgy?.buyQty ?? 2,
    bxgyGet: api.bxgy?.getQty ?? 1,
    bxgyPercent: api.bxgy?.rewardPercentOff ?? 100,
    bxgyMaxRepeats: api.bxgy?.maxRepeats == null ? "" : String(api.bxgy.maxRepeats),
  };
}

const splitList = (s) =>
  String(s || "")
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function CouponEditor({ initial }) {
  const router = useRouter();
  const createCoupon = useData((s) => s.createCoupon);
  const updateCoupon = useData((s) => s.updateCoupon);
  const toast = useToast();

  const isNew = !initial;
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("basics");
  const [picker, setPicker] = useState(null); // "discount" | "qualify" | "exclude"

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const expired = initial?.status === "Expired";
  const specific = form.scope === "SPECIFIC_PRODUCTS";
  const isPercentage = form.type === "Percentage";
  const isFreeShipping = form.type === "FreeShipping";
  const isBxgy = form.type === "Bxgy";
  const isAutomatic = form.trigger === "AUTOMATIC";

  const payload = useMemo(() => {
    const discountType = isFreeShipping
      ? "FREE_SHIPPING"
      : isBxgy
        ? "BUY_X_GET_Y"
        : isPercentage
          ? "PERCENTAGE"
          : "FLAT";

    return {
      code: form.code,
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      discountType,
      // Free shipping and BXGY carry no monetary value of their own; the API
      // still requires a positive number, so send 1 rather than inventing a
      // meaning for 0.
      discountValue: isFreeShipping || isBxgy ? 1 : Number(form.val),
      maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
      minOrder: Number(form.min) || 0,
      startsAt: form.from ? new Date(`${form.from}T00:00:00`).toISOString() : undefined,
      endsAt: form.to ? new Date(`${form.to}T23:59:59`).toISOString() : undefined,
      totalUsageLimit: form.limit === "" ? null : Number(form.limit),
      perCustomerLimit: Number(form.perCust) || 1,
      isActive: Boolean(form.isActive),
      scope: form.scope,
      productIds: specific ? form.products.map((p) => p.id) : [],
      qualifyingProductIds: specific ? form.qualifyingProducts.map((p) => p.id) : [],
      excludedProductIds: form.excludedProducts.map((p) => p.id),
      stackingMode: form.stackingMode,
      priority: Number(form.priority) || 0,
      trigger: form.trigger,
      combinesWithAutomatic: Boolean(form.combinesWithAutomatic),
      showAtCheckout: Boolean(form.showAtCheckout),
      customerEligibility: form.customerEligibility,
      firstNOrders:
        form.customerEligibility === "FIRST_N_ORDERS" ? Number(form.firstNOrders) || 1 : null,
      minQty: form.minQty === "" ? null : Number(form.minQty),
      maxQty: form.maxQty === "" ? null : Number(form.maxQty),
      allowedStates: splitList(form.allowedStates),
      requireAllQualifiers: Boolean(form.requireAllQualifiers),
      customerEmails:
        form.customerEligibility === "SPECIFIC_CUSTOMERS" ? splitList(form.customerEmails) : [],
      bxgy: isBxgy
        ? {
            buyQty: Number(form.bxgyBuy) || 1,
            getQty: Number(form.bxgyGet) || 1,
            rewardPercentOff: Number(form.bxgyPercent) || 100,
            maxRepeats: form.bxgyMaxRepeats === "" ? null : Number(form.bxgyMaxRepeats),
          }
        : null,
    };
  }, [form, isBxgy, isFreeShipping, isPercentage, specific]);

  /**
   * A plain-language description of what is about to be saved.
   *
   * The server produces the authoritative one (`summary` on the record); this is
   * the live preview while editing, before anything has been saved.
   */
  const summary = useMemo(() => {
    const parts = [];
    if (isFreeShipping) parts.push("Free shipping");
    else if (isBxgy)
      parts.push(
        Number(form.bxgyPercent) >= 100
          ? `Buy ${form.bxgyBuy} get ${form.bxgyGet} free`
          : `Buy ${form.bxgyBuy} get ${form.bxgyGet} at ${form.bxgyPercent}% off`
      );
    else if (isPercentage)
      parts.push(`${form.val || 0}% off${form.maxDiscount ? `, up to ₹${form.maxDiscount}` : ""}`);
    else parts.push(`₹${form.val || 0} off`);

    if (specific && form.products.length) parts.push(`on ${form.products.length} product(s)`);
    if (specific && form.qualifyingProducts.length)
      parts.push(
        `when the cart contains ${form.requireAllQualifiers ? "all of" : "any of"} ${form.qualifyingProducts.length} product(s)`
      );
    if (form.excludedProducts.length)
      parts.push(`excluding ${form.excludedProducts.length} product(s)`);

    if (form.customerEligibility === "FIRST_ORDER") parts.push("on a customer's first order");
    if (form.customerEligibility === "FIRST_N_ORDERS")
      parts.push(`for a customer's first ${form.firstNOrders} orders`);
    if (form.customerEligibility === "EXISTING_CUSTOMER") parts.push("for returning customers");
    if (form.customerEligibility === "SPECIFIC_CUSTOMERS")
      parts.push(`for ${splitList(form.customerEmails).length} named customer(s)`);

    if (Number(form.min) > 0) parts.push(`when the cart is at least ₹${form.min}`);
    if (form.minQty) parts.push(`with ${form.minQty} or more qualifying items`);
    if (splitList(form.allowedStates).length)
      parts.push(`for delivery to ${splitList(form.allowedStates).join(", ")}`);

    parts.push(isAutomatic ? "applied automatically" : `with code ${form.code || "…"}`);

    if (form.stackingMode === "EXCLUSIVE") parts.push("exclusive of all other offers");
    else if (form.stackingMode === "NON_STACKABLE") parts.push("not combinable");
    else if (form.stackingMode === "GLOBALLY_STACKABLE") parts.push("always combinable");
    else parts.push("combinable with other stackable offers");

    if (form.to) parts.push(`valid until ${form.to}`);

    const s = parts.join(", ");
    return s.charAt(0).toUpperCase() + s.slice(1) + ".";
  }, [form, isAutomatic, isBxgy, isFreeShipping, isPercentage, specific]);

  const validate = () => {
    const e = {};
    if (!/^[A-Z0-9][A-Z0-9-]{2,}$/.test(form.code))
      e.code = "At least 3 characters: uppercase letters, numbers and hyphens.";
    if (!isFreeShipping && !isBxgy) {
      if (form.val === "" || Number(form.val) <= 0) e.val = "Enter a discount value.";
      if (isPercentage && Number(form.val) > 100) e.val = "A percentage discount cannot exceed 100%.";
    }
    if (!form.from) e.from = "Start date is required.";
    if (!form.to) e.to = "End date is required.";
    if (form.from && form.to && new Date(form.to) <= new Date(form.from))
      e.to = "The end date must be after the start date.";
    if (specific && form.products.length === 0)
      e.productIds = "Choose at least one product, or switch to all products.";
    if (form.customerEligibility === "SPECIFIC_CUSTOMERS" && splitList(form.customerEmails).length === 0)
      e.customerEmails = "Add at least one customer email.";
    if (form.customerEligibility === "FIRST_N_ORDERS" && Number(form.firstNOrders) < 1)
      e.firstNOrders = "Enter how many orders the offer covers.";
    if (form.minQty && form.maxQty && Number(form.minQty) > Number(form.maxQty))
      e.maxQty = "Maximum quantity must be at least the minimum.";

    setErrors(e);
    // Send the operator to the tab holding the first problem.
    const first = Object.keys(e)[0];
    if (first && FIELD_TAB[first] && FIELD_TAB[first] !== tab) setTab(FIELD_TAB[first]);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.push("Fix the highlighted fields.", { bad: true });
      return;
    }
    setBusy(true);
    try {
      if (isNew) await createCoupon(payload);
      else await updateCoupon(initial.id, payload);
      toast.push(isNew ? "Promotion created." : "Promotion saved.");
      router.push("/coupons");
    } catch (err) {
      if (err.fields) {
        const mapped = {
          ...err.fields,
          val: err.fields.discountValue ?? err.fields.val,
          to: err.fields.endsAt ?? err.fields.to,
        };
        setErrors(mapped);
        const first = Object.keys(mapped).find((k) => mapped[k]);
        if (first && FIELD_TAB[first]) setTab(FIELD_TAB[first]);
        toast.push("Fix the highlighted fields.", { bad: true });
      } else {
        toast.push(err.message, { bad: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const pickerTarget = {
    discount: form.products,
    qualify: form.qualifyingProducts,
    exclude: form.excludedProducts,
  }[picker] ?? [];

  return (
    <>
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Coupons", href: "/coupons" },
          { label: isNew ? "Add promotion" : form.code },
        ]}
      />
      <PageHeader
        title={isNew ? "Add promotion" : `Edit ${form.code}`}
        actions={
          <Button variant="primary" onClick={save} disabled={expired || busy}>
            <Save size={15} /> {busy ? "Saving…" : isNew ? "Create promotion" : "Save changes"}
          </Button>
        }
      />

      {expired && (
        <div className="mb-4">
          <InfoBox>
            This promotion has expired. Expired promotions can&apos;t be reactivated — create a new
            one instead.
          </InfoBox>
        </div>
      )}

      {/* Promotion summary — what this will actually do, in one sentence. */}
      <Card className="mb-[18px]">
        <CardBody>
          <div className="flex items-start gap-2.5">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-teal-deep" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Promotion summary
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed">{summary}</p>
            </div>
          </div>
        </CardBody>
      </Card>

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

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <Card>
        <CardBody>
          <fieldset disabled={expired}>
            {/* ---- 1. Basics -------------------------------------------- */}
            {tab === "basics" && (
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field label="Coupon code" required error={errors.code} hint="Uppercase, alphanumeric + hyphens.">
                  <Input
                    value={form.code}
                    bad={!!errors.code}
                    onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") })}
                    className="mono"
                    placeholder="MONSOON10"
                  />
                </Field>
                <Field label="Internal name" hint="For your team. Never shown to customers.">
                  <Input
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    placeholder="Monsoon 2026 winback"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Description" hint="Why this promotion exists, for whoever inherits it.">
                    <Textarea
                      value={form.description}
                      onChange={(e) => set({ description: e.target.value })}
                      rows={2}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field
                    label="How is it applied?"
                    hint="An automatic promotion needs no code — it applies to every eligible cart."
                  >
                    <RadioGroup
                      name="trigger"
                      value={form.trigger}
                      onChange={(v) => set({ trigger: v })}
                      options={[
                        { value: "CODE", label: "Customer enters a coupon code", hint: `Shoppers type ${form.code || "the code"} at checkout.` },
                        { value: "AUTOMATIC", label: "Applied automatically", hint: "Applies on its own to every eligible cart. The code cannot be typed." },
                      ]}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label={form.isActive ? "Active" : "Inactive"} />
                </div>
              </div>
            )}

            {/* ---- 2. Discount ------------------------------------------ */}
            {tab === "discount" && (
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field label="Discount type" required>
                  <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                    <option value="Percentage">Percentage % off</option>
                    <option value="Flat">Flat ₹ off</option>
                    <option value="FreeShipping">Free shipping</option>
                    <option value="Bxgy">Buy X get Y</option>
                  </Select>
                </Field>

                {!isFreeShipping && !isBxgy && (
                  <Field label={`Discount value (${isPercentage ? "%" : "₹"})`} required error={errors.val}>
                    <Input type="number" value={form.val} bad={!!errors.val} onChange={(e) => set({ val: e.target.value })} />
                  </Field>
                )}

                {isPercentage && (
                  <Field label="Maximum discount (₹)" hint="Optional ceiling. Blank means uncapped.">
                    <Input type="number" value={form.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} />
                  </Field>
                )}

                {isFreeShipping && (
                  <div className="md:col-span-2">
                    <InfoBox>
                      Waives the shipping charge for an eligible cart. The weight-based shipping
                      calculation and the store-wide free-shipping threshold are unchanged — this
                      only zeroes what they produced.
                    </InfoBox>
                  </div>
                )}

                {isBxgy && (
                  <>
                    <Field label="Buy quantity" required hint="Units of the qualifying products.">
                      <Input type="number" min={1} value={form.bxgyBuy} onChange={(e) => set({ bxgyBuy: e.target.value })} />
                    </Field>
                    <Field label="Get quantity" required hint="Reward units earned per batch.">
                      <Input type="number" min={1} value={form.bxgyGet} onChange={(e) => set({ bxgyGet: e.target.value })} />
                    </Field>
                    <Field label="Reward discount (%)" hint="100 means the reward units are free.">
                      <Input type="number" min={1} max={100} value={form.bxgyPercent} onChange={(e) => set({ bxgyPercent: e.target.value })} />
                    </Field>
                    <Field label="Maximum repeats" hint="Blank means it repeats as often as the cart allows.">
                      <Input type="number" min={1} value={form.bxgyMaxRepeats} onChange={(e) => set({ bxgyMaxRepeats: e.target.value })} />
                    </Field>
                    <div className="md:col-span-2">
                      <InfoBox>
                        The cheapest eligible units are the ones given away. Set the qualifying
                        products on the Products tab; leave them empty to qualify on any product.
                      </InfoBox>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ---- 3. Eligibility --------------------------------------- */}
            {tab === "eligibility" && (
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Who can use this?" required>
                    <Select
                      value={form.customerEligibility}
                      onChange={(e) => set({ customerEligibility: e.target.value })}
                    >
                      {ELIGIBILITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {form.customerEligibility === "FIRST_N_ORDERS" && (
                  <Field
                    label="Number of orders"
                    required
                    error={errors.firstNOrders}
                    hint="Covers a customer's first N completed orders."
                  >
                    <Input type="number" min={1} value={form.firstNOrders} bad={!!errors.firstNOrders} onChange={(e) => set({ firstNOrders: e.target.value })} />
                  </Field>
                )}

                {form.customerEligibility === "SPECIFIC_CUSTOMERS" && (
                  <div className="md:col-span-2">
                    <Field
                      label="Customer emails"
                      required
                      error={errors.customerEmails}
                      hint="One per line, or comma separated."
                    >
                      <Textarea
                        rows={5}
                        value={form.customerEmails}
                        bad={!!errors.customerEmails}
                        onChange={(e) => set({ customerEmails: e.target.value })}
                        placeholder={"someone@example.com\nanother@example.com"}
                      />
                    </Field>
                  </div>
                )}

                {(form.customerEligibility === "FIRST_ORDER" ||
                  form.customerEligibility === "FIRST_N_ORDERS") && (
                  <div className="md:col-span-2">
                    <InfoBox>
                      An order counts once it is paid, or accepted for cash on delivery. Abandoned
                      carts, unpaid online orders and cancelled orders never count — so a customer
                      cannot repeatedly qualify as a first-time buyer.
                    </InfoBox>
                  </div>
                )}

                <div className="md:col-span-2">
                  <Field label="Delivery states" hint="Comma separated. Blank means everywhere.">
                    <Input
                      value={form.allowedStates}
                      onChange={(e) => set({ allowedStates: e.target.value })}
                      placeholder="Kerala, Tamil Nadu"
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* ---- 4. Products ------------------------------------------ */}
            {tab === "products" && (
              <div className="grid gap-x-[18px]">
                <Field
                  htmlFor="coupon-scope"
                  label="Discount applies to"
                  required
                  error={errors.productIds}
                  hint={
                    specific
                      ? "A product-specific promotion only discounts the eligible items in a cart."
                      : "Applies to every product in the cart unless excluded below."
                  }
                >
                  <Select id="coupon-scope" value={form.scope} onChange={(e) => set({ scope: e.target.value })}>
                    <option value="ALL_PRODUCTS">All products</option>
                    <option value="SPECIFIC_PRODUCTS">Specific products…</option>
                  </Select>
                </Field>

                {specific && (
                  <>
                    <PickerBlock
                      label="Discounted products"
                      products={form.products}
                      onOpen={() => setPicker("discount")}
                      onRemove={(id) => set({ products: form.products.filter((p) => p.id !== id) })}
                      emptyWarning="No products selected — choose at least one product."
                    />

                    <div className="mt-2">
                      <Field
                        label="Qualifying products"
                        hint="Must be in the cart for the promotion to apply. These are NOT discounted unless they are also in the discounted list."
                      >
                        <PickerBlock
                          products={form.qualifyingProducts}
                          onOpen={() => setPicker("qualify")}
                          onRemove={(id) =>
                            set({ qualifyingProducts: form.qualifyingProducts.filter((p) => p.id !== id) })
                          }
                        />
                      </Field>
                      {form.qualifyingProducts.length > 1 && (
                        <Field label="Qualifying rule">
                          <RadioGroup
                            name="requireAll"
                            value={form.requireAllQualifiers ? "all" : "any"}
                            onChange={(v) => set({ requireAllQualifiers: v === "all" })}
                            options={[
                              { value: "any", label: "Any one of these products", hint: "Buy A or B." },
                              { value: "all", label: "All of these products", hint: "Buy A and B together." },
                            ]}
                          />
                        </Field>
                      )}
                    </div>
                  </>
                )}

                <div className="mt-2">
                  <Field label="Excluded products" hint="Never discounted, even if a broader rule selects them.">
                    <PickerBlock
                      products={form.excludedProducts}
                      onOpen={() => setPicker("exclude")}
                      onRemove={(id) =>
                        set({ excludedProducts: form.excludedProducts.filter((p) => p.id !== id) })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* ---- 5. Limits & schedule --------------------------------- */}
            {tab === "limits" && (
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field label="Minimum order value (₹)" hint="Checked against the cart before any discount.">
                  <Input type="number" value={form.min} onChange={(e) => set({ min: e.target.value })} />
                </Field>
                <Field label="Minimum quantity" error={errors.minQty} hint="Units of the qualifying products.">
                  <Input type="number" value={form.minQty} onChange={(e) => set({ minQty: e.target.value })} />
                </Field>
                <Field label="Maximum quantity" error={errors.maxQty}>
                  <Input type="number" value={form.maxQty} bad={!!errors.maxQty} onChange={(e) => set({ maxQty: e.target.value })} />
                </Field>
                <Field label="Total usage limit" hint="Blank means unlimited.">
                  <Input type="number" value={form.limit} onChange={(e) => set({ limit: e.target.value })} />
                </Field>
                <Field label="Per-customer limit">
                  <Input type="number" value={form.perCust} onChange={(e) => set({ perCust: e.target.value })} />
                </Field>
                <Field label="Start date" required error={errors.from}>
                  <Input type="date" value={form.from} bad={!!errors.from} onChange={(e) => set({ from: e.target.value })} />
                </Field>
                <Field label="End date" required error={errors.to}>
                  <Input type="date" value={form.to} bad={!!errors.to} onChange={(e) => set({ to: e.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <InfoBox>
                    A usage is handed back if the order is cancelled or fully refunded, so an
                    abandoned checkout does not permanently consume a slot.
                  </InfoBox>
                </div>
              </div>
            )}

            {/* ---- 6. Stacking ------------------------------------------ */}
            {tab === "stacking" && (
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <div className="md:col-span-2">
                  {/* The question first, in the words of the decision being made.
                      "Coupon stacking" is the field's name, not what it asks. */}
                  <Field
                    label="If the customer already has another coupon applied…"
                    required
                    hint="The server decides this on every quote and again at checkout, so a customer cannot get two discounts by editing the page."
                  >
                    <RadioGroup
                      name="stackingMode"
                      value={form.stackingMode}
                      onChange={(v) => set({ stackingMode: v })}
                      options={STACKING_OPTIONS}
                    />
                  </Field>
                </div>

                {/*
                  A warning only where one is warranted. Both remaining modes let
                  a second discount land on the same order, and that is the
                  mistake worth catching before it ships — not after a customer
                  has been given 24% off.
                */}
                {form.stackingMode === "STACKABLE" && form.discountType === "PERCENTAGE" && (
                  <div className="md:col-span-2 mb-[15px]">
                    <WarnBox>
                      This is a percentage discount that adds to other stackable coupons. A
                      customer using it with SPECIAL10 gets both — about{" "}
                      <strong>{combinedPct(form.discountValue, 10)}% off</strong> rather than{" "}
                      {Number(form.discountValue) || 0}%. Pick &ldquo;on its own&rdquo; if that is
                      not what you mean.
                    </WarnBox>
                  </div>
                )}
                {form.stackingMode === "GLOBALLY_STACKABLE" && form.discountType !== "FREE_SHIPPING" && (
                  <div className="md:col-span-2 mb-[15px]">
                    <WarnBox>
                      &ldquo;Always applies&rdquo; is meant for free shipping, not for money off
                      the cart. This coupon would apply on top of{" "}
                      <strong>every other discount</strong>, including exclusive ones, with nothing
                      able to stop it.
                    </WarnBox>
                  </div>
                )}

                <Field
                  label="Priority"
                  error={errors.priority}
                  hint="Lower wins when several automatic promotions are eligible. Ties break on code A→Z."
                >
                  <Input type="number" min={0} value={form.priority} onChange={(e) => set({ priority: e.target.value })} />
                </Field>

                {form.stackingMode === "STACKABLE" && (
                  <div className="md:col-span-2">
                    <Switch
                      checked={form.combinesWithAutomatic}
                      onChange={(v) => set({ combinesWithAutomatic: v })}
                      label="May combine with automatic promotions"
                    />
                  </div>
                )}

                {/* Publishing a code is a deliberate act: a private referral or
                    an influencer's personal code must never be advertised by
                    accident, so this is off unless someone turns it on. */}
                <div className="md:col-span-2">
                  <Switch
                    checked={form.showAtCheckout}
                    onChange={(v) => set({ showAtCheckout: v })}
                    label="Show this code to shoppers at checkout"
                  />
                  <p className="mt-1 text-[12px] text-muted">
                    Lists the code in the storefront&rsquo;s &ldquo;available offers&rdquo; panel.
                    Leave off for private, referral or influencer codes.
                  </p>
                </div>
              </div>
            )}

            {/* ---- 7. Preview ------------------------------------------- */}
            {tab === "preview" && (
              <PromotionPreview code={form.code} payload={payload} />
            )}
          </fieldset>
        </CardBody>
      </Card>

      <ProductPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        selectedIds={pickerTarget.map((p) => p.id)}
        onConfirm={(ids) => {
          const known = new Map(pickerTarget.map((p) => [p.id, p]));
          const catalogue = useData.getState().products.data ?? [];
          const resolved = ids.map(
            (id) =>
              known.get(id) ??
              (() => {
                const p = catalogue.find((x) => x.id === id);
                return { id, name: p?.name ?? id, slug: p?.slug, category: p?.category };
              })()
          );
          if (picker === "discount") set({ products: resolved });
          if (picker === "qualify") set({ qualifyingProducts: resolved });
          if (picker === "exclude") set({ excludedProducts: resolved });
          setPicker(null);
        }}
      />
    </>
  );
}

function PickerBlock({ label, products, onOpen, onRemove, emptyWarning }) {
  return (
    <div className="mb-4 rounded-lg border border-line bg-canvas p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-medium">
          {label ? `${label}: ` : ""}
          {products.length} product{products.length === 1 ? "" : "s"} selected
        </span>
        <Button variant="default" size="sm" onClick={onOpen}>
          {products.length === 0 ? (
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
      <SelectedProducts products={products} onRemove={onRemove} emptyWarning={emptyWarning} />
    </div>
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
