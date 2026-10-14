"use client";

import { useCallback, useEffect, useState } from "react";
import { Hammer, RefreshCw, RotateCcw } from "lucide-react";
import { site as siteApi } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { RoleGate } from "@/components/shell/RoleGate";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ConfirmModal, InfoBox } from "@/components/ui/Modal";
import { TableWrap, Table, Th, Td, Tr, CellSub, EmptyState, Pager } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";

const STATUS = {
  QUEUED: { tone: "grey", label: "Queued" },
  DEPLOYING: { tone: "amber", label: "Regenerating" },
  LIVE: { tone: "green", label: "Live" },
  FAILED: { tone: "red", label: "Failed" },
  SUPERSEDED: { tone: "grey", label: "Superseded" },
};

const scopeLabel = (s) =>
  s.startsWith("article:") ? `article “${s.slice(8)}”` : { home: "homepage", products: "products page", blog: "blog", about: "about page", articles: "article list" }[s] ?? s;

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export default function PublishingPage() {
  return (
    <RoleGate perm="site.edit">
      <Publishing />
    </RoleGate>
  );
}

function Publishing() {
  const { push } = useToast();
  const canPublish = useAuth((s) => s.permissions).includes("site.publish");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, version }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRes(await siteApi.publications(page));
    } catch (err) {
      push(err.message, { bad: true });
    }
  }, [page, push]);

  useEffect(() => {
    void load();
  }, [load]);

  // While anything is in flight, keep the status honest without a manual refresh.
  const inFlight = res?.data.some((p) => p.status === "QUEUED" || p.status === "DEPLOYING");
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [inFlight, load]);

  const act = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      push(ok);
      await load();
    } catch (err) {
      push(err.message, { bad: true });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const current = res?.data.find((p) => p.isCurrent);

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Publishing" }]} />
      <PageHeader
        title="Publishing"
        sub="Every website version, newest first. “Live” means the storefront was observed serving it — not just that the request was sent."
        actions={
          canPublish && (
            <Button onClick={() => setConfirm({ kind: "rebuild" })} disabled={busy || !res?.deployHookConfigured}>
              <Hammer size={15} /> Full rebuild
            </Button>
          )
        }
      />

      <div className="mb-4">
        <InfoBox>
          A failed regeneration never takes the site down: customers keep seeing the previous pages until a new version is
          confirmed. Rollback restores the website sections (hero, banners, placements, About page) exactly as that version
          had them; articles keep their current published state.
          {!res?.deployHookConfigured && " Full rebuild is unavailable until STOREFRONT_DEPLOY_HOOK_URL is set on the API."}
        </InfoBox>
      </div>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Version</Th>
              <Th>Status</Th>
              <Th>Changed</Th>
              <Th>Published</Th>
              <Th>Live since</Th>
              <Th right>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {res?.data.map((p) => {
              const st = STATUS[p.status] ?? STATUS.QUEUED;
              return (
                <Tr key={p.id}>
                  <Td>
                    <span className="font-mono font-semibold">v{p.version}</span>
                    {p.isCurrent && <Pill tone="teal" dot={false} className="ml-2">current</Pill>}
                    {p.note && <CellSub>{p.note}</CellSub>}
                    {p.rolledBackFrom && <CellSub>restores v{p.rolledBackFrom}</CellSub>}
                  </Td>
                  <Td>
                    <Pill tone={st.tone}>{st.label}</Pill>
                    {p.method && <CellSub>{p.method === "deploy-hook" ? "full rebuild" : "targeted"}{p.attempts > 1 ? ` · ${p.attempts} attempts` : ""}</CellSub>}
                    {p.lastError && <div className="mt-1 max-w-[340px] text-[11.5px] text-red-deep">{p.lastError}</div>}
                  </Td>
                  <Td>
                    <div className="max-w-[300px] text-[12.5px]">{p.scopes.slice(0, 6).map(scopeLabel).join(", ")}{p.scopes.length > 6 ? ` +${p.scopes.length - 6} more` : ""}</div>
                  </Td>
                  <Td>
                    {when(p.createdAt)}
                    <CellSub>{p.publishedByName}</CellSub>
                  </Td>
                  <Td>
                    {when(p.liveAt)}
                    {p.verifiedPaths?.length > 0 && <CellSub>verified on {p.verifiedPaths.length} page{p.verifiedPaths.length > 1 ? "s" : ""}</CellSub>}
                  </Td>
                  <Td right>
                    {canPublish && p.isCurrent && (p.status === "FAILED" || p.status === "QUEUED") && (
                      <Button size="sm" disabled={busy} onClick={() => act(() => siteApi.retry(p.version), `Retrying v${p.version}.`)}>
                        <RefreshCw size={13} /> Retry
                      </Button>
                    )}
                    {canPublish && !p.isCurrent && (
                      <Button size="sm" disabled={busy} onClick={() => setConfirm({ kind: "rollback", version: p.version })}>
                        <RotateCcw size={13} /> Roll back to this
                      </Button>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
        {res && res.data.length === 0 && <EmptyState title="Nothing published yet">Publish from Content → Website.</EmptyState>}
      </TableWrap>
      {res && (
        <div className="mt-4">
          <Pager page={res.meta.page} pages={res.meta.pages} total={res.meta.total} onPage={setPage} unit="versions" />
        </div>
      )}

      <ConfirmModal
        open={confirm?.kind === "rollback"}
        onClose={() => setConfirm(null)}
        title={`Roll back to v${confirm?.version}?`}
        confirmLabel="Roll back"
        message={`Creates a new version that restores v${confirm?.version}’s website sections, and resets the draft to match. Current version: v${current?.version ?? "—"}.`}
        onConfirm={() => act(() => siteApi.rollback(confirm.version), `Rolled back to v${confirm.version}. Regenerating.`)}
      />
      <ConfirmModal
        open={confirm?.kind === "rebuild"}
        onClose={() => setConfirm(null)}
        title="Trigger a full storefront rebuild?"
        confirmLabel="Rebuild"
        message="Rebuilds every page from the current version. Takes several minutes; the live site keeps serving until the new build succeeds."
        onConfirm={() => act(() => siteApi.rebuild(), "Full rebuild triggered.")}
      />
    </>
  );
}
