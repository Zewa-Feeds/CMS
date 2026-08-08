"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, ArrowRight, Lock, KeyRound, Download } from "lucide-react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Field, Input, Checkbox } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";

/**
 * CMS sign-in — real backend (§14).
 *
 * Three steps, because 2FA is mandatory for every role (§14.3):
 *
 *   password → 2FA code            (already enrolled)
 *   password → enrol → 2FA code    (first login, forced setup)
 *
 * The password step never returns a session: it returns a short-lived challenge
 * token, so a correct password alone grants nothing.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * Where to land after signing in.
   *
   * middleware.js appends ?next= when it bounces an unauthenticated request, so a
   * deep link survives the detour. Guarded to same-origin paths — an open
   * redirect here would let a phishing link bounce off our own login page.
   */
  const nextPath = (() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/")) return "/";
    // Same rejections as safeNext() in middleware.js: protocol-relative, the
    // backslash form some browsers normalise to "//", and /login itself.
    if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
    if (raw === "/login" || raw.startsWith("/login?")) return "/";
    return raw;
  })();
  const {
    status,
    login,
    verify2fa,
    startEnrolment,
    completeEnrolment,
    restore,
    backupCodes,
    clearBackupCodes,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);
  /** Which 2FA method the form is asking for. */
  const [useBackup, setUseBackup] = useState(false);

  // An existing refresh cookie should land the user straight in.
  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (status === "in" && !backupCodes) router.replace(nextPath);
  }, [status, backupCodes, router, nextPath]);

  // Fetch the enrolment secret as soon as the flow reaches that step.
  useEffect(() => {
    if (status !== "enrol" || setupInfo) return;
    let cancelled = false;
    (async () => {
      const result = await startEnrolment();
      if (cancelled) return;
      if (result.ok) setSetupInfo(result);
      else setErr(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, setupInfo, startEnrolment]);

  const submitLogin = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const result = await login(email.trim(), password, remember);
    if (!result.ok) setErr(result.error);
    setBusy(false);
  };

  const submit2fa = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const result = await verify2fa(code.trim(), remember);
    if (!result.ok) setErr(result.error);
    setBusy(false);
  };

  const submitEnrol = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const result = await completeEnrolment(code.trim(), remember);
    if (!result.ok) setErr(result.error);
    setBusy(false);
  };

  // ---- One-time backup codes (§14.3) -------------------------------------
  // Shown after enrolment and never again, so this gate sits before the redirect.
  if (backupCodes?.length) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy p-5">
        <div className="w-full max-w-[440px]">
          <Brand />
          <div className="rounded-xl border border-line bg-card p-6 shadow-pop">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
              <KeyRound size={22} />
            </div>
            <h1 className="text-[18px] font-semibold">Save your backup codes</h1>
            <p className="mb-5 mt-1 text-[13px] text-muted">
              Each code works once if you lose your authenticator. This is the only time they are
              shown.
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-navy p-3">
              {backupCodes.map((c) => (
                <span key={c} className="mono text-center text-[13px] tracking-wider text-white">
                  {c}
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                className="flex-1"
                onClick={() => {
                  const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "zewa-cms-backup-codes.txt";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={14} /> Download
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  clearBackupCodes();
                  router.replace(nextPath);
                }}
              >
                I&apos;ve saved them
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "in") {
    return (
      <div className="grid min-h-screen place-items-center bg-navy p-5">
        <div className="w-full max-w-[400px]">
          <Brand />
          <div className="rounded-xl border border-line bg-card p-8 text-center shadow-pop">
            <div className="text-[14px] font-medium text-white">Signing in…</div>
          </div>
        </div>
      </div>
    );
  }

  const step = status === "twofa" ? "twofa" : status === "enrol" ? "enrol" : "password";



  return (
    <div className="grid min-h-screen place-items-center bg-navy p-5">
      <div className="w-full max-w-[400px]">
        <Brand />

        <div className="rounded-xl border border-line bg-card p-6 shadow-pop">
          {step === "password" && (
            <>
              <h1 className="text-[18px] font-semibold">Sign in</h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                Use your CMS credentials. All accounts require 2FA.
              </p>
              <form onSubmit={submitLogin}>
                <Field label="Email address" required htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@zewafeeds.com"
                    autoComplete="username"
                  />
                </Field>
                <Field label="Password" required htmlFor="password" error={err}>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    bad={!!err}
                  />
                </Field>
                <div className="mb-4 mt-1 flex items-center justify-between">
                  <Checkbox
                    checked={remember}
                    onChange={setRemember}
                    label="Remember me for 7 days"
                  />
                </div>
                <Button variant="primary" className="w-full" disabled={busy}>
                  {busy ? "Checking…" : "Continue"}
                  {!busy && <ArrowRight size={15} />}
                </Button>
              </form>
            </>
          )}

          {step === "enrol" && (
            <>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
                <ShieldCheck size={22} />
              </div>
              <h1 className="text-[18px] font-semibold">Set up two-factor authentication</h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                Required before you can access any module. Add this key to your authenticator app,
                then enter the code it shows.
              </p>

              {setupInfo?.secret ? (
                <div className="mb-4 rounded-lg border border-line bg-navy p-3">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[.14em] text-navy-text">
                    Setup key
                  </div>
                  <div className="mono break-all text-[13px] tracking-wider text-white">
                    {setupInfo.secret}
                  </div>
                </div>
              ) : (
                <p className="mb-4 text-[13px] text-muted">Preparing your setup key…</p>
              )}

              <form onSubmit={submitEnrol}>
                <Field label="Verification code" required htmlFor="code" error={err}>
                  <Input
                    id="code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    className="text-center font-mono text-[18px] tracking-[.4em]"
                    maxLength={6}
                    bad={!!err}
                    autoFocus
                  />
                </Field>
                <Button variant="primary" className="w-full" disabled={busy || !setupInfo}>
                  <Lock size={14} />
                  {busy ? "Verifying…" : "Confirm & sign in"}
                </Button>
              </form>
            </>
          )}

          {step === "twofa" && (
            <>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
                {useBackup ? <KeyRound size={22} /> : <ShieldCheck size={22} />}
              </div>
              <h1 className="text-[18px] font-semibold">
                {useBackup ? "Use a backup code" : "Two-factor authentication"}
              </h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                {useBackup
                  ? "Enter one of the single-use codes you saved when setting up 2FA. Each code works only once."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
              <form onSubmit={submit2fa}>
                <Field
                  label={useBackup ? "Backup code" : "Verification code"}
                  required
                  htmlFor="code"
                  error={err}
                  hint={
                    useBackup
                      ? "Format XXXX-XXXX. It stops working after this sign-in."
                      : "Six digits, refreshes every 30 seconds."
                  }
                >
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    // Deliberately not "123456" — that was the old mock code and
                    // reads as a hint that it would work.
                    placeholder={useBackup ? "XXXX-XXXX" : "000000"}
                    className="text-center font-mono text-[16px] tracking-[.25em]"
                    maxLength={useBackup ? 20 : 6}
                    inputMode={useBackup ? "text" : "numeric"}
                    bad={!!err}
                    autoFocus
                  />
                </Field>
                <Button variant="primary" className="w-full" disabled={busy}>
                  <Lock size={14} />
                  {busy ? "Verifying…" : "Verify & sign in"}
                </Button>
              </form>

              {/*
                The escape hatch. Without this, someone who has lost their phone
                has no visible way in — the backup code field looks like it only
                accepts authenticator digits.
              */}
              <button
                type="button"
                onClick={() => {
                  setUseBackup((v) => !v);
                  setCode("");
                  setErr("");
                }}
                className="mt-4 w-full text-center text-[12.5px] font-medium text-teal-deep hover:underline"
              >
                {useBackup
                  ? "Use my authenticator app instead"
                  : "Lost your authenticator? Use a backup code"}
              </button>
            </>
          )}

          {/*
            Development-only cheat sheet. Guarded on NODE_ENV so it never ships:
            it names the seeded TOTP key, which is dev-only anyway (real accounts
            generate a unique secret at enrolment).
          */}
          {process.env.NODE_ENV !== "production" && step === "password" && (
            <div className="mt-5">
              <InfoBox>
                <b>Dev accounts</b> — password <span className="mono">zewa1234</span>
                <br />
                <span className="mono">aditi@</span> Admin ·{" "}
                <span className="mono">rahul@</span> Ops ·{" "}
                <span className="mono">priya@</span> Editor ·{" "}
                <span className="mono">devika@</span> Editor, forced 2FA setup
              </InfoBox>
            </div>
          )}

          {process.env.NODE_ENV !== "production" && step === "twofa" && (
            <div className="mt-5">
              <InfoBox>
                <b>Dev 2FA — two options</b>
                <br />
                <b>1.</b> Add this key to Google Authenticator / Authy / 1Password, then enter the
                6-digit code it shows:
                <br />
                <span className="mono select-all text-[11.5px]">
                  JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP
                </span>
                <br />
                <b>2.</b> Or type a backup code — <span className="mono">ZEWA-DEV1</span> …{" "}
                <span className="mono">ZEWA-DEV8</span>. Each works <b>once</b>, so move to the next
                if one is rejected.
              </InfoBox>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11.5px] text-navy-text">
          Protected area · All activity is logged · HTTPS only
        </p>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-6 flex items-center gap-3">
      {/*
        The real mark, replacing a placeholder "Z" tile.

        `brightness-0 invert` renders the dark-ink logo white, matching how the
        storefront header uses the same asset on a dark background — the source
        PNG is not a white variant.
      */}
      <Image
        src="/logo.png"
        alt="Zewa Feeds"
        width={120}
        height={120}
        priority
        className="h-10 w-auto object-contain brightness-0 invert"
      />
      <div className="border-l border-white/15 pl-3">
        <div className="text-[16px] font-semibold text-white">Zewa Feeds</div>
        <div className="font-mono text-[11px] uppercase tracking-[.14em] text-navy-text">
          Content Management
        </div>
      </div>
    </div>
  );
}

/*
 * useSearchParams() (we read ?next=) opts the tree into client-side rendering, so
 * Next 14 requires a Suspense boundary or the static export of /login fails.
 * The fallback is deliberately blank — the form paints in the same tick.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
