import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./Field";

/** Breadcrumb trail (spec §3.1). parts = [{ label, href? }] — last is current. */
export function Breadcrumbs({ parts }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
      {parts.map((p, i) => {
        const last = i === parts.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {last || !p.href ? (
              <span className={last ? "font-medium text-ink" : ""}>{p.label}</span>
            ) : (
              <Link href={p.href} className="hover:text-ink hover:underline">
                {p.label}
              </Link>
            )}
            {!last && <ChevronRight size={12} className="text-muted-2" />}
          </span>
        );
      })}
    </nav>
  );
}

/** Page title + subtitle + right-aligned actions on one row (spec §3.1). */
export function PageHeader({ title, sub, actions, className }) {
  return (
    <div className={cn("mb-[18px] flex flex-wrap items-start gap-3.5", className)}>
      <div>
        <h1 className="text-[21px] font-semibold leading-tight tracking-[-.025em]">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Filter/search bar sitting above a table. */
export function FilterBar({ children, className }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Search input with leading magnifier, for filter bars. */
export function SearchInput({ className, ...props }) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
      />
      <Input className="!py-2 pl-9" {...props} />
    </div>
  );
}
