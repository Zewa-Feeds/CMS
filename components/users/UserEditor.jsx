"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Copy, Check, Mail, Send, ExternalLink } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Checkbox } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Pill } from "@/components/ui/Pill";

const ROLE_OPTIONS = [
  {
    key: "ADMIN",
    label: "Admin",
    tone: "teal",
    description: "Full CMS access across all modules, settings, user management, audit logs, and refunds.",
  },
  {
    key: "OPS_MANAGER",
    label: "Ops Manager",
    tone: "amber",
    description: "Product listings management, SKU pricing/stock, order lifecycle transitions, invoices, and email updates.",
  },
  {
    key: "CONTENT_EDITOR",
    label: "Content Editor",
    tone: "blue",
    description: "Content creation (blog articles, promotional banners, homepage drafts) and read-only catalogue viewing.",
  },
];

export function UserEditor({ initial }) {
  const router = useRouter();
  const createUser = useData((s) => s.createUser);
  const updateUser = useData((s) => s.updateUser);
  const setUserStatus = useData((s) => s.setUserStatus);
  const toast = useToast();

  const isNew = !initial;

  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    role: initial?.role || "CONTENT_EDITOR",
    status: initial?.status || "ACTIVE",
    twofa: initial?.twofa || "Pending setup",
  });

  const [invite, setInvite] = useState(true);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = "Enter a valid email.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.push("Fix the highlighted fields.", { bad: true });
      return;
    }

    setBusy(true);

    try {
      if (isNew) {
        const result = await createUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          sendInvite: invite,
        });

        if (result?.inviteUrl) {
          setInviteResult(result);
          toast.push("User invited! Invitation link generated.");
        } else {
          toast.push("User invited successfully.");
          router.push("/users");
        }
      } else {
        await updateUser(initial.id, {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
        });

        if (form.status !== initial.status) {
          await setUserStatus(initial.id, form.status);
        }

        toast.push("User updated.");
        router.push("/users");
      }
    } catch (err) {
      if (err.fields) {
        setErrors(err.fields);
        toast.push(Object.values(err.fields)[0] || "Fix the highlighted fields.", { bad: true });
      } else {
        toast.push(err.message, { bad: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteResult?.inviteUrl) return;
    navigator.clipboard.writeText(inviteResult.inviteUrl);
    setCopiedLink(true);
    toast.push("Invitation link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const activeRoleOption = ROLE_OPTIONS.find((r) => r.key === form.role) || ROLE_OPTIONS[2];

  return (
    <>
      <Breadcrumbs
        parts={[
          { label: "Dashboard", href: "/" },
          { label: "CMS Users", href: "/users" },
          { label: isNew ? "Add User" : form.name },
        ]}
      />
      <PageHeader
        title={isNew ? "Invite CMS User" : `Edit ${form.name}`}
        sub={isNew ? "Send an invitation to onboard a new staff member with dedicated permissions." : "Manage user profile and account status."}
        actions={
          <Button variant="primary" onClick={save} disabled={busy}>
            <Save size={15} /> {busy ? "Saving…" : isNew ? "Send Invitation" : "Save changes"}
          </Button>
        }
      />

      {inviteResult && (
        <div className="mb-5 max-w-2xl rounded-xl border border-teal/40 bg-teal-wash p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Mail size={18} className="text-teal-deep" />
            <h3 className="font-semibold text-teal-deep text-[14.5px]">
              User Invitation Created
            </h3>
          </div>
          <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
            An email invitation was queued for <b>{form.email}</b>. You can also directly copy their unique invitation link below:
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteResult.inviteUrl}
              className="mono flex-1 rounded border border-line bg-card py-2 px-3 text-[12.5px] text-ink font-medium select-all"
            />
            <Button size="sm" variant="default" onClick={copyInviteLink}>
              {copiedLink ? <Check size={14} className="text-teal-deep" /> : <Copy size={14} />}
              {copiedLink ? "Copied" : "Copy Link"}
            </Button>
            <Button size="sm" variant="primary" onClick={() => router.push("/users")}>
              Done
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-2xl">
        <Card>
          <CardBody>
            <div className="grid gap-x-[18px] md:grid-cols-2">
              <Field label="Full Name" required error={errors.name}>
                <Input
                  value={form.name}
                  bad={!!errors.name}
                  placeholder="e.g. Priya Nair"
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>

              <Field
                label="Email Address"
                required
                error={errors.email}
                hint={isNew ? "The user's official login email address." : "Login identity — cannot be changed."}
              >
                <Input
                  type="email"
                  value={form.email}
                  bad={!!errors.email}
                  placeholder="name@zewafeeds.com"
                  onChange={(e) => set({ email: e.target.value })}
                  readOnly={!isNew}
                />
              </Field>

              <Field label="Phone Number (Optional)">
                <Input
                  type="tel"
                  value={form.phone}
                  placeholder="+91 98765 43210"
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </Field>

              <Field label="Assigned Role" required error={errors.role}>
                <Select value={form.role} onChange={(e) => set({ role: e.target.value })}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="md:col-span-2 rounded-lg border border-line bg-surface/40 p-3 my-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-ink">Role Scope:</span>
                  <Pill tone={activeRoleOption.tone}>{activeRoleOption.label}</Pill>
                </div>
                <p className="text-[12px] text-muted leading-relaxed">{activeRoleOption.description}</p>
              </div>

              {!isNew && (
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </Select>
                </Field>
              )}

              {!isNew && (
                <Field label="2FA Security Status">
                  <Input value={form.twofa} readOnly className="text-muted" />
                </Field>
              )}

              {isNew && (
                <div className="md:col-span-2 mt-2">
                  <Checkbox
                    checked={invite}
                    onChange={setInvite}
                    label="Send invitation email via ZeptoMail (user sets their own password and completes mandatory 2FA on first login)."
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="mt-4">
          <InfoBox>
            Two-factor authentication (2FA) is mandatory for every CMS role. Invited staff choose their own password and complete 2FA setup upon their first sign-in.
          </InfoBox>
        </div>
      </div>
    </>
  );
}
