import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * The host's `QueryClientProvider`, as every provider test needs one: a fresh client per render, kept
 * across a rerender, so no test reads a session another one cached.
 */
export function Queries({ children }: { readonly children?: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
