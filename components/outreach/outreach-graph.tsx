"use client";

import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { TierBadge } from "@/components/shared/badges";
import { RelativeTime } from "@/components/shared/relative-time";
import { LinkedInIcon } from "@/components/brand/icons";
import { usePrefs } from "@/components/providers/prefs";
import { useAppActions } from "@/components/quick-log/app-actions";
import { formatTz } from "@/lib/dates";
import { CONTACT_TYPE_META, OUTREACH_STAGE_META } from "@/lib/meta";
import { companySummary, OUTREACH_STAGES, type OutreachCompany, type OutreachPerson } from "@/lib/outreach";
import { cn } from "@/lib/utils";
import { PersonMenu, PrimaryAction, StagePill, ThreadList } from "./outreach-tree";

/*
 * A company and the people you've reached there, drawn as a graph: the
 * company on the left, one branch per person. Nodes have a fixed height,
 * so the edges are computed rather than measured.
 */
const NODE_H = 48;
const GAP = 10;
const EDGE_W = 56;
/** Room for the company node; fewer branches than this are centered beside it. */
const COMPANY_MIN_H = 140;

const NEEDS_YOU = new Set(["follow_up", "send_message"]);

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words.at(-1)![0] : name.slice(0, 2)).toUpperCase();
}

export function StageLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {OUTREACH_STAGES.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: OUTREACH_STAGE_META[s].color }} />
          {OUTREACH_STAGE_META[s].label}
        </li>
      ))}
    </ul>
  );
}

export function CompanyGraph({ company, now, linkCompany = true }: { company: OutreachCompany; now: number; linkCompany?: boolean }) {
  const { addContact } = useAppActions();
  const sum = companySummary(company);
  // The last branch is the "add person" node.
  const branches = company.people.length + 1;
  const stack = branches * NODE_H + (branches - 1) * GAP;
  const height = Math.max(COMPANY_MIN_H, stack);
  const top = (height - stack) / 2;
  const cy = height / 2;
  const y = (i: number) => top + i * (NODE_H + GAP) + NODE_H / 2;
  const edge = (yi: number) => `M0 ${cy} C ${EDGE_W / 2} ${cy}, ${EDGE_W / 2} ${yi}, ${EDGE_W} ${yi}`;

  return (
    <section className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
      <div className="grid grid-cols-[6.5rem_1.75rem_minmax(0,1fr)] sm:grid-cols-[10rem_3rem_minmax(0,1fr)]" style={{ height }}>
        <div className="flex items-center">
          <div className="w-full rounded-xl border bg-background p-2.5 shadow-xs sm:p-3">
            <div className="flex items-center gap-2">
              <CompanyAvatar name={company.name} logoUrl={company.logoUrl} className="size-8 rounded-lg text-xs" />
              <div className="min-w-0">
                {linkCompany ? (
                  <Link href={`/companies/${company.id}`} className="block truncate text-[0.8125rem] font-semibold hover:underline">
                    {company.name}
                  </Link>
                ) : (
                  <p className="truncate text-[0.8125rem] font-semibold">{company.name}</p>
                )}
                <TierBadge tier={company.tier} />
              </div>
            </div>
            <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
              {sum.reached}/{sum.people} reached · {sum.replied} replied
            </p>
            {sum.needsAction > 0 && (
              <p className="mt-1 text-[0.6875rem] font-medium text-brand">{sum.needsAction} waiting on you</p>
            )}
          </div>
        </div>

        <svg viewBox={`0 0 ${EDGE_W} ${height}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden>
          {company.people.map((p, i) => {
            const pending = p.stage === "new" || p.stage === "invited";
            return (
              <path
                key={p.id}
                d={edge(y(i))}
                fill="none"
                stroke={OUTREACH_STAGE_META[p.stage].color}
                strokeOpacity={p.stage === "new" ? 0.45 : 0.85}
                strokeWidth={p.stage === "replied" || p.stage === "talking" ? 2.25 : 1.5}
                strokeDasharray={pending ? "4 3" : undefined}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          <path d={edge(y(company.people.length))} fill="none" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        </svg>

        <ul className="flex min-w-0 flex-col" style={{ gap: GAP, paddingTop: top }}>
          {company.people.map((p) => (
            <li key={p.id} style={{ height: NODE_H }}>
              <PersonNode person={p} companyId={company.id} now={now} />
            </li>
          ))}
          <li style={{ height: NODE_H }}>
            <button
              type="button"
              onClick={() => addContact({ companyId: company.id })}
              className="flex h-full w-full items-center gap-2 rounded-lg border border-dashed px-2.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed">
                <Plus className="size-3.5" />
              </span>
              Add person
            </button>
          </li>
        </ul>
      </div>
    </section>
  );
}

function PersonNode({ person, companyId, now }: { person: OutreachPerson; companyId: number; now: number }) {
  const { timezone } = usePrefs();
  const color = OUTREACH_STAGE_META[person.stage].color;
  const needsYou = !!person.next && NEEDS_YOU.has(person.next);
  const sub = [person.role, person.contactType && CONTACT_TYPE_META[person.contactType].label].filter(Boolean).join(" · ");
  const hint =
    person.next === "follow_up"
      ? "Follow-up due"
      : person.next === "send_message"
        ? "Accepted. Send them a message"
        : person.followUpDueAt
          ? `Follow up on ${formatTz(person.followUpDueAt, timezone, "MMM d")}`
          : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-full w-full items-center gap-2 rounded-lg border bg-background px-2 text-left shadow-xs transition-colors hover:bg-muted/60 data-[state=open]:bg-muted/60",
            needsYou && "border-brand/50",
          )}
        >
          <span
            className="relative flex size-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold"
            style={{ color, backgroundColor: `color-mix(in oklch, ${color} 14%, var(--background))`, boxShadow: `inset 0 0 0 1.5px ${color}` }}
          >
            {initials(person.name)}
            {needsYou && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-brand ring-2 ring-background" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] leading-tight font-medium">{person.name}</span>
            <span className="block truncate text-[0.6875rem] leading-tight text-muted-foreground">
              {OUTREACH_STAGE_META[person.stage].label}
              {sub && <span className="hidden sm:inline"> · {sub}</span>}
            </span>
          </span>
          <RelativeTime value={person.lastAt} now={now} className="hidden shrink-0 text-[0.6875rem] text-muted-foreground 2xl:block" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="space-y-2 border-b p-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{person.name}</p>
              {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
            </div>
            {person.linkedinUrl && (
              <Button variant="ghost" size="icon-xs" asChild>
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`${person.name} on LinkedIn`}>
                  <LinkedInIcon className="size-3.5" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon-xs" asChild>
              <Link href={`/contacts/${person.id}`} aria-label={`Open ${person.name}`}>
                <ExternalLink />
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StagePill person={person} />
            {hint && <span className={cn("text-xs", needsYou ? "font-medium text-brand" : "text-muted-foreground")}>{hint}</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <PrimaryAction person={person} companyId={companyId} />
            <PersonMenu person={person} companyId={companyId} />
          </div>
        </div>
        {person.threads.length ? (
          <ThreadList person={person} className="max-h-72 overflow-y-auto p-2" />
        ) : (
          <p className="p-3 text-xs text-muted-foreground">Nothing sent yet. Log your invite or first message from here.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
