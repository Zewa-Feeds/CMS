"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X, Eye, CheckCheck, Star, RefreshCw } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill, Stars } from "@/components/ui/Pill";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState, useSortableTable } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";

/** Tab label -> the enum the API filters on. */
const STATE_ENUM = { Pending: "PENDING", Approved: "APPROVED", Rejected: "REJECTED" };

export default function ReviewsPage() {
  const { data, meta, loading, error } = useData((s) => s.reviews);
  const loadReviews = useData((s) => s.loadReviews);
  const setReviewState = useData((s) => s.setReviewState);
  const approveAllPending = useData((s) => s.approveAllPending);
  const toast = useToast();
  const [tab, setTab] = useState("Pending");
  const [view, setView] = useState(null);

  /**
   * Tab counts come from the server (`meta.counts`) rather than being derived
   * from the loaded page — a filtered page cannot know the other tabs' totals.
   */
  const refetch = useCallback(
    () => loadReviews({ state: STATE_ENUM[tab], limit: 100 }).catch(() => undefined),
    [loadReviews, tab],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const serverCounts = meta?.counts ?? {};
  const counts = {
    Pending: serverCounts.PENDING ?? 0,
    Approved: serverCounts.APPROVED ?? 0,
    Rejected: serverCounts.REJECTED ?? 0,
  };

  const rows = data ?? [];
  const {
    sortedItems: sortedRows,
    sortKey,
    sortDir,
    toggleSort,
  } = useSortableTable(
    rows,
    { key: null, dir: "asc" },
    {
      prod: (r) => r.prod || "",
      cust: (r) => r.cust || r.email || "",
      rating: (r) => r.rating ?? 0,
      excerpt: (r) => r.body || "",
      verified: (r) => (r.vp ? 1 : 0),
    }
  );

  /** The server writes the audit entry, so no client-side logging here. */
  const setState = async (r, state, verb) => {
    try {
      await setReviewState(r.id, STATE_ENUM[state] ?? state);
      toast.push(`Review ${verb.toLowerCase()}.`);
      await refetch();
    } catch (err) {
      toast.push(err.message, { bad: true });
    }
  };

  return (
    <RoleGate perm="reviews.moderate">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Reviews" }]} />
      <PageHeader
        title="Reviews Moderation"
        sub="All reviews wait in the queue before appearing on the site."
        actions={
          <div className="flex items-center gap-2">
            {/*
              Always available, including when the list failed to load — a
              transient API error left the page showing only "Database error"
              with no way to try again short of a full reload.
            */}
            <Button
              variant="ghost"
              disabled={loading}
              onClick={async () => {
                await refetch();
              }}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            {tab === "Pending" && counts.Pending > 0 && (
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    const result = await approveAllPending();
                    toast.push(`Approved ${result.approved} review${result.approved === 1 ? "" : "s"}.`);
                    await refetch();
                  } catch (err) {
                    toast.push(err.message, { bad: true });
                  }
                }}
              >
                <CheckCheck size={15} /> Approve All Visible
              </Button>
            )}
          </div>
        }
      />

      <Tabs
        tabs={[
          { key: "Pending", label: "Pending", count: counts.Pending },
          { key: "Approved", label: "Approved", count: counts.Approved },
          { key: "Rejected", label: "Rejected", count: counts.Rejected },
        ]}
        value={tab}
        onChange={setTab}
      />

      <Card>
        {/*
          `data === null` means the first fetch has not resolved. Showing the empty
          state then would read as "nothing here" when rows are still in flight.
        */}
        {error ? (
          /*
            A failed load used to be a dead end: the message alone, with no way
            to retry short of reloading the page. The commonest cause is a
            transient API blip, which a second attempt clears.
          */
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-[13px] text-red-deep">{error}</p>
            <Button variant="ghost" disabled={loading} onClick={() => void refetch()}>
              <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
              {loading ? "Retrying…" : "Try again"}
            </Button>
          </div>
        ) : data === null ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Star} title={`No ${tab.toLowerCase()} reviews`}>
            {tab === "Pending" ? "The queue is clear — nice work." : `Nothing here yet.`}
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th
                    sortable
                    active={sortKey === "prod"}
                    dir={sortDir}
                    onSort={() => toggleSort("prod", "asc")}
                  >
                    Product
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "cust"}
                    dir={sortDir}
                    onSort={() => toggleSort("cust", "asc")}
                  >
                    Customer
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "rating"}
                    dir={sortDir}
                    onSort={() => toggleSort("rating", "desc")}
                  >
                    Rating
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "excerpt"}
                    dir={sortDir}
                    onSort={() => toggleSort("excerpt", "asc")}
                  >
                    Excerpt
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "verified"}
                    dir={sortDir}
                    onSort={() => toggleSort("verified", "desc")}
                  >
                    Verified
                  </Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium">{r.prod}</Td>
                    <Td>
                      <div>{r.cust}</div>
                      <CellSub>{r.email}</CellSub>
                    </Td>
                    <Td><Stars n={r.rating} /></Td>
                    <Td className="max-w-[280px]">
                      <span className="line-clamp-2 text-[12.5px] text-muted">{r.body}</span>
                    </Td>
                    <Td>{r.vp ? <Pill tone="green">Verified</Pill> : <Pill tone="grey">No</Pill>}</Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="View full" onClick={() => setView(r)}>
                          <Eye size={14} />
                        </Button>
                        {r.state !== "Approved" && (
                          <Button variant="ghost" size="icon-sm" title="Approve" onClick={() => setState(r, "Approved", "Approved")}>
                            <Check size={14} className="text-green-deep" />
                          </Button>
                        )}
                        {r.state !== "Rejected" && (
                          <Button variant="ghost" size="icon-sm" title="Reject" onClick={() => setState(r, "Rejected", "Rejected")}>
                            <X size={14} className="text-red-deep" />
                          </Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={!!view}
        onClose={() => setView(null)}
        wide
        title={view?.prod}
        sub={view && `${view.cust} · ${view.at}`}
        footer={
          view && (
            <>
              <Button variant="danger" onClick={() => { setState(view, "Rejected", "Rejected"); setView(null); }}>
                <X size={15} /> Reject
              </Button>
              <Button variant="primary" onClick={() => { setState(view, "Approved", "Approved"); setView(null); }}>
                <Check size={15} /> Approve
              </Button>
            </>
          )
        }
      >
        {view && (
          <div className="space-y-3 pb-2">
            <div className="flex items-center gap-2">
              <Stars n={view.rating} />
              {view.vp && <Pill tone="green">Verified purchase</Pill>}
            </div>
            <p className="text-[13.5px] leading-relaxed">{view.body}</p>
          </div>
        )}
      </Modal>
    </RoleGate>
  );
}
