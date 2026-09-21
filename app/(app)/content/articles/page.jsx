"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Plus, Pencil, Upload, Trash2, FileText } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill, Chip } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  TableWrap,
  Table,
  Th,
  Td,
  Tr,
  CellSub,
  EmptyState,
  useSortableTable,
} from "@/components/ui/Table";

/** CMS label -> the ContentStatus enum. */
const STATUS_ENUM = { Draft: "DRAFT", Published: "PUBLISHED" };

export default function ArticlesPage() {
  const permissions = useAuth((s) => s.permissions);
  const { data, meta, loading, error } = useData((s) => s.articles);
  const loadArticles = useData((s) => s.loadArticles);
  const publishArticle = useData((s) => s.publishArticle);
  const deleteArticle = useData((s) => s.deleteArticle);
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [del, setDel] = useState(null);

  const refetch = useCallback(
    () =>
      loadArticles({
        q: q.trim() || undefined,
        status: status === "All" ? undefined : STATUS_ENUM[status] ?? status,
        limit: 100,
      }).catch(() => undefined),
    [loadArticles, q, status],
  );

  // The FIRST load must not wait for the debounce — a 250ms delay on mount is
  // pure latency on top of an already ~1s round trip. Only subsequent changes
  // (typing in the search box, flipping a filter) are debounced.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      void refetch();
      return;
    }
    const timer = setTimeout(() => void refetch(), 250);
    return () => clearTimeout(timer);
  }, [refetch]);

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
      title: (a) => a.title || "",
      tag: (a) => a.tag || "",
      read: (a) => a.read ?? 0,
      status: (a) => a.statusLabel || a.status || "",
      updatedAt: (a) => (a.updatedAt ? new Date(a.updatedAt).getTime() : 0),
    }
  );

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Blog Articles" }]} />
      <PageHeader
        title="Blog Articles"
        sub={`${meta?.total ?? rows.length} articles`}
        actions={
          <Link href="/content/articles/new" className={button({ variant: "primary" })}>
            <Plus size={15} /> Add Article
          </Link>
        }
      />

      <Card>
        <FilterBar>
          <SearchInput className="min-w-[220px] flex-1" placeholder="Search articles…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            {["All", "Published", "Draft"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
            ))}
          </Select>
        </FilterBar>

        {/*
          `data === null` means the first fetch has not resolved. Showing the empty
          state then would read as "nothing here" when rows are still in flight.
        */}
        {error ? (
          <div className="px-4 py-12 text-center text-[13px] text-red-deep">{error}</div>
        ) : data === null ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={FileText} title="No articles yet" action={<Link href="/content/articles/new" className={button({ variant: "primary" })}><Plus size={15} /> Write your first article</Link>}>
            Blog articles help customers understand your science and boost SEO.
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th
                    sortable
                    active={sortKey === "title"}
                    dir={sortDir}
                    onSort={() => toggleSort("title", "asc")}
                  >
                    Title
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "tag"}
                    dir={sortDir}
                    onSort={() => toggleSort("tag", "asc")}
                  >
                    Tag
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "read"}
                    dir={sortDir}
                    onSort={() => toggleSort("read", "desc")}
                  >
                    Read
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "status"}
                    dir={sortDir}
                    onSort={() => toggleSort("status", "asc")}
                  >
                    Status
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "updatedAt"}
                    dir={sortDir}
                    onSort={() => toggleSort("updatedAt", "desc")}
                  >
                    Last Updated
                  </Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((a) => (
                  <Tr key={a.slug}>
                    <Td>
                      <div className="font-medium">{a.title}</div>
                      <CellSub><span className="mono">{a.slug}</span></CellSub>
                    </Td>
                    <Td><Chip>{a.tag}</Chip></Td>
                    <Td><span className="mono text-[12.5px]">{a.read} min</span></Td>
                    <Td><Pill tone={a.status === "PUBLISHED" ? "green" : "grey"}>{a.statusLabel}</Pill></Td>
                    <Td>
                      <div className="text-[13px]">{new Date(a.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      <CellSub>{a.by}</CellSub>
                    </Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/content/articles/${a.slug}/edit`} className={button({ variant: "ghost", size: "icon-sm" })} title="Edit">
                          <Pencil size={14} />
                        </Link>
                        {permissions.includes("articles.publish") && a.status === "DRAFT" && (
                          <Button variant="ghost" size="icon-sm" title="Publish" onClick={async () => {
                            try {
                              await publishArticle(a.slug);
                              toast.push("Article published.");
                              await refetch();
                            } catch (err) {
                              toast.push(err.message, { bad: true });
                            }
                          }}>
                            <Upload size={14} className="text-teal-deep" />
                          </Button>
                        )}
                        {permissions.includes("articles.delete") && (
                          <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => setDel(a)}>
                            <Trash2 size={14} className="text-muted" />
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

      <ConfirmModal
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          try {
            await deleteArticle(del.slug);
            toast.push("Article deleted.");
            setDel(null);
            await refetch();
          } catch (err) {
            toast.push(err.message, { bad: true });
          }
        }}
        title="Delete this article?"
        confirmLabel="Delete article"
        message={del && <>This permanently removes <b>{del.title}</b>. This cannot be undone.</>}
      />
    </>
  );
}
