"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { categories as categoriesApi } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { useCategories, invalidateCategories } from "@/lib/useCategories";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Switch } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { ConfirmModal } from "@/components/ui/Modal";
import { TableWrap, Table, Th, Td, Tr, EmptyState } from "@/components/ui/Table";
import { RoleGate } from "@/components/shell/RoleGate";
import { useToast } from "@/components/ui/Toast";

/**
 * Products → Categories.
 *
 * Categories are the shop's filter chips and the product form's Category
 * dropdown, in the order set here. Renaming keeps every product in the
 * category; hiding takes it off the shop and out of the dropdown for new
 * products without touching the products already in it. A category can only be
 * deleted while nothing uses it.
 */
function CategoriesInner() {
  const toast = useToast();
  const canEdit = useAuth((s) => s.permissions).includes("products.edit");
  const { all, loaded, reload } = useCategories();

  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState(null); // { code, label }
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      invalidateCategories();
      await reload();
      if (done) toast.push(done);
      return true;
    } catch (err) {
      toast.push(err.fields?.label || err.message || "Something went wrong.", { bad: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    if (await run(() => categoriesApi.create({ label }), `Added "${label}".`)) setNewLabel("");
  };

  const saveRename = async () => {
    const label = editing.label.trim();
    if (!label) return;
    if (await run(() => categoriesApi.update(editing.code, { label }), "Category renamed.")) setEditing(null);
  };

  const move = (index, delta) => {
    const order = all.map((c) => c.code);
    const [code] = order.splice(index, 1);
    order.splice(index + delta, 0, code);
    run(() => categoriesApi.reorder(order));
  };

  return (
    <>
      <Breadcrumbs
        parts={[{ label: "Dashboard", href: "/" }, { label: "Products", href: "/products" }, { label: "Categories" }]}
      />
      <PageHeader
        title="Categories"
        sub="The shop's filter chips and the product form's Category list, in this order."
      />

      {canEdit && (
        <Card className="mb-4">
          <CardBody>
            <form onSubmit={add} className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-sm flex-1"
                placeholder="New category, e.g. Freeze-Dried Treats"
                value={newLabel}
                maxLength={60}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <Button type="submit" variant="primary" disabled={busy || newLabel.trim().length < 2}>
                <Plus size={15} /> Add category
              </Button>
            </form>
            <p className="mt-2 text-[12px] text-muted">
              New categories appear on the shop straight away, even before any product is in them. Hide one
              until its products are ready.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                {canEdit && <Th className="w-[70px]">Order</Th>}
                <Th>Name</Th>
                <Th>Products</Th>
                <Th>On shop</Th>
                {canEdit && <Th right>Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {all.map((c, i) => (
                <Tr key={c.code}>
                  {canEdit && (
                    <Td>
                      <div className="flex gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Move up"
                          disabled={busy || i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Move down"
                          disabled={busy || i === all.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown size={14} />
                        </Button>
                      </div>
                    </Td>
                  )}
                  <Td>
                    {editing?.code === c.code ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          className="max-w-xs"
                          value={editing.label}
                          maxLength={60}
                          onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename();
                            if (e.key === "Escape") setEditing(null);
                          }}
                        />
                        <Button size="icon-sm" variant="ghost" aria-label="Save" disabled={busy} onClick={saveRename}>
                          <Check size={15} />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                          <X size={15} />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium">{c.label}</span>
                    )}
                  </Td>
                  <Td>{c.productCount}</Td>
                  <Td>
                    {canEdit ? (
                      <Switch
                        checked={c.isActive}
                        label={c.isActive ? "Visible" : "Hidden"}
                        onChange={(on) =>
                          run(() => categoriesApi.update(c.code, { isActive: on }), `${c.label} ${on ? "shown" : "hidden"}.`)
                        }
                      />
                    ) : (
                      <Pill tone={c.isActive ? "green" : "grey"}>{c.isActive ? "Visible" : "Hidden"}</Pill>
                    )}
                  </Td>
                  {canEdit && (
                    <Td right>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditing({ code: c.code, label: c.label })}
                        >
                          <Pencil size={13} /> Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy || c.productCount > 0}
                          title={c.productCount > 0 ? "Move or delete its products first, or hide it instead." : undefined}
                          onClick={() => setDeleting(c)}
                        >
                          <Trash2 size={13} /> Delete
                        </Button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {loaded && all.length === 0 && <EmptyState title="No categories yet" />}
      </Card>

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete "${deleting?.label}"?`}
        message="It will disappear from the shop and the product form. This can't be undone."
        confirmLabel="Delete category"
        loading={busy}
        onConfirm={async () => {
          if (await run(() => categoriesApi.remove(deleting.code), `Deleted "${deleting.label}".`)) setDeleting(null);
        }}
      />
    </>
  );
}

export default function CategoriesPage() {
  return (
    <RoleGate perm="products.view">
      <CategoriesInner />
    </RoleGate>
  );
}
