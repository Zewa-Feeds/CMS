"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Wand2 } from "lucide-react";
import { influencers as api } from "@/lib/api";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody, CardFoot } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { mapServerFieldErrors } from "@/lib/form-errors";

/** Today and a year out, as yyyy-mm-dd for the date inputs. */
const iso = (d) => d.toISOString().slice(0, 10);
const TODAY = iso(new Date());
const NEXT_YEAR = iso(new Date(Date.now() + 365 * 86400000));

/**
 * Suggest a code from the name: "Rahul Nair" + 15 -> RAHUL15.
 * Only a suggestion — the admin can type anything, and the server has the final
 * say on uniqueness.
 */
const suggestCode = (name, pct) => {
  const first = String(name).trim().split(/\s+/)[0] ?? "";
  const clean = first.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return clean ? `${clean}${pct}` : "";
};

export default function NewInfluencerPage() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    socialHandle: "",
    notes: "",
    couponCode: "",
    discountPct: 15,
    minOrder: 0,
    startsAt: TODAY,
    endsAt: NEXT_YEAR,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const created = await api.create({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        socialHandle: form.socialHandle || undefined,
        notes: form.notes || undefined,
        couponCode: form.couponCode,
        discountPct: Number(form.discountPct),
        minOrder: Number(form.minOrder) || 0,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      });
      toast.success(`${created.name} added. Their code ${created.coupon?.code} is live.`);
      router.push(`/influencers/${created.id}`);
    } catch (err) {
      // The server names the offending field; show it inline, not just in a toast.
      setErrors(mapServerFieldErrors(err.fields).errors);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Influencers", href: "/influencers" },
          { label: "Add" },
        ]}
      />
      <PageHeader title="Add influencer" subtitle="Creates their profile and personal coupon code." />

      <form onSubmit={submit} className="max-w-2xl">
        <Card>
          <CardBody>
            <div className="mb-5">
              <InfoBox>
              <strong className="mb-1 block font-semibold">How an affiliate code works</strong>
              The code is an ordinary coupon, validated and priced by the same engine as every
              other. It is <strong>not</strong> advertised on the storefront — it is personal to
              this creator. It cannot be combined with another percentage coupon such as SPECIAL10,
              but the first-order free-shipping benefit still applies alongside it.
              </InfoBox>
            </div>

            <div className="grid gap-x-[18px] md:grid-cols-2">
              <Field label="Name" required error={errors.name}>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={() =>
                    !form.couponCode && set("couponCode", suggestCode(form.name, form.discountPct))
                  }
                  placeholder="Rahul Nair"
                />
              </Field>
              <Field label="Instagram / social handle" error={errors.socialHandle}>
                <Input
                  value={form.socialHandle}
                  onChange={(e) => set("socialHandle", e.target.value)}
                  placeholder="@rahul.aqua"
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label="Phone" error={errors.phone}>
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>

              <Field
                className="md:col-span-2"
                label="Coupon code" required
                hint="Letters, numbers and hyphens. Case-insensitive — RAHUL15 and rahul15 are the same code."
                error={errors.couponCode}
              >
                <div className="flex gap-2">
                  <Input
                    className="mono uppercase"
                    value={form.couponCode}
                    onChange={(e) => set("couponCode", e.target.value.toUpperCase())}
                    placeholder="RAHUL15"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => set("couponCode", suggestCode(form.name, form.discountPct))}
                    title="Suggest from the name"
                  >
                    <Wand2 size={15} />
                  </Button>
                </div>
              </Field>

              <Field
                label="Discount %" required
                hint="Typically 12–15, so it beats the public SPECIAL10."
                error={errors.discountPct}
              >
                <Input
                  type="number"
                  min="1"
                  max="90"
                  step="1"
                  value={form.discountPct}
                  onChange={(e) => set("discountPct", e.target.value)}
                />
              </Field>
              <Field label="Minimum order (₹)" hint="0 for no minimum." error={errors.minOrder}>
                <Input
                  type="number"
                  min="0"
                  value={form.minOrder}
                  onChange={(e) => set("minOrder", e.target.value)}
                />
              </Field>

              <Field label="Starts" required error={errors.startsAt}>
                <Input
                  type="date"
                  value={form.startsAt}
                  onChange={(e) => set("startsAt", e.target.value)}
                />
              </Field>
              <Field label="Ends" required error={errors.endsAt}>
                <Input
                  type="date"
                  value={form.endsAt}
                  onChange={(e) => set("endsAt", e.target.value)}
                />
              </Field>

              <Field className="md:col-span-2" label="Notes" error={errors.notes}>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Commission terms, agency contact, anything worth remembering."
                />
              </Field>
            </div>
          </CardBody>
          <CardFoot>
            <Button type="button" variant="ghost" onClick={() => router.push("/influencers")}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Creating…" : "Create influencer"}
            </Button>
          </CardFoot>
        </Card>
      </form>
    </>
  );
}
