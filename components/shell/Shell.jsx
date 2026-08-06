"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth, useData } from "@/lib/store";

/**
 * Authenticated app shell.
 *
 * Two responsibilities:
 *  1. Restore the session from the httpOnly refresh cookie on first mount, and
 *     bounce to /login when that fails.
 *  2. Load the dashboard counters once, since the sidebar badges (§3.1) use them.
 *
 * The counters come from the server rather than being derived client-side — an
 * Editor must not be able to infer order volume they have no access to.
 */
export function Shell({ children }) {
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const restore = useAuth((s) => s.restore);

  const dashboard = useData((s) => s.dashboard);
  const loadDashboard = useData((s) => s.loadDashboard);

  const [navOpen, setNavOpen] = useState(false);

  // `restoring` is the initial status, so this runs before any redirect decision.
  useEffect(() => {
    if (status === "restoring") void restore();
  }, [status, restore]);

  useEffect(() => {
    if (status === "out") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "in") void loadDashboard().catch(() => undefined);
  }, [status, loadDashboard]);

  if (status !== "in") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-[13px] text-muted">
        {status === "restoring" ? "Loading…" : "Redirecting to sign-in…"}
      </div>
    );
  }

  const counters = dashboard.data?.counters ?? {};
  const counts = {
    pendingOrders: counters.pendingOrders ?? 0,
    lowStock: counters.lowStockProducts ?? 0,
    pendingReviews: counters.pendingReviews ?? 0,
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]">
      <Suspense fallback={null}>
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} counts={counts} />
      </Suspense>
      <div className="flex min-w-0 flex-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-shell px-4 pb-24 pt-5 sm:px-5" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
