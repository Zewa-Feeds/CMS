"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, KeyRound, Download, Smartphone, Monitor, LogOut, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/store";
import { auth as authApi } from "@/lib/api";
import { ROLES } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { InfoBox, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { ChangePasswordModal } from "@/components/shell/ChangePasswordModal";

export default function ProfilePage() {
  const { user, role } = useAuth();
  const toast = useToast();

  const [pwOpen, setPwOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

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

              <div className="flex flex-wrap items-center gap-3 rounded-md border border-line-soft p-3">
                <ShieldCheck size={17} className="shrink-0 text-teal-deep" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-medium">
                    Two-factor authentication <Pill tone="green">Enabled</Pill>
                  </div>
                  <div className="text-[12px] text-muted">
                    TOTP authenticator app · mandatory for every CMS user.
                  </div>
                </div>
              </div>

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

      {/* Backup codes modal */}
      <Modal
        open={backupCodesModal}
        onClose={() => setBackupCodesModal(false)}
        title="Your New 2FA Backup Codes"
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
            Each code can be used ONCE to sign in if you lose access to your authenticator app. Generating new codes invalidates any previous backup codes.
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

