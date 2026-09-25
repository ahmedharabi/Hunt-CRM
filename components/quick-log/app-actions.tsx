"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { ActivityType } from "@/lib/domain";
import { CompanyForm } from "@/components/forms/company-form";
import { ContactForm } from "@/components/forms/contact-form";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import type { ContactInput, OpportunityInput } from "@/lib/validators";
import { QuickLogDialog, type QuickLogPreset } from "./quick-log-dialog";
import { CommandPalette } from "./command-palette";

type AppActions = {
  quickLog: (preset?: QuickLogPreset) => void;
  openPalette: () => void;
  addCompany: () => void;
  addContact: (initial?: Partial<ContactInput>) => void;
  addOpportunity: (initial?: Partial<OpportunityInput>) => void;
};

const Ctx = createContext<AppActions | null>(null);

export function useAppActions() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppActions outside AppActionsProvider");
  return ctx;
}

const TYPE_KEYS: Record<string, ActivityType> = {
  a: "application",
  e: "cold_email",
  l: "linkedin_dm",
  c: "linkedin_connection",
  f: "follow_up",
};

function isTyping(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[role=dialog],[role=menu],[role=listbox]");
}

/**
 * Owns the global dialogs (quick log, palette, create forms) and keyboard
 * shortcuts, so any screen can open them with a preset.
 */
export function AppActionsProvider({ children }: { children: React.ReactNode }) {
  const [logOpen, setLogOpen] = useState(false);
  const [preset, setPreset] = useState<QuickLogPreset>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [contact, setContact] = useState<{ open: boolean; initial?: Partial<ContactInput> }>({ open: false });
  const [opp, setOpp] = useState<{ open: boolean; initial?: Partial<OpportunityInput> }>({ open: false });

  const quickLog = useCallback((p: QuickLogPreset = {}) => {
    setPreset(p);
    setLogOpen(true);
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      quickLog,
      openPalette: () => setPaletteOpen(true),
      addCompany: () => setCompanyOpen(true),
      addContact: (initial) => setContact({ open: true, initial }),
      addOpportunity: (initial) => setOpp({ open: true, initial }),
    }),
    [quickLog],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const type = TYPE_KEYS[e.key.toLowerCase()];
      if (type && !e.shiftKey) {
        e.preventDefault();
        quickLog({ type });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickLog]);

  return (
    <Ctx.Provider value={actions}>
      {children}
      <QuickLogDialog open={logOpen} onOpenChange={setLogOpen} preset={preset} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={{
          log: (type) => quickLog({ type }),
          addCompany: actions.addCompany,
          addContact: () => actions.addContact(),
          addOpportunity: () => actions.addOpportunity(),
        }}
      />
      <CompanyForm open={companyOpen} onOpenChange={setCompanyOpen} />
      <ContactForm open={contact.open} onOpenChange={(o) => setContact((c) => ({ ...c, open: o }))} initial={contact.initial} />
      <OpportunityForm open={opp.open} onOpenChange={(o) => setOpp((c) => ({ ...c, open: o }))} initial={opp.initial} />

      {/* Mobile: thumb-reachable quick add */}
      <button
        type="button"
        onClick={() => quickLog()}
        aria-label="Log activity"
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex size-13 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 transition-transform active:scale-95 md:hidden"
      >
        <Plus className="size-6" strokeWidth={2.25} />
      </button>
    </Ctx.Provider>
  );
}
