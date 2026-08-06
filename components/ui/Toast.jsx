"use client";

import { createContext, useContext, useCallback, useState } from "react";
import { Check, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastCtx = createContext(null);

/** useToast().push("Saved") for success, .push("Error", { bad:true }) for error. Spec §17.1 */
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((msg, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, bad: !!opts.bad }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3200);
  }, []);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "flex max-w-[340px] animate-toast-in items-center gap-2.5 rounded-[10px] border border-line bg-card px-3.5 py-2.5 text-[13px] shadow-pop",
              t.bad ? "border-l-[3px] border-l-red" : "border-l-[3px] border-l-green"
            )}
          >
            {t.bad ? (
              <AlertTriangle size={16} className="shrink-0 text-red-deep" />
            ) : (
              <Check size={16} className="shrink-0 text-green-deep" />
            )}
            <span>{t.msg}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 shrink-0 text-muted-2 hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
