"use client";

import { createContext, useContext } from "react";

export type Prefs = { timezone: string; weekStartsOn: number };

const PrefsContext = createContext<Prefs>({ timezone: "UTC", weekStartsOn: 1 });

/** Settings the client needs to format dates exactly like the server did. */
export function PrefsProvider({ value, children }: { value: Prefs; children: React.ReactNode }) {
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
