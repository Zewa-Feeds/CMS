"use client";

import { useEffect, useState } from "react";
import { Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  KeyRound,
  Download,
  Eye,
  EyeOff,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Field, Input, Checkbox } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";

/**
 * CMS sign-in (§14).
 *
 * Email OTP is the PRIMARY / DEFAULT authentication method for all CMS users.
 * Authenticator App (TOTP) is an OPTIONAL fallback for users who configure it.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextPath = (() => {
    const raw = searchParams.get("next");
    if (!raw || !raw.startsWith("/")) return "/";
    if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
    if (raw === "/login" || raw.startsWith("/login?")) return "/";
    return raw;
  })();

  const {
    status,
    login,
    verify2fa,
    resendOtp,
    maskedEmail,
    hasTotp,
    startEnrolment,
    completeEnrolment,
    restore,
    backupCodes,
    clearBackupCodes,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupInfo, setSetupInfo] = useState(null);

  /** "email_otp" (default) or "totp" */
  const [authMethod, setAuthMethod] = useState("email_otp");
  /** When in TOTP mode, whether entering a single-use backup code */
  const [useBackup, setUseBackup] = useState(false);

  /** Cooldown timer (seconds) for resending email OTP */
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");

  // Restore existing session on mount
  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    if (status === "in" && !backupCodes) router.replace(nextPath);
  }, [status, backupCodes, router, nextPath]);

  // Cooldown interval effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Legacy fallback if user reaches enrol status
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
    setResendNotice("");
    setBusy(true);
    const result = await login(email.trim(), password, remember);
    if (!result.ok) {
      setErr(result.error);
    } else {
      setAuthMethod("email_otp");
      setCooldown(60);
      setCode("");
    }
    setBusy(false);
  };

  const submitVerification = async (e) => {
    e.preventDefault();
    setErr("");
    setResendNotice("");
    setBusy(true);
    const result = await verify2fa(code.trim(), remember);
    if (!result.ok) setErr(result.error);
    setBusy(false);
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || resending) return;
    setErr("");
    setResendNotice("");
    setResending(true);
    const result = await resendOtp();
    if (!result.ok) {
      setErr(result.error);
    } else {
      setCooldown(result.cooldownSeconds || 60);
      setResendNotice("A fresh 6-digit code has been sent to your email.");
    }
    setResending(false);
  };

  const submitEnrol = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const result = await completeEnrolment(code.trim(), remember);
    if (!result.ok) setErr(result.error);
    setBusy(false);
  };

  // ---- One-time backup codes modal (§14.3) ---------------------------------
  if (backupCodes?.length) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy p-5">
        <div className="w-full max-w-[440px]">
          <Brand />
          <div className="rounded-xl border border-line bg-card p-6 shadow-pop">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
              <KeyRound size={22} />
            </div>
            <h1 className="text-[18px] font-semibold text-white">Save your backup codes</h1>
            <p className="mb-5 mt-1 text-[13px] text-muted">
              Each code works once if you lose access to your Authenticator app. This is the only time they are shown.
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
              <h1 className="text-[18px] font-semibold text-white">Sign in</h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                Use your CMS credentials. A verification code will be sent to your email.
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
                    autoFocus
                  />
                </Field>
                <Field label="Password" required htmlFor="password" error={err}>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      autoComplete="current-password"
                      bad={!!err}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>
                <div className="mb-4 mt-1 flex items-center justify-between">
                  <Checkbox
                    checked={remember}
                    onChange={setRemember}
                    label="Remember me for 7 days"
                  />
                </div>
                <Button variant="primary" className="w-full" disabled={busy}>
                  {busy ? "Sending code…" : "Continue"}
                  {!busy && <ArrowRight size={15} />}
                </Button>
              </form>
            </>
          )}

          {step === "twofa" && authMethod === "email_otp" && (
            <>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
                <Mail size={22} />
              </div>
              <h1 className="text-[18px] font-semibold text-white">Check your email</h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                We sent a 6-digit verification code to{" "}
                <strong className="font-mono text-white">{maskedEmail || "your email"}</strong>.
                Enter it below to sign in.
              </p>

              {resendNotice && (
                <div className="mb-4 rounded-lg border border-teal-deep/30 bg-teal-wash/20 p-2.5 text-center text-[12.5px] text-teal-deep">
                  {resendNotice}
                </div>
              )}

              <form onSubmit={submitVerification}>
                <Field
                  label="6-Digit Verification Code"
                  required
                  htmlFor="otp-code"
                  error={err}
                  hint="Code expires in 10 minutes."
                >
                  <Input
                    id="otp-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="000000"
                    className="text-center font-mono text-[20px] tracking-[.35em]"
                    maxLength={6}
                    inputMode="numeric"
                    bad={!!err}
                    autoFocus
                  />
                </Field>

                <Button variant="primary" className="w-full" disabled={busy || code.trim().length < 6}>
                  <Lock size={14} />
                  {busy ? "Verifying…" : "Verify & Sign In"}
                </Button>
              </form>

              <div className="mt-4 flex flex-col items-center gap-2 border-t border-line/60 pt-4">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || resending}
                  className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-colors ${
                    cooldown > 0
                      ? "cursor-not-allowed text-muted"
                      : "text-teal-deep hover:underline"
                  }`}
                >
                  <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend verification code"}
                </button>

                {hasTotp && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod("totp");
                      setCode("");
                      setErr("");
                      setResendNotice("");
                    }}
                    className="mt-1 text-[12.5px] font-medium text-muted hover:text-white hover:underline transition-colors"
                  >
                    Use Authenticator App instead
                  </button>
                )}
              </div>
            </>
          )}

          {step === "twofa" && authMethod === "totp" && (
            <>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
                {useBackup ? <KeyRound size={22} /> : <ShieldCheck size={22} />}
              </div>
              <h1 className="text-[18px] font-semibold text-white">
                {useBackup ? "Use a backup code" : "Authenticator App"}
              </h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                {useBackup
                  ? "Enter one of the single-use backup codes you saved when setting up your authenticator."
                  : "Enter the 6-digit code from your authenticator app."}
              </p>
              <form onSubmit={submitVerification}>
                <Field
                  label={useBackup ? "Backup code" : "Authenticator code"}
                  required
                  htmlFor="totp-code"
                  error={err}
                  hint={
                    useBackup
                      ? "Format XXXX-XXXX. It stops working after this sign-in."
                      : "Six digits, refreshes every 30 seconds."
                  }
                >
                  <Input
                    id="totp-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
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

              <div className="mt-4 flex flex-col items-center gap-2 border-t border-line/60 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackup((v) => !v);
                    setCode("");
                    setErr("");
                  }}
                  className="text-[12.5px] font-medium text-teal-deep hover:underline"
                >
                  {useBackup
                    ? "Use 6-digit authenticator code"
                    : "Lost your authenticator? Use a backup code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMethod("email_otp");
                    setCode("");
                    setErr("");
                    setResendNotice("");
                  }}
                  className="text-[12.5px] font-medium text-muted hover:text-white hover:underline transition-colors"
                >
                  Use Email verification code instead
                </button>
              </div>
            </>
          )}

          {step === "enrol" && (
            <>
              <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
                <ShieldCheck size={22} />
              </div>
              <h1 className="text-[18px] font-semibold text-white">Set up Authenticator App</h1>
              <p className="mb-5 mt-1 text-[13px] text-muted">
                Add this setup key to your authenticator app, then enter the 6-digit confirmation code.
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

          {process.env.NODE_ENV !== "production" && step === "password" && (
            <div className="mt-5">
              <InfoBox>
                <b>Dev accounts</b> — password <span className="mono">zewa1234</span>
                <br />
                <span className="mono">aditi@</span> Admin ·{" "}
                <span className="mono">rahul@</span> Ops ·{" "}
                <span className="mono">priya@</span> Editor
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
