"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Briefcase, Building2, CalendarDays, FileSearch, Moon, Plus, Sun, UserRound, UsersRound } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Command } from "@/components/ui/command";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { useLookups } from "@/components/providers/lookups";
import { globalSearch, type SearchHit } from "@/lib/actions/search";
import type { ActivityType } from "@/lib/domain";
import { ACTIVITY_META, STATUS_META } from "@/lib/meta";
import { ALL_NAV } from "@/lib/nav";

type Actions = {
  log: (type: ActivityType) => void;
  addCompany: () => void;
  addContact: () => void;
  addOpportunity: () => void;
};

const LOG_ACTIONS: { type: ActivityType; label: string; key?: string }[] = [
  { type: "application", label: "New application", key: "A" },
  { type: "cold_email", label: "Log cold email", key: "E" },
  { type: "linkedin_dm", label: "Log LinkedIn DM", key: "L" },
  { type: "linkedin_connection", label: "Log connection request", key: "C" },
  { type: "follow_up", label: "Log follow-up", key: "F" },
  { type: "referral_request", label: "Log referral request" },
  { type: "call", label: "Log call" },
  { type: "coffee_chat", label: "Log coffee chat" },
  { type: "interview", label: "Log interview" },
  { type: "note", label: "Add a note" },
];

const matches = (q: string, ...fields: (string | null | undefined)[]) => {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return terms.every((t) => hay.includes(t));
};

export function CommandPalette({ open, onOpenChange, actions }: { open: boolean; onOpenChange: (o: boolean) => void; actions: Actions }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: lookups } = useLookups();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setQuery("");
  }

  // Full-text search across notes and job descriptions (FTS5), debounced.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      const r = await globalSearch(q);
      if (live && r.ok) setHits(r.data);
    }, 140);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const q = query.trim();
  const run = (fn: () => void) => {
    onOpenChange(false);
    // Let the dialog close before opening another one.
    setTimeout(fn, 60);
  };
  const go = (href: string) => run(() => router.push(href as never));

  const companies = useMemo(() => (q ? (lookups?.companies ?? []).filter((c) => matches(q, c.name)).slice(0, 6) : []), [q, lookups]);
  const contacts = useMemo(
    () => (q ? (lookups?.contacts ?? []).filter((c) => matches(q, c.name, c.role, c.email)).slice(0, 6) : []),
    [q, lookups],
  );
  const opps = useMemo(() => {
    if (!q || !lookups) return [];
    const names = new Map(lookups.companies.map((c) => [c.id, c.name]));
    return lookups.opportunities.filter((o) => matches(q, o.title, names.get(o.companyId))).slice(0, 6).map((o) => ({ ...o, company: names.get(o.companyId) }));
  }, [q, lookups]);

  const shownHrefs = new Set([
    ...companies.map((c) => `/companies/${c.id}`),
    ...contacts.map((c) => `/contacts/${c.id}`),
    ...opps.map((o) => `/opportunities/${o.id}`),
  ]);
  const deepHits = q.length >= 2 ? hits.filter((h) => !shownHrefs.has(h.href) && !["company"].includes(h.kind)).slice(0, 8) : [];

  const logActions = LOG_ACTIONS.filter((a) => !q || matches(q, a.label, "log"));
  const createActions = [
    { label: "Add company", icon: Building2, fn: actions.addCompany },
    { label: "Add contact", icon: UserRound, fn: actions.addContact },
    { label: "New opportunity", icon: Briefcase, fn: actions.addOpportunity },
  ].filter((a) => !q || matches(q, a.label, "new create add"));
  const nav = ALL_NAV.filter((n) => !q || matches(q, n.title, "go"));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Search records or run an action" className="sm:max-w-xl">
      <Command shouldFilter={false} loop>
        <CommandInput placeholder="Search companies, people, notes… or type a command" value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[min(60svh,460px)]">
          <CommandEmpty>Nothing matches “{q}”.</CommandEmpty>

          {companies.length > 0 && (
            <CommandGroup heading="Companies">
              {companies.map((c) => (
                <CommandItem key={`c${c.id}`} value={`company-${c.id}`} onSelect={() => go(`/companies/${c.id}`)}>
                  <CompanyAvatar name={c.name} logoUrl={c.logoUrl} className="size-5 rounded text-[0.5rem]" />
                  {c.name}
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{c.tier}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {opps.length > 0 && (
            <CommandGroup heading="Opportunities">
              {opps.map((o) => (
                <CommandItem key={`o${o.id}`} value={`opp-${o.id}`} onSelect={() => go(`/opportunities/${o.id}`)}>
                  <Briefcase />
                  <span className="truncate">{o.title}</span>
                  <span className="truncate text-muted-foreground">· {o.company}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_META[o.status].color }} />
                    {STATUS_META[o.status].label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {contacts.length > 0 && (
            <CommandGroup heading="People">
              {contacts.map((c) => (
                <CommandItem key={`p${c.id}`} value={`contact-${c.id}`} onSelect={() => go(`/contacts/${c.id}`)}>
                  <UsersRound />
                  {c.name}
                  {c.role && <span className="ml-auto truncate text-xs text-muted-foreground">{c.role}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {deepHits.length > 0 && (
            <CommandGroup heading="In notes & descriptions">
              {deepHits.map((h) => (
                <CommandItem key={`${h.kind}${h.id}`} value={`hit-${h.kind}-${h.id}`} onSelect={() => go(h.href)} className="items-start">
                  <FileSearch className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="truncate">
                      {h.title || h.kind}
                      {h.subtitle && <span className="text-muted-foreground"> · {h.subtitle}</span>}
                    </p>
                    {h.snippet && (
                      <p className="truncate text-xs text-muted-foreground">
                        {h.snippet.split(/(«[^»]*»)/).map((part, i) =>
                          part.startsWith("«") ? (
                            <mark key={i} className="rounded-sm bg-brand-soft px-0.5 text-foreground">
                              {part.slice(1, -1)}
                            </mark>
                          ) : (
                            part
                          ),
                        )}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(companies.length > 0 || opps.length > 0 || contacts.length > 0 || deepHits.length > 0) && <CommandSeparator />}

          {logActions.length > 0 && (
            <CommandGroup heading="Log">
              {logActions.map((a) => {
                const Icon = ACTIVITY_META[a.type].icon;
                return (
                  <CommandItem key={a.type} value={`log-${a.type}`} onSelect={() => run(() => actions.log(a.type))}>
                    <Icon style={{ color: ACTIVITY_META[a.type].color }} />
                    {a.label}
                    {a.key && <CommandShortcut>{a.key}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
          {createActions.length > 0 && (
            <CommandGroup heading="Create">
              {createActions.map((a) => (
                <CommandItem key={a.label} value={a.label} onSelect={() => run(a.fn)}>
                  <Plus />
                  {a.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {nav.length > 0 && (
            <CommandGroup heading="Go to">
              {nav.map((n) => (
                <CommandItem key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)}>
                  <n.icon />
                  {n.title}
                </CommandItem>
              ))}
              {(!q || matches(q, "calendar ics export")) && (
                <CommandItem
                  value="ics"
                  onSelect={() =>
                    run(() => {
                      const a = document.createElement("a");
                      a.href = "/api/calendar";
                      a.download = "hunt.ics";
                      a.click();
                    })
                  }
                >
                  <CalendarDays />
                  Export calendar (.ics)
                </CommandItem>
              )}
            </CommandGroup>
          )}
          {(!q || matches(q, "theme dark light toggle")) && (
            <CommandGroup heading="Preferences">
              <CommandItem value="theme" onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center gap-3 border-t px-3 py-2 text-[0.6875rem] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </Command>
    </CommandDialog>
  );
}
