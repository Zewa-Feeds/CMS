"use client";

import { useCallback, useEffect, useState, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, Eye, Upload, ExternalLink, Pencil, PackageSearch, ArrowUpDown } from "lucide-react";
import { useData, useAuth } from "@/lib/store";
import { CATEGORIES, catColor, PROD_STATUS_PILL, PRODUCT_STATUSES } from "@/lib/constants";

/** CMS status label -> the enum the API expects. */
const STATUS_ENUM = {
  Draft: "DRAFT",
  Active: "ACTIVE",
  "Coming Soon": "COMING_SOON",
  Discontinued: "DISCONTINUED",
};
import { stockStatus } from "@/lib/utils";
import { Breadcrumbs, PageHeader, FilterBar, SearchInput } from "@/components/ui/Page";
import { Card } from "@/components/ui/Card";
import { Button, button } from "@/components/ui/Button";
import { Pill, Thumb } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Field";
import {
  TableWrap,
  Table,
  Th,
  Td,
  Tr,
  CellSub,
  EmptyState,
} from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";
import { StockModal } from "@/components/products/StockModal";
import { DisplayOrderPanel } from "@/components/products/DisplayOrderPanel";
import { useToast } from "@/components/ui/Toast";

function StockCell({ product, onEdit, editable }) {
  const s = stockStatus(product.stock);
  const tone = s === "In Stock" ? "green" : s === "Low Stock" ? "amber" : "red";
  const label =
    s === "In Stock"
      ? `In Stock · ${product.stock}`
      : s === "Low Stock"
      ? `Low Stock — ${product.stock}`
      : "Out of Stock";
  if (!editable) return <Pill tone={tone}>{label}</Pill>;
  return (
    <button onClick={onEdit} title="Click to update stock" className="cursor-pointer">
      <Pill tone={tone}>{label}</Pill>
    </button>
  );
}

function ProductsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const permissions = useAuth((s) => s.permissions);
  const { data, meta, loading, error } = useData((s) => s.products);
  const loadProducts = useData((s) => s.loadProducts);
  const publishProduct = useData((s) => s.publishProduct);
  const productPreviewToken = useData((s) => s.productPreviewToken);
  const toast = useToast();
  const editable = permissions.includes("products.edit");

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  /** Slug whose preview token is being fetched, so the row's button can disable. */
  const [previewing, setPreviewing] = useState(null);
  /*
   * Catalogue-order mode.
   *
   * A mode on this screen rather than a route of its own: sequencing the
   * catalogue is product management, and the filters above make no sense
   * against a list that must be complete and in order to be draggable.
   */
  const [ordering, setOrdering] = useState(false);

  /**
   * Open the storefront preview for a product.
   *
   * The token has to be fetched first, which makes window.open() async — and a
   * popup opened after an await is blocked by default in most browsers. So the
   * tab is opened SYNCHRONOUSLY on the click and its location set once the token
   * arrives; if the browser blocked it anyway, we fall back to same-tab
   * navigation rather than failing silently.
   */
  const openPreview = async (slug) => {
    setPreviewing(slug);
    const tab = window.open("", "_blank");
    try {
      const res = await productPreviewToken(slug);
      if (!res?.url) throw new Error("The API did not return a preview URL.");
      if (tab && !tab.closed) {
        tab.location = res.url;
      } else {
        // Popup blocked — go there in this tab instead of doing nothing.
        window.location.href = res.url;
      }
    } catch (err) {
      tab?.close();
      toast.push(err.message || "Could not open the preview.", { bad: true });
    } finally {
      setPreviewing(null);
    }
  };

  // URL owns the stock filter so the dashboard's low-stock counter deep-links
  // correctly even when we are already on this route (no remount).
  const stockParam = params.get("stock");
  const stock =
    stockParam === "low" || stockParam === "Low/Out"
      ? "Low/Out"
      : stockParam === "out" || stockParam === "Out"
        ? "Out"
        : "All";

  const setStock = (next) => {
    const qs = new URLSearchParams(params.toString());
    if (next === "Low/Out") qs.set("stock", "low");
    else if (next === "Out") qs.set("stock", "out");
    else qs.delete("stock");
    const s = qs.toString();
    router.replace(s ? `/products?${s}` : "/products", { scroll: false });
  };

  const [stockEdit, setStockEdit] = useState(null); // product being stock-edited

  /**
   * Filtering happens SERVER-side (§5.1) — the API owns category, status, stock
   * and SKU search. Doing it here would only filter the current page and would
   * disagree with the dashboard's counters.
   */
  const refetch = useCallback(() => {
    // Category arrives as a display label ("Betta"); the API accepts either that
    // or the enum.
    return loadProducts({
      q: q.trim() || undefined,
      category: cat,
      status: status === "All" ? undefined : STATUS_ENUM[status] ?? status,
      stock,
      limit: 100,
    }).catch(() => undefined);
  }, [loadProducts, q, cat, status, stock]);

  // Debounced so typing in the search box does not fire a request per keystroke.
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

  return (
    <RoleGate perm="products.view">
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Products" }]} />
      <PageHeader
        title="Products"
        sub={`${meta?.total ?? rows.length} product families in the catalogue`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={ordering ? "dark" : "default"}
              onClick={() => setOrdering((v) => !v)}
              aria-pressed={ordering}
            >
              <ArrowUpDown size={15} /> Display order
            </Button>
            {editable && (
              <Link href="/products/new" className={button({ variant: "primary" })}>
                <Plus size={15} /> Add Product
              </Link>
            )}
          </div>
        }
      />

      {/*
        Shown ABOVE the table rather than replacing it, so an operator can still
        see stock and status while deciding the sequence.
      */}
      {ordering && (
        <div className="mb-4">
          <DisplayOrderPanel editable={editable} onClose={() => setOrdering(false)} />
        </div>
      )}

      <Card>
        <FilterBar>
          <SearchInput
            className="min-w-[200px] flex-1"
            placeholder="Search by name or SKU…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto">
            <option value="All">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
            {["All", ...PRODUCT_STATUSES].map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s}
              </option>
            ))}
          </Select>
          <Select value={stock} onChange={(e) => setStock(e.target.value)} className="w-auto">
            <option value="All">All stock</option>
            <option value="Low/Out">Low / Out</option>
            <option value="Out">Out of stock</option>
          </Select>
        </FilterBar>

        {/*
          `data === null` means the first fetch has not resolved yet. Showing the
          empty state then would read as "no products" when they are simply in
          flight — distinguish the two.
        */}
        {error ? (
          <EmptyState icon={PackageSearch} title="Couldn't load products">
            {error}
          </EmptyState>
        ) : data === null ? (
          <div className="px-4 py-12 text-center text-[13px] text-muted">Loading products…</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No products match">
            Try clearing the filters or search term.
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th>Last Updated</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Thumb label={p.name.split(" ").pop()} color={catColor(p.cat)} />
                        <div className="min-w-0">
                          <div className="font-medium">{p.name}</div>
                          <CellSub>
                            <span className="mono">{p.slug}</span>
                            {p.hasDraft && <span className="ml-2 text-amber-deep">· draft pending</span>}
                          </CellSub>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        <span className="h-2 w-2 rounded-full" style={{ background: catColor(p.cat) }} />
                        {p.cat}
                      </span>
                    </Td>
                    <Td>
                      <StockCell product={p} editable={editable} onEdit={() => setStockEdit(p)} />
                    </Td>
                    <Td>
                      <Pill tone={PROD_STATUS_PILL[p.status]}>{p.status}</Pill>
                    </Td>
                    <Td>
                      {/* §5.1 — date plus the CMS user who last changed it. */}
                      <div className="text-[13px]">
                        {p.updatedAt
                          ? new Date(p.updatedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </div>
                      <CellSub>{p.updatedBy ?? "—"}</CellSub>
                    </Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/products/${p.slug}/edit`}
                          className={button({ variant: "ghost", size: "icon-sm" })}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </Link>
                        {/*
                          This used to be a stub that only showed a toast reading
                          "Opening PDP preview with draft data…" and never opened
                          anything. It now mints a real preview token and opens the
                          storefront, matching the editor's Preview button.
                        */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Preview on the storefront"
                          disabled={previewing === p.slug}
                          onClick={() => openPreview(p.slug)}
                        >
                          <Eye size={14} />
                        </Button>
                        {editable && p.hasDraft && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Publish"
                            onClick={async () => {
                              try {
                                await publishProduct(p.slug);
                                toast.push(`${p.name} published.`);
                                await refetch();
                              } catch (err) {
                                toast.push(err.message, { bad: true });
                              }
                            }}
                          >
                            <Upload size={14} className="text-teal-deep" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="View on site"
                          onClick={() =>
                            window.open(
                              `${process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000"}/products/${p.slug}`,
                              "_blank",
                              "noopener",
                            )
                          }
                        >
                          <ExternalLink size={14} />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {stockEdit && (
        <StockModal
          product={stockEdit}
          onClose={() => setStockEdit(null)}
          onSaved={refetch}
        />
      )}
    </RoleGate>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsInner />
    </Suspense>
  );
}
