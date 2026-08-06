"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Clock, PackageX, Star, ChevronRight, ArrowUpRight } from "lucide-react";
import { useData } from "@/lib/store";
import { PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";

/**
 * Dashboard (§4).
 *
 * Deliberately lightweight — §4 removed revenue tiles and charts in v2.0. Three
 * counters plus an activity feed, all from `GET /admin/dashboard`.
 *
 * The feed replaces the old hardcoded ACTIVITY array and is derived server-side
 * from the audit log plus recent orders, filtered by the caller's permissions.
 */

/** §17.2 tone → the accent colour for an activity dot. */
const TONE_COLOUR = {
  green: "#34D399",
  amber: "#F59E0B",
  red: "#F87171",
  blue: "#60A5FA",
  teal: "#44E5C2",
  grey: "#7E8EA4",
};

function Counter({ href, icon: Icon, tone, n, label, loading }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-lg border border-line bg-card p-4 shadow-card transition-all hover:-translate-y-px hover:border-[#CFD6E0]"
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]"
        style={{ background: `${tone}1f`, color: tone }}
      >
        <Icon size={19} />
      </span>
      <span>
        <span className="block font-mono text-[27px] font-medium leading-none tracking-[-.03em]">
          {loading ? "—" : n}
        </span>
        <span className="mt-1 block text-[12.5px] text-muted">{label}</span>
      </span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-muted-2" />
    </Link>
  );
}

/** Relative time, matching the mock's "12 min ago" feel. */
function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { data, loading, error } = useData((s) => s.dashboard);
  const loadDashboard = useData((s) => s.loadDashboard);

  /**
   * The Shell already loads the dashboard for the sidebar badges, and both share
   * the same store slice. Fetching again here would double a ~700ms round trip on
   * every visit, so only fetch when the slice is genuinely empty — i.e. a direct
   * hit on /dashboard before the Shell's effect has resolved.
   */
  useEffect(() => {
    if (data === null && !loading) void loadDashboard().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counters = data?.counters ?? {};
  const activity = data?.activity ?? [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        sub="A lightweight operational snapshot. Detailed analytics live in the CRM."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-line bg-red-wash px-4 py-3 text-[13px] text-red-deep">
          {error}
        </div>
      )}

      <div className="mb-[18px] grid gap-3.5 sm:grid-cols-3">
        <Counter
          href="/orders?status=Pending"
          icon={Clock}
          tone="#F59E0B"
          n={counters.pendingOrders ?? 0}
          label="Pending orders"
          loading={loading && !data}
        />
        <Counter
          href="/products?stock=Low/Out"
          icon={PackageX}
          tone="#F87171"
          n={counters.lowStockProducts ?? 0}
          label="Low / out of stock"
          loading={loading && !data}
        />
        <Counter
          href="/reviews"
          icon={Star}
          tone="#44E5C2"
          n={counters.pendingReviews ?? 0}
          label="Pending reviews"
          loading={loading && !data}
        />
      </div>

      <Card>
        <CardHead>
          <CardTitle>Recent Activity</CardTitle>
          <span className="ml-auto font-mono text-[11px] text-muted-2">
            {activity.length > 0 ? `Last ${activity.length} events` : ""}
          </span>
        </CardHead>
        <div>
          {loading && !data ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted">Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted">
              Nothing has happened yet.
            </div>
          ) : (
            activity.map((a, i) => (
              <div
                key={`${a.at}-${i}`}
                className="flex items-start gap-3 border-b border-line-soft px-4 py-[11px] last:border-b-0"
              >
                <span
                  className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: TONE_COLOUR[a.tone] ?? TONE_COLOUR.grey }}
                />
                <div className="min-w-0 flex-1">
                  {/* Plain text, not HTML — the server sends no markup here. */}
                  <div className="text-[13px] leading-snug">{a.text}</div>
                  <div className="mt-0.5 font-mono text-[11.5px] text-muted-2">
                    {a.actor} · {timeAgo(a.at)}
                  </div>
                </div>
                {a.href && (
                  <Link
                    href={a.href}
                    className="mt-0.5 flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-teal-deep hover:underline"
                  >
                    View <ArrowUpRight size={13} />
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}
