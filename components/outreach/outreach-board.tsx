"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronRight, List, Network, Search, UserPlus, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/shared/empty-state";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { useAppActions } from "@/components/quick-log/app-actions";
import type { OutreachCompany } from "@/lib/outreach";
import { OutreachTree } from "./outreach-tree";
import { CompanyGraph, StageLegend } from "./outreach-graph";

type Filter = "all" | "todo";
export type OutreachViewMode = "graph" | "list";

const VIEW_KEY = "hunt:outreach-view";

/** Graph or list, remembered per browser. */
export function useOutreachView() {
  const [view, setView] = useState<OutreachViewMode>("graph");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage after mount
      if (saved === "graph" || saved === "list") setView(saved);
    } catch {}
  }, []);
  const change = (v: OutreachViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  return [view, change] as const;
}

export function ViewToggle({ view, onChange }: { view: OutreachViewMode; onChange: (v: OutreachViewMode) => void }) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && onChange(v as OutreachViewMode)}>
      <ToggleGroupItem value="graph" aria-label="Graph view">
        <Workflow />
        Graph
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view">
        <List />
        List
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Every company you're reaching out to, as a graph or a tree, with search and a "needs me" filter. */
export function OutreachBoard({ companies, now }: { companies: OutreachCompany[]; now: number }) {
  const { addContact, addCompany } = useAppActions();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useOutreachView();

  const withPeople = companies.filter((c) => c.people.length > 0);
  const empty = companies.filter((c) => c.people.length === 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withPeople
      .map((c) => {
        const companyHit = !q || c.name.toLowerCase().includes(q);
        const people = c.people.filter(
          (p) =>
            (companyHit || p.name.toLowerCase().includes(q) || p.role?.toLowerCase().includes(q)) &&
            (filter === "all" || p.next === "follow_up" || p.next === "send_message"),
        );
        return { ...c, people };
      })
      .filter((c) => c.people.length > 0);
  }, [withPeople, query, filter]);

  const shownEmpty = query ? empty.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())) : empty;

  const actions = (
    <>
      <Button size="sm" variant="outline" onClick={() => addCompany()}>
        <Building2 data-icon="inline-start" />
        Add company
      </Button>
      <Button size="sm" onClick={() => addContact()}>
        <UserPlus data-icon="inline-start" />
        Add person
      </Button>
    </>
  );

  if (!withPeople.length && !empty.length) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Network}
          title="Start your outreach map"
          description="Add a company you're targeting, then the people there you send invites or messages to. Each person becomes a branch off the company."
          action={actions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies or people" className="h-8 pl-8" />
        </div>
        <ToggleGroup type="single" variant="outline" size="sm" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="todo">Needs action</ToggleGroupItem>
        </ToggleGroup>
        <ViewToggle view={view} onChange={setView} />
        <div className="flex items-center gap-2 sm:ml-auto">{actions}</div>
      </div>

      {view === "graph" && shown.length > 0 && <StageLegend />}

      {shown.length ? (
        view === "graph" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {shown.map((c) => (
              <CompanyGraph key={c.id} company={c} now={now} />
            ))}
          </div>
        ) : (
          <OutreachTree companies={shown} now={now} />
        )
      ) : (
        withPeople.length > 0 && (
          <p className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {filter === "todo" && !query ? "Nothing waiting on you. Nice." : "No matches."}
          </p>
        )
      )}

      {filter === "all" && shownEmpty.length > 0 && (
        <Collapsible defaultOpen={!withPeople.length || shownEmpty.length <= 6} className="rounded-xl border bg-card">
          <CollapsibleTrigger asChild>
            <button type="button" className="group/trig flex w-full items-center gap-2 px-4 py-3 text-left text-[0.8125rem] font-medium">
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-data-[state=open]/trig:rotate-90" />
              No one added yet
              <span className="tabular text-muted-foreground">{shownEmpty.length}</span>
              <span className="ml-auto hidden text-xs font-normal text-muted-foreground sm:inline">Add a person to start a branch</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="flex flex-wrap gap-2 border-t p-3">
              {shownEmpty.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => addContact({ companyId: c.id })}
                    className="inline-flex h-8 items-center gap-2 rounded-lg border bg-background pr-2.5 pl-1 text-xs hover:bg-muted"
                    aria-label={`Add a person at ${c.name}`}
                  >
                    <CompanyAvatar name={c.name} logoUrl={c.logoUrl} className="size-6 rounded-md text-[0.5625rem]" />
                    <span className="max-w-40 truncate">{c.name}</span>
                    <UserPlus className="size-3.5 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
