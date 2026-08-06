"use client";

import { useEffect } from "react";
import { ChevronUp, ChevronDown, Image as ImageIcon } from "lucide-react";
import { useData } from "@/lib/store";
import { Breadcrumbs, PageHeader } from "@/components/ui/Page";
import { Card, CardHead, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Switch } from "@/components/ui/Field";
import { InfoBox } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export default function BannersPage() {
  const { data, loading, error } = useData((s) => s.spotlights);
  const loadSpotlights = useData((s) => s.loadSpotlights);
  const toggleSpotlight = useData((s) => s.toggleSpotlight);
  const reorderSpotlights = useData((s) => s.reorderSpotlights);
  const toast = useToast();

  useEffect(() => {
    void loadSpotlights().catch(() => undefined);
  }, [loadSpotlights]);

  const banners = data ?? [];

  /**
   * Reorder sends the FULL ordered id list, so the operation is idempotent — a
   * dropped request cannot leave positions half-applied.
   */
  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const next = [...banners];
    [next[i], next[j]] = [next[j], next[i]];
    try {
      await reorderSpotlights(next.map((b) => b.id));
      await loadSpotlights();
    } catch (err) {
      toast.push(err.message, { bad: true });
    }
  };

  return (
    <>
      <Breadcrumbs parts={[{ label: "Dashboard", href: "/" }, { label: "Content", href: "/content/articles" }, { label: "Banners" }]} />
      <PageHeader title="Spotlight Banners" sub="Up to 3 products featured on the products listing page." />

      <div className="mb-4">
        <InfoBox>Reorder with the arrows. Toggle a spotlight inactive to hide it without deleting.</InfoBox>
      </div>

      <div className="flex flex-col gap-3">
        {banners.map((b, i) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center gap-4 p-4">
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronUp size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={i === banners.length - 1} onClick={() => move(i, 1)}>
                  <ChevronDown size={15} />
                </Button>
              </div>
              <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-line bg-grey-wash text-muted-2">
                <ImageIcon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{b.prod}</span>
                  {b.badge !== "None" && <Pill tone="teal" dot={false}>{b.badge}</Pill>}
                </div>
                <div className="mt-0.5 text-[13px]">{b.tagline}</div>
                <div className="text-[12.5px] text-muted">{b.subText}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Pill tone={b.isActive ? "green" : "grey"}>{b.isActive ? "Active" : "Inactive"}</Pill>
                <Switch
                  checked={b.isActive}
                  onChange={async () => {
                    try {
                      // §8.2 caps active spotlights at 3; the server rejects a 4th.
                      await toggleSpotlight(b.id);
                      toast.push(`Spotlight ${b.isActive ? "hidden" : "shown"}.`);
                      await loadSpotlights();
                    } catch (err) {
                      toast.push(err.message, { bad: true });
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
