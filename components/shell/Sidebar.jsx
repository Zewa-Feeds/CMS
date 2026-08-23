"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import * as Icons from "lucide-react";
import { NAV } from "@/lib/nav";
import { useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";

function Icon({ name, ...props }) {
  const C = Icons[name] || Icons.Circle;
  return <C {...props} />;
}

export function Sidebar({ open, onClose, counts }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Server-issued permission list; the API enforces the same keys independently.
  const permissions = useAuth((s) => s.permissions);
  const [expanded, setExpanded] = useState(() => {
    // open the group containing the current route by default
    const init = {};
    NAV.forEach((n) => {
      if (n.sub?.some((s) => pathname.startsWith(s.href.split("?")[0]))) init[n.label] = true;
    });
    return init;
  });

  const visible = NAV.filter((n) => !n.perm || permissions.includes(n.perm));

  const isActive = (href) => {
    const base = href.split("?")[0];
    if (base === "/") return pathname === "/";
    return pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <>
      {/* mobile scrim */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-navy/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-navy transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-[57px] shrink-0 items-center gap-2.5 border-b border-navy-3 px-4">
          {/* brightness-0 invert renders the dark-ink source PNG white for this dark rail. */}
          <Image
            src="/logo.png"
            alt=""
            width={96}
            height={96}
            className="h-7 w-auto shrink-0 object-contain brightness-0 invert"
          />
          <div className="whitespace-nowrap text-[14.5px] font-semibold tracking-[-.01em] text-white">
            Zewa Feeds
          </div>
        </div>

        <nav className="nav-scroll flex-1 overflow-y-auto overflow-x-hidden p-2.5" aria-label="Main">
          {visible.map((n) => {
            const active = isActive(n.href);
            const hasSub = !!n.sub;
            const isOpen = expanded[n.label];
            const badge = n.badgeKey ? counts?.[n.badgeKey] : 0;
            return (
              <div key={n.label}>
                {hasSub ? (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [n.label]: !e[n.label] }))}
                    className={cn(
                      "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-navy-text hover:bg-navy-2 hover:text-white",
                      active && "bg-navy-2 text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute -left-2.5 top-1/2 h-[17px] w-[3px] -translate-y-1/2 rounded-r bg-teal" />
                    )}
                    <Icon name={n.icon} size={17} strokeWidth={1.7} className="shrink-0" />
                    <span className="flex-1 truncate">{n.label}</span>
                    {badge > 0 && (
                      <span className="rounded-full bg-amber px-1.5 font-mono text-[10.5px] font-medium leading-normal text-[#3A2703]">
                        {badge}
                      </span>
                    )}
                    <Icons.ChevronRight
                      size={13}
                      className={cn("shrink-0 opacity-60 transition-transform", isOpen && "rotate-90")}
                    />
                  </button>
                ) : (
                  <Link
                    href={n.href}
                    onClick={onClose}
                    className={cn(
                      "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-navy-text hover:bg-navy-2 hover:text-white",
                      active && "bg-navy-2 text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute -left-2.5 top-1/2 h-[17px] w-[3px] -translate-y-1/2 rounded-r bg-teal" />
                    )}
                    <Icon name={n.icon} size={17} strokeWidth={1.7} className="shrink-0" />
                    <span className="flex-1 truncate">{n.label}</span>
                    {badge > 0 && (
                      <span className="rounded-full bg-amber px-1.5 font-mono text-[10.5px] font-medium leading-normal text-[#3A2703]">
                        {badge}
                      </span>
                    )}
                  </Link>
                )}

                {hasSub && isOpen && (
                  <div className="flex flex-col pb-1 pl-[38px] pt-0.5">
                    {n.sub
                      .filter((s) => !s.perm || permissions.includes(s.perm))
                      .map((s) => {
                        const [subPath, subQuery = ""] = s.href.split("?");
                        const subActive =
                          pathname === subPath && (search || "") === subQuery;
                        const subCount = s.countKey ? counts?.orderCounts?.[s.countKey] : undefined;
                        return (
                          <Link
                            key={s.href}
                            href={s.href}
                            onClick={onClose}
                            className={cn(
                              "flex items-center justify-between rounded-md px-2.5 py-[5px] text-[12.5px] text-navy-text hover:bg-navy-2 hover:text-white",
                              subActive && "text-teal"
                            )}
                          >
                            <span className="truncate">{s.label}</span>
                            {typeof subCount === "number" && (
                              <span
                                className={cn(
                                  "ml-2 font-mono text-[11px] text-navy-text opacity-70",
                                  s.countKey === "pending" && subCount > 0 && "font-semibold text-amber opacity-100",
                                  s.countKey === "cancelled" && subCount > 0 && "text-[#F87171] opacity-90",
                                  subActive && "text-teal opacity-100"
                                )}
                              >
                                ({subCount})
                              </span>
                            )}
                          </Link>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
