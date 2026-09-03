"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Megaphone, Power, PowerOff, Save } from "lucide-react";
import { influencers as api } from "@/lib/api";
import { inr } from "@/lib/utils";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card, CardBody, CardHead, CardTitle, CardFoot } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ConfirmModal, InfoBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";
import { mapServerFieldErrors } from "@/lib/form-errors";

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

/** Mirrors the create form; "Always combines" is deliberately not offered. */
const STACKING_CHOICES = [
  {
    value: "NON_STACKABLE",
    label: "Non-Stackable (recommended)",
    hint: "Cannot be combined with any other discount. Note that free shipping will not apply alongside it either.",
  },
  {
    value: "STACKABLE",
    label: "Stackable",
    hint: "Combines with other stackable discounts, so the savings add together — a 15% code beside a 10% one takes roughly 24% off. Free shipping applies alongside it.",
  },
  {
    value: "EXCLUSIVE",
    label: "Exclusive",
    hint: "Applies alone and outranks competing discounts, but free shipping still applies alongside it.",
  },
];
const STACKING_LABEL = Object.fromEntries(
  [...STACKING_CHOICES.map((c) => [c.value, c.label]), ["GLOBALLY_STACKABLE", "Universal"]],
);

const STATUS_TONE = {
  PENDING: "amber", PROCESSING: "blue", SHIPPED: "purple",
  DELIVERED: "green", CANCELLED: "red",
};
const PAYMENT_TONE = {
  PAID: "green", UNPAID: "grey", REFUNDED: "red",
  PARTIALLY_REFUNDED: "amber", FAILED: "red",
};

/** One summary figure. */
function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <div className="text-[11.5px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[19px] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

export default function InfluencerDetailPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Filters for the attributed-orders table.
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadProfile = useCallback(async () => {
    const p = await api.get(id);
    setProfile(p);
    setForm({
      name: p.name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      socialHandle: p.socialHandle ?? "",
      notes: p.notes ?? "",
      couponCode: p.coupon?.code ?? "",
      discountType: p.coupon?.discountType ?? "PERCENTAGE",
      discountPct: p.coupon?.discountType === "FLAT" ? 15 : (p.coupon?.discountValue ?? 15),
      discountAmount:
        p.coupon?.discountType === "FLAT" ? (p.coupon?.discountValue ?? 0) / 100 : "",
      minOrder: (p.coupon?.minOrderPaise ?? 0) / 100,
      maxDiscount:
        p.coupon?.maxDiscountPaise == null ? "" : p.coupon.maxDiscountPaise / 100,
      totalUsageLimit: p.coupon?.totalUsageLimit ?? "",
      perCustomerLimit: p.coupon?.perCustomerLimit ?? "",
      stackingMode: p.coupon?.stackingMode ?? "NON_STACKABLE",
      startsAt: p.coupon?.startsAt ? p.coupon.startsAt.slice(0, 10) : "",
      endsAt: p.coupon?.endsAt ? p.coupon.endsAt.slice(0, 10) : "",
    });
  }, [id]);

  const loadReport = useCallback(async () => {
    const range = { from: from || undefined, to: to || undefined };
    const [a, o] = await Promise.all([
      api.analytics(id, range),
      api.orders(id, {
        ...range,
        q: q.trim() || undefined,
        status: status === "All" ? undefined : status,
        limit: 50,
      }),
    ]);
    setStats(a);
    setOrders(o.data ?? []);
  }, [id, q, status, from, to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await Promise.all([loadProfile(), loadReport()]);
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadProfile, loadReport]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const isFlat = form.discountType === "FLAT";
      await api.update(id, {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        socialHandle: form.socialHandle || undefined,
        notes: form.notes || undefined,
        couponCode: form.couponCode,
        discountType: form.discountType,
        discountPct: isFlat ? undefined : Number(form.discountPct),
        discountAmount: isFlat ? Number(form.discountAmount) : undefined,
        minOrder: Number(form.minOrder) || 0,
        maxDiscount: !isFlat && form.maxDiscount !== "" ? Number(form.maxDiscount) : null,
        totalUsageLimit: form.totalUsageLimit !== "" ? Number(form.totalUsageLimit) : null,
        perCustomerLimit:
          form.perCustomerLimit !== "" ? Number(form.perCustomerLimit) : undefined,
        stackingMode: form.stackingMode,
        startsAt: form.startsAt,
        endsAt: form.endsAt,
      });
      toast.success("Influencer updated. Orders already placed keep their original figures.");
      setEditing(false);
      await loadProfile();
    } catch (err) {
      setErrors(mapServerFieldErrors(err.fields).errors);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async () => {
    const goingOff = profile.status === "ACTIVE";
    try {
      await (goingOff ? api.deactivate(id) : api.activate(id));
      toast.success(goingOff ? "Deactivated. Past orders are unchanged." : "Reactivated.");
      setConfirming(false);
      await loadProfile();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !profile) {
    return <EmptyState icon={Megaphone} title="Loading…" />;
  }
  if (error && !profile) {
    return <EmptyState icon={Megaphone} title="Could not load influencer">{error}</EmptyState>;
  }

  return (
    <>
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "Influencers", href: "/influencers" },
          { label: profile.name },
        ]}
      />
      <PageHeader
        title={profile.name}
        sub={
          profile.coupon
            ? `${profile.coupon.code} · ${profile.coupon.discountValue}% off`
            : "No coupon attached"
        }
        actions={
          <RoleGate perm="coupons.edit">
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? "Cancel edit" : "Edit"}
              </Button>
              <Button
                variant={profile.status === "ACTIVE" ? "danger" : "primary"}
                onClick={() => setConfirming(true)}
              >
                {profile.status === "ACTIVE" ? <PowerOff size={15} /> : <Power size={15} />}
                {profile.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </RoleGate>
        }
      />

      {profile.status !== "ACTIVE" && (
        <div className="mb-4">
          <InfoBox>
            This influencer is deactivated, so {profile.coupon?.code} cannot be used on new orders.
            Everything below is preserved exactly as it was.
          </InfoBox>
        </div>
      )}

      {/* ---- Summary ------------------------------------------------------ */}
      {stats && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Coupon uses" value={stats.totalUses} sub="Every order that carried the code" />
          <Stat label="Successful orders" value={stats.successfulOrders} sub="Paid or COD accepted" />
          <Stat label="Cancelled" value={stats.cancelledOrders} sub={`${stats.refundedOrders} refunded`} />
          <Stat label="Net revenue" value={inr(stats.netRevenue)} sub="What customers actually paid" />
          <Stat label="Gross revenue" value={inr(stats.grossRevenue)} sub="Before the affiliate discount" />
          <Stat label="Discount given" value={inr(stats.discountGiven)} sub="Total taken off by this code" />
          <Stat label="Average order" value={inr(stats.averageOrderValue)} sub="Across successful orders" />
          <Stat
            label="Active since"
            value={fmtDate(stats.firstOrderAt)}
            sub={stats.latestOrderAt ? `Latest ${fmtDate(stats.latestOrderAt)}` : "No orders yet"}
          />
        </div>
      )}

      {/* ---- Profile / coupon --------------------------------------------- */}
      <Card className="mb-5">
        <CardHead>
          <CardTitle>Profile &amp; coupon</CardTitle>
        </CardHead>
        {editing ? (
          <form onSubmit={save}>
            <CardBody>
              <div className="grid gap-x-[18px] md:grid-cols-2">
                <Field label="Name" required error={errors.name}>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Instagram / social handle" error={errors.socialHandle}>
                  <Input value={form.socialHandle} onChange={(e) => set("socialHandle", e.target.value)} />
                </Field>
                <Field label="Email" error={errors.email}>
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field
                  label="Coupon code" required
                  hint="Changing this does NOT rewrite past orders — they keep the code they were placed with."
                  error={errors.couponCode}
                >
                  <Input
                    className="mono uppercase"
                    value={form.couponCode}
                    onChange={(e) => set("couponCode", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Discount type" error={errors.discountType}>
                  <Select value={form.discountType} onChange={(e) => set("discountType", e.target.value)}>
                    <option value="PERCENTAGE">Percentage off</option>
                    <option value="FLAT">Flat amount off</option>
                  </Select>
                </Field>
                {form.discountType === "PERCENTAGE" ? (
                  <Field label="Discount %" required error={errors.discountPct}>
                    <Input
                      type="number" min="1" max="90" step="1"
                      value={form.discountPct}
                      onChange={(e) => set("discountPct", e.target.value)}
                    />
                  </Field>
                ) : (
                  <Field label="Discount amount (₹)" required error={errors.discountAmount}>
                    <Input
                      type="number" min="1" step="1"
                      value={form.discountAmount}
                      onChange={(e) => set("discountAmount", e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Minimum order (₹)" error={errors.minOrder}>
                  <Input type="number" min="0" value={form.minOrder} onChange={(e) => set("minOrder", e.target.value)} />
                </Field>
                {form.discountType === "PERCENTAGE" && (
                  <Field label="Maximum discount (₹)" hint="Blank for no cap." error={errors.maxDiscount}>
                    <Input
                      type="number" min="1" placeholder="No cap"
                      value={form.maxDiscount}
                      onChange={(e) => set("maxDiscount", e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Total uses allowed" hint="Blank for unlimited." error={errors.totalUsageLimit}>
                  <Input
                    type="number" min="1" placeholder="Unlimited"
                    value={form.totalUsageLimit}
                    onChange={(e) => set("totalUsageLimit", e.target.value)}
                  />
                </Field>
                <Field label="Uses per customer" error={errors.perCustomerLimit}>
                  <Input
                    type="number" min="1" placeholder="Default"
                    value={form.perCustomerLimit}
                    onChange={(e) => set("perCustomerLimit", e.target.value)}
                  />
                </Field>
                <Field
                  className="md:col-span-2"
                  label="Combining with other coupons"
                  hint={STACKING_CHOICES.find((c) => c.value === form.stackingMode)?.hint}
                  error={errors.stackingMode}
                >
                  <Select value={form.stackingMode} onChange={(e) => set("stackingMode", e.target.value)}>
                    {STACKING_CHOICES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Starts" required error={errors.startsAt}>
                  <Input type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
                </Field>
                <Field label="Ends" required error={errors.endsAt}>
                  <Input type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
                </Field>
                <Field className="md:col-span-2" label="Notes" error={errors.notes}>
                  <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>
              </div>
            </CardBody>
            <CardFoot>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={saving}>
                <Save size={15} /> {saving ? "Saving…" : "Save changes"}
              </Button>
            </CardFoot>
          </form>
        ) : (
          <CardBody>
            <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-muted">Status</dt>
                <dd><Pill tone={profile.status === "ACTIVE" ? "green" : "grey"}>
                  {profile.status === "ACTIVE" ? "Active" : "Inactive"}</Pill></dd></div>
              <div><dt className="text-muted">Code</dt><dd className="mono">{profile.coupon?.code ?? "—"}</dd></div>
              <div><dt className="text-muted">Discount</dt>
                <dd>
                  {profile.coupon
                    ? profile.coupon.discountType === "FLAT"
                      ? inr(profile.coupon.discountValue / 100)
                      : `${profile.coupon.discountValue}%`
                    : "—"}
                  {profile.coupon?.maxDiscountPaise != null && (
                    <span className="text-muted"> (max {inr(profile.coupon.maxDiscount)})</span>
                  )}
                </dd></div>
              <div><dt className="text-muted">Combining</dt>
                <dd>{STACKING_LABEL[profile.coupon?.stackingMode] ?? "—"}</dd></div>
              <div><dt className="text-muted">Usage limit</dt>
                <dd>
                  {profile.coupon?.totalUsageLimit ?? "Unlimited"}
                  {profile.coupon?.perCustomerLimit != null &&
                    ` · ${profile.coupon.perCustomerLimit} per customer`}
                </dd></div>
              <div><dt className="text-muted">Minimum order</dt>
                <dd>{profile.coupon?.minOrderPaise ? inr(profile.coupon.minOrder) : "None"}</dd></div>
              <div><dt className="text-muted">Runs</dt>
                <dd>{fmtDate(profile.coupon?.startsAt)} → {fmtDate(profile.coupon?.endsAt)}</dd></div>
              <div><dt className="text-muted">Email</dt><dd>{profile.email ?? "—"}</dd></div>
              <div><dt className="text-muted">Phone</dt><dd>{profile.phone ?? "—"}</dd></div>
              <div><dt className="text-muted">Social</dt><dd>{profile.socialHandle ?? "—"}</dd></div>
              <div><dt className="text-muted">Added</dt><dd>{fmtDate(profile.createdAt)}</dd></div>
              {profile.notes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-muted">Notes</dt><dd>{profile.notes}</dd>
                </div>
              )}
            </dl>
          </CardBody>
        )}
      </Card>

      {/* ---- Attributed orders -------------------------------------------- */}
      <Card>
        <CardHead>
          <CardTitle>Attributed orders</CardTitle>
        </CardHead>
        <FilterBar>
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no or email…" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="All">All statuses</option>
            {["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        </FilterBar>

        {orders.length === 0 ? (
          <EmptyState icon={Megaphone} title="No attributed orders">
            Orders placed with {profile.coupon?.code ?? "this code"} will appear here.
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th className="text-right">Subtotal</Th>
                  <Th className="text-right">Discount</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link href={`/orders/${o.id}`} className="mono font-semibold hover:underline">
                        {o.orderNo}
                      </Link>
                      {o.couponCode && <CellSub className="mono">{o.couponCode}</CellSub>}
                    </Td>
                    <Td>{o.customerName ?? "—"}<CellSub>{o.email}</CellSub></Td>
                    <Td>{fmtDate(o.placedAt)}</Td>
                    <Td><Pill tone={STATUS_TONE[o.status] ?? "grey"}>{o.status}</Pill></Td>
                    <Td><Pill tone={PAYMENT_TONE[o.paymentStatus] ?? "grey"}>{o.paymentStatus}</Pill></Td>
                    <Td className="text-right tabular-nums">{inr(o.subtotal)}</Td>
                    <Td className="text-right tabular-nums text-red-deep">
                      −{inr(o.discount)}
                      {o.discountPct != null && <CellSub>{o.discountPct}%</CellSub>}
                    </Td>
                    <Td className="text-right tabular-nums font-semibold">{inr(o.total)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={toggle}
        title={profile.status === "ACTIVE" ? "Deactivate influencer?" : "Reactivate influencer?"}
        confirmLabel={profile.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
        danger={profile.status === "ACTIVE"}
        message={
          profile.status === "ACTIVE"
            ? `${profile.name}'s code stops working immediately. Nothing is deleted — every attributed order and all reporting stays exactly as it is.`
            : `${profile.name}'s code starts working again for new orders.`
        }
      />
    </>
  );
}
