"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, X, ShieldCheck, ArrowRight, AlertTriangle, KeyRound, UserCheck, Eye, EyeOff } from "lucide-react";
import { auth } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Field, Input } from "@/components/ui/Field";

const PASSWORD_CHECKS = [
  { key: "length", label: "At least 10 characters", test: (p) => p.length >= 10 },
  { key: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number", test: (p) => /\d/.test(p) },
  { key: "special", label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function Brand() {
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      <Image
        src="/logo.png"
        alt="Zewa Feeds"
        width={120}
        height={120}
        priority
        className="h-10 w-auto object-contain brightness-0 invert"
      />
      <div className="border-l border-white/15 pl-3 text-left">
        <div className="text-[16px] font-semibold text-white">Zewa Feeds</div>
        <div className="font-mono text-[11px] uppercase tracking-[.14em] text-navy-text">
          CMS Invitation
        </div>
      </div>
    </div>
  );
}

function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("No invitation token was found in the link. Please check your invitation email.");
      setLoading(false);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const details = await auth.invitationDetails(token);
        if (isMounted) {
          setInvitation(details);
          setName(details.name || "");
        }
      } catch (err) {
        if (isMounted) {
          setLoadError(err.message || "Failed to validate invitation.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const checks = PASSWORD_CHECKS.map((c) => ({
    ...c,
    passed: c.test(password),
  }));
  const allPassed = checks.every((c) => c.passed);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    if (!allPassed) {
      setSubmitError("Please satisfy all password security requirements.");
      return;
    }

    if (!passwordsMatch) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await auth.acceptInvitation({
        token,
        name: name.trim(),
        password,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err.message || "Failed to activate account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy p-5">
        <div className="w-full max-w-[440px]">
          <Brand />
          <div className="rounded-xl border border-line bg-card p-8 shadow-pop text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal border-t-transparent mb-3" />
            <p className="text-[13px] text-muted">Validating your invitation…</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy p-5">
        <div className="w-full max-w-[440px]">
          <Brand />
          <div className="rounded-xl border border-line bg-card p-6 shadow-pop">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-red-wash text-red-deep">
              <AlertTriangle size={22} />
            </div>
            <h1 className="text-[18px] font-semibold text-ink">Invitation Invalid or Expired</h1>
            <p className="mb-5 mt-2 text-[13px] text-muted leading-relaxed">{loadError}</p>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="w-full">
                <Button variant="primary" className="w-full">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy p-5">
        <div className="w-full max-w-[440px]">
          <Brand />
          <div className="rounded-xl border border-line bg-card p-6 shadow-pop">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-teal-wash text-teal-deep">
              <UserCheck size={22} />
            </div>
            <h1 className="text-[18px] font-semibold text-ink">Account Activated!</h1>
            <p className="mb-5 mt-2 text-[13px] text-muted leading-relaxed">
              Your password has been securely set. You can now sign in with your credentials. A one-time verification code will be sent to your email to verify your sign-in.
            </p>
            <Link href={`/login?email=${encodeURIComponent(invitation?.email || "")}`} className="w-full">
              <Button variant="primary" className="w-full">
                Sign in to CMS <ArrowRight size={15} />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleTone = invitation?.role === "ADMIN" ? "teal" : invitation?.role === "OPS_MANAGER" ? "amber" : "blue";

  return (
    <div className="grid min-h-screen place-items-center bg-navy p-5">
      <div className="w-full max-w-[460px]">
        <Brand />
        <div className="rounded-xl border border-line bg-card p-6 shadow-pop">
          <div className="mb-4 flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-wash text-teal-deep">
              <KeyRound size={20} />
            </div>
            <Pill tone={roleTone}>{invitation?.roleLabel || invitation?.role}</Pill>
          </div>

          <h1 className="text-[18px] font-semibold text-ink">Accept Invitation</h1>
          <p className="mt-1 text-[13px] text-muted">
            You were invited to Zewa Feeds CMS as <b>{invitation?.roleLabel}</b>.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Field label="Account Email">
              <Input value={invitation?.email || ""} readOnly className="bg-surface text-muted mono" />
            </Field>

            <Field label="Full Name" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </Field>

            <Field label="Create Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <Field label="Confirm Password" required error={confirmPassword && !passwordsMatch ? "Passwords do not match." : undefined}>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  bad={!!(confirmPassword && !passwordsMatch)}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <div className="rounded-lg border border-line bg-surface/60 p-3.5">
              <div className="text-[11.5px] font-semibold text-ink mb-2">Password Requirements:</div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {checks.map((c) => (
                  <div key={c.key} className="flex items-center gap-2 text-[12px]">
                    {c.passed ? (
                      <Check size={14} className="text-teal-deep shrink-0" />
                    ) : (
                      <X size={14} className="text-muted-2 shrink-0" />
                    )}
                    <span className={c.passed ? "text-teal-deep font-medium" : "text-muted"}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {submitError && (
              <div className="rounded-lg border border-red/30 bg-red-wash p-3 text-[12.5px] text-red-deep">
                {submitError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2"
              disabled={submitting || !allPassed || !passwordsMatch || !name.trim()}
            >
              {submitting ? "Activating Account…" : "Activate Account & Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-navy p-5">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
        </div>
      }
    >
      <AcceptInvitationForm />
    </Suspense>
  );
}
