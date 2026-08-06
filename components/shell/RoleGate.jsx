"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/store";
import { button } from "@/components/ui/Button";

/**
 * Wrap a page's contents; renders a friendly denial if the user lacks `perm`.
 *
 * Checks the SERVER-issued permission list rather than deriving from a role
 * locally. This is presentation only — every endpoint enforces the same
 * permission independently, so hiding a page is a courtesy, not the control.
 */
export function RoleGate({ perm, children }) {
  const permissions = useAuth((s) => s.permissions);
  if (perm && !permissions.includes(perm)) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-amber-wash text-amber-deep">
          <ShieldAlert size={22} />
        </div>
        <h1 className="mb-1.5 text-[17px] font-semibold">You don't have access to this</h1>
        <p className="mb-5 text-[13px] text-muted">
          Your role can't view this module. If you need access, ask an Admin to update your
          permissions.
        </p>
        <Link href="/" className={button({ variant: "dark" })}>
          Back to Dashboard
        </Link>
      </div>
    );
  }
  return children;
}
