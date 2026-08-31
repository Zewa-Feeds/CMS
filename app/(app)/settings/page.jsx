"use client";

import { useEffect, useState } from "react";
import { Save, Truck, Percent, Megaphone, Wrench } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Field, Input, Textarea, Switch } from "@/components/ui/Field";
import { RichText } from "@/components/ui/RichText";
import { WarnBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { RoleGate } from "@/components/shell/RoleGate";

import { INDIAN_STATES } from "@/lib/constants";

/** Editor defaults, so a missing settings row still renders every field. */
const EMPTY = {
  shipping: {
    keralaRatePerKg: 45,
    outsideKeralaRatePerKg: 70,
    packagingWeightGrams: 100,
    slabWeightGrams: 500,
    freeThreshold: 999,
    standardRate: 60,
    deliveryText: "3–5 business days across India",
    pinBlacklist: "",
  },
  tax: { gstRate: 0, gstInclusive: true, gstin: "" },
  announcement: { text: "", linkLabel: "", linkUrl: "/", bg: "#080C18", fg: "#44E5C2", active: false },
  maintenance: { on: false, message: "", endAt: "" },
};

/**
 * API shape -> form shape.
 *
 * The API stores money in PAISE and the PIN blacklist as an ARRAY. The form uses
 * rupees and a comma-separated string, because that is what the inputs are.
 */
function toForm(api) {
  if (!api) return EMPTY;

  return {
    shipping: {
      keralaRatePerKg: (api.shipping?.keralaRatePerKgPaise ?? 4500) / 100,
      outsideKeralaRatePerKg: (api.shipping?.outsideKeralaRatePerKgPaise ?? 7000) / 100,
      packagingWeightGrams: api.shipping?.packagingWeightGrams ?? 100,
      slabWeightGrams: api.shipping?.slabWeightGrams ?? 500,
      freeThreshold: (api.shipping?.freeThresholdPaise ?? 0) / 100,
      standardRate: (api.shipping?.standardRatePaise ?? 6000) / 100,
      deliveryText: api.shipping?.deliveryText ?? "",
      pinBlacklist: (api.shipping?.pinBlacklist ?? []).join(", "),
    },
    tax: {
      gstRate: api.tax?.gstRatePct ?? 0,
      gstInclusive: api.tax?.gstInclusive ?? true,
      gstin: api.tax?.gstin ?? "",
    },
    announcement: { ...EMPTY.announcement, ...(api.announcement ?? {}) },
    maintenance: {
      on: api.maintenance?.on ?? false,
      message: api.maintenance?.message ?? "",
      // datetime-local wants "YYYY-MM-DDTHH:mm", not a full ISO string.
      endAt: api.maintenance?.endAt ? String(api.maintenance.endAt).slice(0, 16) : "",
    },
  };
}

/** Form shape -> the payload for one settings group. */
function toPayload(group, form) {
  switch (group) {
    case "shipping": {
      return {
        keralaRatePerKgPaise: Math.round(Number(form.shipping.keralaRatePerKg || 0) * 100),
        outsideKeralaRatePerKgPaise: Math.round(Number(form.shipping.outsideKeralaRatePerKg || 0) * 100),
        packagingWeightGrams: Math.max(0, Math.round(Number(form.shipping.packagingWeightGrams || 100))),
        slabWeightGrams: Math.max(1, Math.round(Number(form.shipping.slabWeightGrams || 500))),
        freeThresholdPaise: Math.round(Number(form.shipping.freeThreshold || 0) * 100),
        standardRatePaise: Math.round(Number(form.shipping.standardRate || 60) * 100),
        deliveryText: form.shipping.deliveryText,
        pinBlacklist: String(form.shipping.pinBlacklist)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^\d{6}$/.test(s)),
      };
    }
    case "tax":
      return {
        gstRatePct: Number(form.tax.gstRate || 0),
        gstInclusive: Boolean(form.tax.gstInclusive),
        gstin: form.tax.gstin,
      };
    case "announcement":
      return { ...form.announcement };
    case "maintenance":
      return {
        on: Boolean(form.maintenance.on),
        message: form.maintenance.message,
        endAt: form.maintenance.endAt ? new Date(form.maintenance.endAt).toISOString() : null,
      };
    default:
      return {};
  }
}

export default function SettingsPage() {
  const { data, loading, error } = useData((s) => s.settings);
  const loadSettings = useData((s) => s.loadSettings);
  const saveSettingsGroup = useData((s) => s.saveSettingsGroup);
  const toast = useToast();
  const [tab, setTab] = useState("shipping");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSettings().catch(() => undefined);
  }, [loadSettings]);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const setGroup = (group, key, val) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: val } }));

  /**
   * Saves ONLY the open tab's group (§13), so editing shipping cannot clobber
   * someone else's concurrent tax change.
   */
  const save = async () => {
    setBusy(true);
    try {
      await saveSettingsGroup(tab, toPayload(tab, form));
      toast.push(`${tab.charAt(0).toUpperCase() + tab.slice(1)} settings saved.`);
      await loadSettings();
    } catch (err) {
      toast.push(err.fields ? Object.values(err.fields)[0] : err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <RoleGate perm="settings.manage">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Settings" }]} />
      <PageHeader
        title="System Settings"
        actions={<Button variant="primary" onClick={save} disabled={busy}><Save size={15} /> Save changes</Button>}
      />

      <Tabs
        tabs={[
          { key: "shipping", label: "Shipping" },
          { key: "tax", label: "Tax" },
          { key: "announcement", label: "Announcement Bar" },
          { key: "maintenance", label: "Maintenance Mode" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="max-w-2xl">
        {tab === "shipping" && (
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-2 text-[13px] text-muted"><Truck size={16} /> Weight-slab shipping rules applied at checkout.</div>

              <div className="mb-5 rounded-lg border border-blue-line bg-blue-wash p-3.5 text-[12.5px] text-blue-deep leading-relaxed">
                <strong className="font-semibold block mb-1">Weight-Slab Shipping Calculation:</strong>
                <div>1. Billable Weight = Total Product Net Weight + Packaging Weight ({form.shipping.packagingWeightGrams || 100}g).</div>
                <div>2. Chargeable Slab = Rounded UP to the next {form.shipping.slabWeightGrams || 500}g slab.</div>
                <div>3. Rate = Kerala (₹{form.shipping.keralaRatePerKg || 45} per 500g slab) or Outside Kerala (₹{form.shipping.outsideKeralaRatePerKg || 70} per 500g slab).</div>
              </div>

              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field label="Kerala Shipping Rate (₹ / 500g slab)" hint="Base charge per 500g slab for addresses in Kerala.">
                  <Input type="number" min="0" step="0.1" value={form.shipping.keralaRatePerKg} onChange={(e) => setGroup("shipping", "keralaRatePerKg", e.target.value)} />
                </Field>
                <Field label="Outside Kerala Rate (₹ / 500g slab)" hint="Base charge per 500g slab for all other states & UTs.">
                  <Input type="number" min="0" step="0.1" value={form.shipping.outsideKeralaRatePerKg} onChange={(e) => setGroup("shipping", "outsideKeralaRatePerKg", e.target.value)} />
                </Field>
                <Field label="Packaging Weight Overhead (grams)" hint="Added to net product weight (default 100g).">
                  <Input type="number" min="0" value={form.shipping.packagingWeightGrams} onChange={(e) => setGroup("shipping", "packagingWeightGrams", e.target.value)} />
                </Field>
                <Field label="Weight Slab Granularity (grams)" hint="Billing weight rounds up to this step (default 500g).">
                  <Input type="number" min="1" value={form.shipping.slabWeightGrams} onChange={(e) => setGroup("shipping", "slabWeightGrams", e.target.value)} />
                </Field>
                <Field label="Free shipping threshold (₹)" hint="Orders at or above this get ₹0 shipping (0 to disable).">
                  <Input type="number" min="0" value={form.shipping.freeThreshold} onChange={(e) => setGroup("shipping", "freeThreshold", e.target.value)} />
                </Field>
                <Field label="Default / fallback delivery text">
                  <Input value={form.shipping.deliveryText} onChange={(e) => setGroup("shipping", "deliveryText", e.target.value)} />
                </Field>
                <Field className="md:col-span-2" label="PIN code blacklist" hint="Comma-separated PIN codes we don't deliver to.">
                  <Textarea value={form.shipping.pinBlacklist} onChange={(e) => setGroup("shipping", "pinBlacklist", e.target.value)} className="mono text-[12.5px]" />
                </Field>
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "tax" && (
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-2 text-[13px] text-muted"><Percent size={16} /> GST configuration shown on invoices.</div>
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field label="GST rate (%)">
                  <Input type="number" value={form.tax.gstRate} onChange={(e) => setGroup("tax", "gstRate", e.target.value)} />
                </Field>
                <Field label="GSTIN" hint="Shown on invoices.">
                  <Input value={form.tax.gstin} onChange={(e) => setGroup("tax", "gstin", e.target.value)} className="mono text-[12.5px]" />
                </Field>
                <div className="md:col-span-2 mt-1">
                  <Switch checked={form.tax.gstInclusive} onChange={(v) => setGroup("tax", "gstInclusive", v)} label="Prices are GST-inclusive" />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "announcement" && (
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-2 text-[13px] text-muted"><Megaphone size={16} /> The bar shown across the top of the site.</div>
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field className="md:col-span-2" label="Bar text">
                  <Input value={form.announcement.text} onChange={(e) => setGroup("announcement", "text", e.target.value)} />
                </Field>
                <Field label="Link label">
                  <Input value={form.announcement.linkLabel} onChange={(e) => setGroup("announcement", "linkLabel", e.target.value)} />
                </Field>
                <Field label="Link URL">
                  <Input value={form.announcement.linkUrl} onChange={(e) => setGroup("announcement", "linkUrl", e.target.value)} className="mono text-[12.5px]" />
                </Field>
                <Field label="Background colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.announcement.bg} onChange={(e) => setGroup("announcement", "bg", e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line" />
                    <Input value={form.announcement.bg} onChange={(e) => setGroup("announcement", "bg", e.target.value)} className="mono text-[12.5px]" />
                  </div>
                </Field>
                <Field label="Text colour">
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.announcement.fg} onChange={(e) => setGroup("announcement", "fg", e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line" />
                    <Input value={form.announcement.fg} onChange={(e) => setGroup("announcement", "fg", e.target.value)} className="mono text-[12.5px]" />
                  </div>
                </Field>
                <div className="md:col-span-2 mt-1">
                  <Switch checked={form.announcement.active} onChange={(v) => setGroup("announcement", "active", v)} label="Show the announcement bar" />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "maintenance" && (
          <Card>
            <CardBody>
              <div className="mb-4 flex items-center gap-2 text-[13px] text-muted"><Wrench size={16} /> Take the storefront offline for maintenance.</div>
              {form.maintenance.on && (
                <div className="mb-4">
                  <WarnBox>Maintenance mode is ON — customers currently see the maintenance message instead of the store.</WarnBox>
                </div>
              )}
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <div className="md:col-span-2 mb-2">
                  <Switch checked={form.maintenance.on} onChange={(v) => setGroup("maintenance", "on", v)} label="Enable maintenance mode" />
                </div>
                <Field
                  className="md:col-span-2"
                  label="Maintenance message"
                  hint="Shown to customers in place of the store."
                >
                  <RichText
                    value={form.maintenance.message}
                    onChange={(v) => setGroup("maintenance", "message", v)}
                    placeholder="Tell customers what's happening and when you'll be back…"
                    minHeight={140}
                  />
                </Field>
                <Field label="Scheduled end (optional)">
                  <Input type="datetime-local" value={form.maintenance.endAt} onChange={(e) => setGroup("maintenance", "endAt", e.target.value)} />
                </Field>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </RoleGate>
  );
}
