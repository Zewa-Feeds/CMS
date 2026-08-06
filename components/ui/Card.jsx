import { cn } from "@/lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-lg border border-line bg-card shadow-card", className)}
      {...props}
    />
  );
}

export function CardHead({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3.5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, ...props }) {
  return (
    <h2 className={cn("text-[14.5px] font-semibold tracking-[-.01em]", className)} {...props} />
  );
}

export function CardBody({ className, ...props }) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFoot({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-t border-line-soft px-4 py-3",
        className
      )}
      {...props}
    />
  );
}
