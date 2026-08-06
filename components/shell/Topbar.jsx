"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Search, ChevronDown, User, KeyRound, LogOut } from "lucide-react";
import { useAuth, useData } from "@/lib/store";
import { ROLES } from "@/lib/rbac";
import { initials } from "@/lib/utils";
import { ChangePasswordModal } from "./ChangePasswordModal";

function useClickOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

/**
 * Top bar (§3.1).
 *
 * Two changes from the mock version:
 *
 *  - **The role switcher is gone.** It let a user change their own role in the
 *    browser. Role now comes from the JWT, and the badge is read-only.
 *  - **Search hits the server** (`GET /admin/search`), so results are filtered by
 *    the caller's permissions — an Editor's search returns products only, never
 *    customer PII.
 */
export function Topbar({ onMenu }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const roleKey = useAuth((s) => s.role);
  const logout = useAuth((s) => s.logout);
  const globalSearch = useData((s) => s.globalSearch);

  const [userOpen, setUserOpen] = useState(false);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const userRef = useRef(null);
  const searchRef = useRef(null);
  useClickOutside(userRef, () => setUserOpen(false));
  useClickOutside(searchRef, () => setSearchOpen(false));

  // Debounced server search — one request per pause, not per keystroke.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await globalSearch(term);
        setResults([
          ...data.orders.map((o) => ({
            group: "Orders",
            label: o.customerName,
            meta: o.orderNo,
            href: `/orders/${o.orderNo}`,
          })),
          ...data.customers.map((c) => ({
            group: "Customers",
            label: c.name,
            meta: c.email,
            href: `/customers/${c.id}`,
          })),
          ...data.products.map((p) => ({
            group: "Products",
            label: p.name,
            meta: p.sku ?? "",
            href: `/products/${p.slug}/edit`,
          })),
        ]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, globalSearch]);

  const go = (href) => {
    setQ("");
    setSearchOpen(false);
    router.push(href);
  };

  const roleMeta = roleKey ? ROLES[roleKey] : null;
  const avatar = user?.name ? initials(user.name) : "–";

  return (
    <header className="sticky top-0 z-20 flex h-[57px] items-center gap-3.5 border-b border-line bg-canvas/90 px-5 backdrop-blur">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="grid place-items-center rounded-lg border border-line bg-card p-[7px] lg:hidden"
      >
        <Menu size={16} />
      </button>

      {/* Read-only role badge — the switcher was removed deliberately. */}
      {roleMeta && (
        <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card py-[5px] px-[11px] text-[12.5px] font-medium">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: roleMeta.dot }} />
          {roleMeta.name}
        </div>
      )}

      {/* Global search (§3.1) */}
      <div className="relative mx-auto hidden max-w-[440px] flex-1 sm:block" ref={searchRef}>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
        />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search orders, customers, products…"
          aria-label="Global search"
          autoComplete="off"
          className="w-full rounded-md border border-line bg-card py-2 pl-9 pr-3 text-[13px] placeholder:text-muted-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-deep"
        />
        {searchOpen && q.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-[340px] overflow-y-auto rounded-lg border border-line bg-card shadow-pop">
            {searching && !results ? (
              <div className="px-3.5 py-4 text-[13px] text-muted">Searching…</div>
            ) : !results?.length ? (
              <div className="px-3.5 py-4 text-[13px] text-muted">No matches for “{q}”.</div>
            ) : (
              results.map((r, i) => {
                const firstOfGroup = i === 0 || results[i - 1].group !== r.group;
                return (
                  <div key={`${r.group}-${r.meta}-${i}`}>
                    {firstOfGroup && (
                      <div className="bg-canvas px-3.5 pb-1.5 pt-2.5 font-mono text-[10px] uppercase tracking-[.13em] text-muted-2">
                        {r.group}
                      </div>
                    )}
                    <button
                      onClick={() => go(r.href)}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] hover:bg-canvas"
                    >
                      <span className="flex-1 truncate">{r.label}</span>
                      <span className="ml-auto truncate font-mono text-[11.5px] text-muted-2">
                        {r.meta}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative ml-auto sm:ml-0" ref={userRef}>
        <button
          onClick={() => setUserOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-2.5 hover:border-line hover:bg-card"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11.5px] font-semibold text-teal">
            {avatar}
          </span>
          <ChevronDown size={13} className="text-muted-2" />
        </button>
        {userOpen && (
          <div className="absolute right-0 top-[calc(100%-2px)] z-40 min-w-[200px] rounded-md border border-line bg-card p-1.5 shadow-pop">
            <div className="px-2 pb-1.5 pt-2">
              <div className="text-[13px] font-medium">{user?.name}</div>
              <div className="text-[11.5px] text-muted-2">{user?.email}</div>
            </div>
            <hr className="my-1.5 border-line-soft" />
            <Link
              href="/profile"
              onClick={() => setUserOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] hover:bg-canvas"
            >
              <User size={15} className="text-muted" /> My Profile
            </Link>
            <button
              onClick={() => {
                setUserOpen(false);
                setPwOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] hover:bg-canvas"
            >
              <KeyRound size={15} className="text-muted" /> Change Password
            </button>
            <hr className="my-1.5 border-line-soft" />
            <button
              onClick={async () => {
                await logout();
                router.push("/login");
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[13px] text-red-deep hover:bg-red-wash"
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        )}
      </div>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}
