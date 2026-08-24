"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  KeyRound,
  Download,
  Smartphone,
  Monitor,
  LogOut,
  Copy,
  Check,
  Mail,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/store";
import { auth as authApi } from "@/lib/api";
import { ROLES } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input } from "@/components/ui/Field";
import { InfoBox, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChangePasswordModal } from "@/components/shell/ChangePasswordModal";

export default function ProfilePage() {
  const { user, role } = useAuth();
  const toast = useToast();

  const [pwOpen, setPwOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Authenticator (TOTP) setup modal state
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [totpSetupInfo, setTotpSetupInfo] = useState(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpError, setTotpError] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [totpConfigured, setTotpConfigured] = useState(user?.twofaMethod === "TOTP");

  // Backup codes modal state
  const [backupCodesModal, setBackupCodesModal] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState([]);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [busyCodes, setBusyCodes] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const data = await authApi.sessions();
      setSessions(data || []);
    } catch {
      toast.push("Failed to load active sessions.", { bad: true });
    } finally {
      setLoadingSessions(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const roleMeta = ROLES[role] || { name: role || "Staff", dot: "#7E8EA4", who: "Staff User" };

  const revoke = async (s) => {
    try {
      await authApi.revokeSession(s.id);
      toast.push("Session terminated.");
      await fetchSessions();
    } catch (err) {
      toast.push(err.message || "Failed to revoke session.", { bad: true });
    }
  };

  const handleStartTotpSetup = async () => {
    setTotpError("");
    setTotpCode("");
    setTotpBusy(true);
    try {
      const data = await authApi.setupTotp();
      setTotpSetupInfo(data);
      setTotpModalOpen(true);
    } catch (err) {
      toast.push(err.message || "Failed to start Authenticator setup.", { bad: true });
    } finally {
      setTotpBusy(false);
    }
  };

  const handleConfirmTotp = async (e) => {
    e.preventDefault();
    if (!totpCode.trim()) return;
    setTotpError("");
    setTotpBusy(true);
    try {
      const result = await authApi.confirmTotp(totpCode.trim());
      setTotpModalOpen(false);
      setTotpConfigured(true);
      if (result.backupCodes?.length) {
        setGeneratedCodes(result.backupCodes);
        setBackupCodesModal(true);
      }
      toast.push("Authenticator App successfully configured!");
    } catch (err) {
      setTotpError(err.message || "Invalid verification code.");
    } finally {
      setTotpBusy(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setBusyCodes(true);
    try {
      const codes = await authApi.regenerateBackupCodes();
      setGeneratedCodes(codes || []);
      setBackupCodesModal(true);
      toast.push("New 2FA backup codes generated.");
    } catch (err) {
      toast.push(err.message || "Failed to generate backup codes.", { bad: true });
    } finally {
      setBusyCodes(false);
    }
  };

  const downloadBackupCodes = () => {
    if (!generatedCodes.length) return;
    const text = `Zewa Feeds CMS Backup Codes\nGenerated at: ${new Date().toLocaleString("en-IN")}\nAccount: ${user?.email || ""}\n\n${generatedCodes.join("\n")}\n\nNote: Each code can be used ONCE. Keep them in a safe place.`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zewa-cms-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    if (!generatedCodes.length) return;
    navigator.clipboard.writeText(generatedCodes.join("\n"));
    setCopiedCodes(true);
    toast.push("Backup codes copied to clipboard!");
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const copySecret = () => {
    if (!totpSetupInfo?.secret) return;
    navigator.clipboard.writeText(totpSetupInfo.secret);
    setCopiedSecret(true);
    toast.push("Setup key copied!");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const formatDeviceName = (ua) => {
    if (!ua) return "Browser session";
    if (ua.includes("iPhone") || ua.includes("iPad")) return "Safari · iOS";
    if (ua.includes("Android")) return "Chrome · Android";
    if (ua.includes("Macintosh") || ua.includes("Mac OS")) return "Browser · macOS";
    if (ua.includes("Windows")) return "Browser · Windows";
    return "Browser session";
  };

  const isMobile = (ua) => ua && (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone"));

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "My Profile" }]} />
      <PageHeader title="My Profile" sub="Your account, security, and active sessions." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-3.5">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-navy text-[18px] font-semibold text-teal">
                {user?.name ? initials(user.name) : initials(user?.email || "U")}
              </span>
              <div>
                <div className="text-[16px] font-semibold">{user?.name || "Staff Member"}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: roleMeta.dot }} />
                  <span className="text-[12.5px] text-muted">{roleMeta.name}</span>
                </div>
              </div>
            </div>
            <dl className="space-y-2.5 text-[13px]">
              {[
                ["Email", user?.email || "—"],
                ["Role", roleMeta.name],
                ["Responsibility", roleMeta.who],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-b border-line-soft pb-2.5 last:border-b-0 last:pb-0">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <InfoBox>
                Your name and role are managed by an Admin in CMS Users. Ask an Admin if either needs to change.
              </InfoBox>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead>
              <CardTitle>Security</CardTitle>
            </CardHead>
            <CardBody className="space-y-3">
              {/* Password */}
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-soft p-3">
                <KeyRound size={17} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">Password</div>
                  <div className="text-[12px] text-muted">
                    Minimum 10 characters, with an uppercase letter, a number, and a symbol.
                  </div>
                </div>
                <Button size="sm" onClick={() => setPwOpen(true)}>
                  Change
                </Button>
              </div>

              {/* Primary: Email OTP */}
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-soft p-3">
                <Mail size={17} className="shrink-0 text-teal-deep" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    Email OTP <Pill tone="green">Primary</Pill>
                  </div>
                  <div className="text-[12px] text-muted">
                    6-digit verification codes sent to {user?.email || "your email"} on sign-in.
                  </div>
                </div>
              </div>

              {/* Optional: Authenticator App (TOTP) */}
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-soft p-3">
                <ShieldCheck size={17} className={`shrink-0 ${totpConfigured ? "text-teal-deep" : "text-muted"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    Authenticator App (TOTP)
                    <Pill tone={totpConfigured ? "teal" : "gray"}>
                      {totpConfigured ? "Configured" : "Optional"}
                    </Pill>
                  </div>
                  <div className="text-[12px] text-muted">
                    Use Google Authenticator, 1Password, or Authy as an alternative sign-in method.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={totpConfigured ? "default" : "primary"}
                  onClick={handleStartTotpSetup}
                  disabled={totpBusy}
                >
                  {totpBusy ? "Loading…" : totpConfigured ? "Reconfigure" : "Set Up"}
                </Button>
              </div>

              {/* Backup codes */}
              {totpConfigured && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-soft p-3">
                  <Download size={17} className="shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">Backup codes</div>
                    <div className="text-[12px] text-muted">8 single-use codes for emergency access when offline.</div>
                  </div>
                  <Button size="sm" onClick={handleRegenerateBackupCodes} disabled={busyCodes}>
                    {busyCodes ? "Generating…" : "Generate New"}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHead>
              <CardTitle>Active Sessions</CardTitle>
              <span className="ml-auto font-mono text-[11px] text-muted-2">{sessions.length} active</span>
            </CardHead>
            <CardBody className="space-y-2.5">
              {loadingSessions ? (
                <div className="py-4 text-center text-[12.5px] text-muted">Loading sessions…</div>
              ) : sessions.length === 0 ? (
                <div className="py-4 text-center text-[12.5px] text-muted">No active sessions.</div>
              ) : (
                sessions.map((s) => {
                  const DeviceIcon = isMobile(s.userAgent) ? Smartphone : Monitor;
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line-soft p-3">
                      <DeviceIcon size={17} className="shrink-0 text-muted" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium">
                          {formatDeviceName(s.userAgent)}
                          {s.current && <Pill tone="teal">This device</Pill>}
                        </div>
                        <div className="mono text-[11.5px] text-muted-2">
                          IP: {s.ip || "—"} · Created: {new Date(s.createdAt).toLocaleString("en-IN")}
                        </div>
                      </div>
                      {!s.current && (
                        <Button size="sm" variant="danger" onClick={() => revoke(s)}>
                          <LogOut size={13} /> Revoke
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />

      {/* Authenticator Setup Modal */}
      <Modal
        open={totpModalOpen}
        onClose={() => setTotpModalOpen(false)}
        title="Set Up Authenticator App"
        sub="Connect Google Authenticator, 1Password, or Authy to your CMS account."
      >
        <form onSubmit={handleConfirmTotp} className="space-y-4 pb-2">
          <p className="text-[13px] text-muted leading-relaxed">
            Enter this setup key in your authenticator app, then type the 6-digit code it displays below to verify.
          </p>

          {totpSetupInfo?.secret && (
            <div className="rounded-lg border border-line bg-canvas p-3">
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[.14em] text-muted">
                Setup Key
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[14px] font-bold tracking-wider text-ink break-all select-all">
                  {totpSetupInfo.secret}
                </span>
                <Button size="sm" variant="ghost" type="button" onClick={copySecret}>
                  {copiedSecret ? <Check size={14} className="text-teal-deep" /> : <Copy size={14} />}
                  {copiedSecret ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}

          <Field label="6-Digit Verification Code" required error={totpError}>
            <Input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="000000"
              className="text-center font-mono text-[18px] tracking-[.35em]"
              maxLength={6}
              inputMode="numeric"
              bad={!!totpError}
              autoFocus
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="default" type="button" onClick={() => setTotpModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={totpBusy || totpCode.trim().length < 6}>
              <Lock size={14} />
              {totpBusy ? "Enrolling…" : "Confirm & Enable"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Backup codes modal */}
      <Modal
        open={backupCodesModal}
        onClose={() => setBackupCodesModal(false)}
        title="Your 2FA Backup Codes"
        sub="Keep these in a password manager or printed in a secure location."
        footer={
          <>
            <Button variant="ghost" onClick={copyBackupCodes}>
              {copiedCodes ? <Check size={14} className="text-teal-deep" /> : <Copy size={14} />}
              {copiedCodes ? "Copied" : "Copy"}
            </Button>
            <Button variant="default" onClick={downloadBackupCodes}>
              <Download size={14} /> Download .txt
            </Button>
            <Button variant="primary" onClick={() => setBackupCodesModal(false)}>
              Done
            </Button>
          </>
        }
      >
        <div className="space-y-3 pb-2">
          <InfoBox>
            Each code can be used ONCE to sign in if you lose access to your authenticator app.
          </InfoBox>
          <div className="grid grid-cols-2 gap-2 rounded-md border border-line bg-canvas p-4 font-mono text-[13px] font-semibold text-ink">
            {generatedCodes.map((code, idx) => (
              <div key={idx} className="rounded bg-card py-1.5 px-3 border border-line-soft text-center">
                {code}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
