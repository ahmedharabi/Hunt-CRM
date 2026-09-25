"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getLookups } from "@/lib/actions/activities";
import type { Lookups } from "@/lib/queries/records";

type Ctx = { data: Lookups | null; refresh: () => Promise<Lookups | null>; ensure: () => void };
const LookupsContext = createContext<Ctx | null>(null);

/**
 * Pickers (companies, contacts, opportunities, templates…) share one
 * lazily-fetched list. It loads the first time a picker needs it and
 * refreshes after mutations that add records.
 */
export function LookupsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Lookups | null>(null);
  const inflight = useRef<Promise<Lookups | null> | null>(null);

  const refresh = useCallback(() => {
    inflight.current = getLookups().then((r) => {
      inflight.current = null;
      if (r.ok) {
        setData(r.data);
        return r.data;
      }
      return null;
    });
    return inflight.current;
  }, []);

  const ensure = useCallback(() => {
    if (!data && !inflight.current) void refresh();
  }, [data, refresh]);

  return <LookupsContext.Provider value={{ data, refresh, ensure }}>{children}</LookupsContext.Provider>;
}

export function useLookups() {
  const ctx = useContext(LookupsContext);
  if (!ctx) throw new Error("useLookups outside LookupsProvider");
  const { ensure } = ctx;
  useEffect(() => ensure(), [ensure]);
  return ctx;
}
