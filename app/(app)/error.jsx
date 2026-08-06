"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, button } from "@/components/ui/Button";

/**
 * Error boundary for every page inside the app shell.
 *
 * Without one, a render-time throw gives Next's bare "Application error: a
 * client-side exception has occurred", which names neither the page nor the
 * cause — the operator sees a blank screen and the detail only exists in the
 * browser console.
 *
 * This keeps the failure inside the shell, shows the actual message, and
 * offers a retry that re-renders the segment rather than forcing a full reload
 * (which would lose the session state the shell already holds).
 */
export default function AppError({ error, reset }) {
  useEffect(() => {
    // Surfaces the real stack in the console for anyone reading it.
    console.error("CMS page error:", error);
  }, [error]);

  return (
    <div className="py-16">
      <div className="mx-auto max-w-lg rounded-md border border-[#F5D9D6] bg-red-wash px-5 py-6 text-red-deep">
        <div className="mb-3 flex items-center gap-2.5">
          <AlertTriangle size={18} className="shrink-0" />
          <h1 className="text-[15px] font-semibold">Something went wrong on this page</h1>
        </div>

        <p className="mb-4 text-[12.5px] leading-relaxed">
          The page failed to render. Your data is unaffected — nothing was saved or
          changed by this error.
        </p>

        {error?.message && (
          <pre className="mb-4 max-h-40 overflow-auto rounded border border-[#F5D9D6] bg-white/60 px-3 py-2 text-[11.5px] leading-snug whitespace-pre-wrap">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="danger" size="sm" onClick={() => reset()}>
            <RotateCcw size={14} /> Try again
          </Button>
          <Link href="/orders" className={button({ variant: "ghost", size: "sm" })}>
            Back to Orders
          </Link>
        </div>
      </div>
    </div>
  );
}
