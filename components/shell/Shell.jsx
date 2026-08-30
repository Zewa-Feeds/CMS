"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAuth, useData } from "@/lib/store";
import * as api from "@/lib/api";

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

  /*
   * ONLY a confirmed sign-out redirects.
   *
   * "offline" means the API could not be reached, which says nothing about
   * whether the session is still good — so it must not land on /login. It
   * retries instead, and recovers on its own when the API comes back.
   */
  useEffect(() => {
    if (status === "out") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "offline") return;
    const timer = setTimeout(() => void restore(), 3000);
    return () => clearTimeout(timer);
  }, [status, restore]);

  // A sibling tab signing in or renewing is reason enough to try again here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const retry = () => {
      const s = useAuth.getState().status;
      if (s === "offline" || s === "out") void restore();
    };
    const unsubscribe = api.session.onRenewed(retry);
    window.addEventListener("online", retry);
    return () => {
      unsubscribe();
      window.removeEventListener("online", retry);
    };
  }, [restore]);

  useEffect(() => {
    if (status === "in") void loadDashboard().catch(() => undefined);
  }, [status, loadDashboard]);

  if (status !== "in") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6 text-center text-[13px] text-muted">
        {status === "restoring" && "Loading…"}
        {status === "offline" && (
          <div className="space-y-2">
            <p>Can&rsquo;t reach the server.</p>
            <p className="text-muted">
              You are still signed in — retrying automatically.
            </p>
            <button
              type="button"
              onClick={() => void restore()}
              className="underline underline-offset-2"
            >
              Retry now
            </button>
          </div>
        )}
        {status === "out" && "Redirecting to sign-in…"}
        {status !== "restoring" && status !== "offline" && status !== "out" && "Loading…"}
      </div>
    );
  }

  const counters = dashboard.data?.counters ?? {};
  const counts = {
    pendingOrders: counters.pendingOrders ?? 0,
    lowStock: counters.lowStockProducts ?? 0,
    pendingReviews: counters.pendingReviews ?? 0,
    orderCounts: counters.orderCounts ?? {
      all: 0,
      pending: counters.pendingOrders ?? 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    },
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
