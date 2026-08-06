"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Copy, Check } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Checkbox } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const ROLE_DISPLAY_NAMES = ["Content Editor", "Ops Manager", "Admin"];

const ROLE_MAP = {
  "Content Editor": "CONTENT_EDITOR",
  "Ops Manager": "OPS_MANAGER",
  Admin: "ADMIN",
  CONTENT_EDITOR: "Content Editor",
  OPS_MANAGER: "Ops Manager",
  ADMIN: "Admin",
};

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
    role: initial?.role ? ROLE_MAP[initial.role] || initial.role : "Content Editor",
    status: initial?.status || "ACTIVE",
    twofa: initial?.twofa || "Pending setup",
  });

  const [invite, setInvite] = useState(true);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [setupToken, setSetupToken] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = "Enter a valid email.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) {
      toast.push("Fix the highlighted fields.", { bad: true });
      return;
    }

    const roleEnum = ROLE_MAP[form.role] || form.role;
    setBusy(true);

    try {
      if (isNew) {
        const result = await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          role: roleEnum,
          sendInvite: invite,
        });

        const token = result?.setupToken;
        if (token) {
          setSetupToken(token);
          toast.push("User created! Copy the setup token below.");
        } else {
          toast.push("User invited.");
          router.push("/users");
        }
      } else {
        await updateUser(initial.id, {
          name: form.name.trim(),
          role: roleEnum,
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

  const copySetupToken = () => {
    if (!setupToken) return;
    navigator.clipboard.writeText(setupToken);
    setCopiedToken(true);
    toast.push("Setup token copied to clipboard!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

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
        title={isNew ? "Add CMS User" : `Edit ${form.name}`}
        actions={
          <Button variant="primary" onClick={save} disabled={busy}>
            <Save size={15} /> {busy ? "Saving…" : isNew ? "Create user" : "Save changes"}
          </Button>
        }
      />

      {setupToken && (
        <div className="mb-4 max-w-2xl rounded-lg border border-teal/40 bg-teal-wash p-4">
          <h3 className="font-semibold text-teal-deep text-[14px] mb-1">
            User Created — Setup Token Generated
          </h3>
          <p className="text-[12.5px] text-muted mb-3">
            Pass this setup token to the user. They set their password and complete mandatory 2FA on first login.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={setupToken}
              className="mono w-full rounded border border-line bg-card py-1.5 px-3 text-[13px] text-ink font-semibold"
            />
            <Button size="sm" variant="default" onClick={copySetupToken}>
              {copiedToken ? <Check size={14} className="text-teal-deep" /> : <Copy size={14} />}
              {copiedToken ? "Copied" : "Copy"}
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
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>

              <Field
                label="Email Address"
                required
                error={errors.email}
                hint={isNew ? "Must be unique login email." : "Login identity and audit log anchor — cannot be changed."}
              >
                <Input
                  type="email"
                  value={form.email}
                  bad={!!errors.email}
                  onChange={(e) => set({ email: e.target.value })}
                  readOnly={!isNew}
                />
              </Field>

              <Field label="Role" required error={errors.role}>
                <Select value={form.role} onChange={(e) => set({ role: e.target.value })}>
                  {ROLE_DISPLAY_NAMES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>

              {!isNew && (
                <Field label="Status">
                  <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="DEACTIVATED">Deactivated</option>
                  </Select>
                </Field>
              )}

              {!isNew && (
                <Field label="2FA Status">
                  <Input value={form.twofa} readOnly className="text-muted" />
                </Field>
              )}

              {isNew && (
                <div className="md:col-span-2 mt-1">
                  <Checkbox
                    checked={invite}
                    onChange={setInvite}
                    label="Generate setup token for first-time login — user sets password and completes mandatory 2FA."
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        <div className="mt-4">
          <InfoBox>
            2FA is mandatory for every CMS user regardless of role. New users complete 2FA setup on first login before accessing any module.
          </InfoBox>
        </div>
      </div>
    </>
  );
}

