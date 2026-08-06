"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/lib/store";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// Password policy — spec §14.2
const RULES = [
  { label: "At least 10 characters", test: (v) => v.length >= 10 },
  { label: "One uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One number", test: (v) => /[0-9]/.test(v) },
  { label: "One special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function ChangePasswordModal({ open, onClose }) {
  const user = useAuth((s) => s.user);
  const changePassword = useAuth((s) => s.changePassword);
  const toast = useToast();

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const passed = RULES.map((r) => r.test(next));
  const allPassed = passed.every(Boolean);
  const matches = next.length > 0 && next === confirm;
  const canSubmit = cur.length > 0 && allPassed && matches;

  const reset = () => {
    setCur("");
    setNext("");
    setConfirm("");
    setErr("");
  };

  const close = () => {
    reset();
    onClose();
  };

  /**
   * The rules above are mirrored server-side (§14.2), including the
   * last-5-passwords check which cannot be done in the browser. A rejection comes
   * back as a field error rather than being guessed at here.
   */
  const submit = async () => {
    setErr("");
    if (next === cur) {
      setErr("New password must differ from your current one.");
      return;
    }

    setBusy(true);
    try {
      // Changing a password revokes other sessions and re-issues this one, so the
      // store's token is refreshed by the API client.
      await changePassword(cur, next);
      toast.push("Password changed. Other devices have been signed out.");
      close();
    } catch (e) {
      setErr(e.fields?.currentPassword ?? e.fields?.newPassword ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      sub={user?.email}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit || busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
        </>
      }
    >
      <div className="pb-2">
        <Field label="Current password" required error={err}>
          <Input type="password" value={cur} bad={!!err} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" required>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>

        <ul className="mb-4 -mt-2 space-y-1">
          {RULES.map((r, i) => (
            <li
              key={r.label}
              className={cn(
                "flex items-center gap-1.5 text-[11.5px]",
                next.length === 0 ? "text-muted-2" : passed[i] ? "text-green-deep" : "text-muted"
              )}
            >
              {next.length > 0 && passed[i] ? <Check size={12} /> : <X size={12} className="opacity-40" />}
              {r.label}
            </li>
          ))}
        </ul>

        <Field
          label="Confirm new password"
          required
          error={confirm.length > 0 && !matches ? "Passwords don't match." : ""}
        >
          <Input
            type="password"
            value={confirm}
            bad={confirm.length > 0 && !matches}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>
    </Modal>
  );
}
