"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@/components/ui/Toast";

export default function Providers({ children }) {
  // one QueryClient per browser session (React Query / TanStack — spec §16.1)
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      })
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
