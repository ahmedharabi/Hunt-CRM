"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownLeft, Check, ChevronRight, CornerDownRight, MoreHorizontal, Plus, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityIcon } from "@/components/shared/status-badge";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { TierBadge } from "@/components/shared/badges";
import { RelativeTime } from "@/components/shared/relative-time";
import { LinkedInIcon } from "@/components/brand/icons";
import { usePrefs } from "@/components/providers/prefs";
import { useAppActions } from "@/components/quick-log/app-actions";
import { useThreadActions } from "@/components/quick-log/thread-actions";
import { logActivity } from "@/lib/actions/activities";
import { deleteRecords } from "@/lib/actions/records";
import { formatTz } from "@/lib/dates";
import type { ActivityType } from "@/lib/domain";
import { ACTIVITY_META, CONTACT_TYPE_META, OUTCOME_META, OUTREACH_STAGE_META } from "@/lib/meta";
import { companySummary, isAccepted, type OutreachActivity, type OutreachCompany, type OutreachPerson, type OutreachThread } from "@/lib/outreach";
import { cn } from "@/lib/utils";

/** Company → people → threads, with one-click logging at each person. */
export function OutreachTree({ companies, now }: { companies: OutreachCompany[]; now: number }) {
  return (
    <div className="space-y-3">
      {companies.map((c, i) => (
        <CompanyNode key={c.id} company={c} now={now} defaultOpen={i < 5 || companySummary(c).needsAction > 0} />
      ))}
    </div>
  );
}

function CompanyNode({ company, now, defaultOpen }: { company: OutreachCompany; now: number; defaultOpen: boolean }) {
  const { addContact } = useAppActions();
  const sum = companySummary(company);
  return (
    <Collapsible defaultOpen={defaultOpen} className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 bg-muted/30 py-2 pr-2 pl-2">
        <CollapsibleTrigger asChild>
          <button type="button" className="group/trig flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-0.5 text-left">
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/trig:rotate-90" />
            <CompanyAvatar name={company.name} logoUrl={company.logoUrl} className="size-7 rounded-md text-xs" />
            <span className="truncate text-[0.875rem] font-medium">{company.name}</span>
            <TierBadge tier={company.tier} />
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {sum.people} {sum.people === 1 ? "person" : "people"} · {sum.reached} reached · {sum.replied} replied
            </span>
            {sum.needsAction > 0 && (
              <span className="rounded-full bg-brand-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-brand">{sum.needsAction} to do</span>
            )}
          </button>
        </CollapsibleTrigger>
        <Button variant="ghost" size="xs" asChild className="hidden sm:inline-flex">
          <Link href={`/companies/${company.id}`}>Open</Link>
        </Button>
        <Button variant="ghost" size="icon-xs" aria-label={`Add a person at ${company.name}`} onClick={() => addContact({ companyId: company.id })}>
          <Plus />
        </Button>
      </div>
      <CollapsibleContent>
        <OutreachPeople company={company} now={now} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The people at one company; also used on its own on the company page. */
export function OutreachPeople({ company, now }: { company: OutreachCompany; now: number }) {
  const { addContact } = useAppActions();
  if (!company.people.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Add the recruiters, engineers and managers you want to reach here, then log each invite and message as you send it.
        </p>
        <Button size="sm" variant="outline" onClick={() => addContact({ companyId: company.id })}>
          <UserPlus data-icon="inline-start" />
          Add person
        </Button>
      </div>
    );
  }
  return (
    <ul className="divide-y border-t">
      {company.people.map((p) => (
        <PersonNode key={p.id} person={p} companyId={company.id} now={now} />
      ))}
    </ul>
  );
}

export function StagePill({ person }: { person: OutreachPerson }) {
  const meta = OUTREACH_STAGE_META[person.stage];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

/** Pending outbound thread the person is most likely to answer next, newest first. */
const pendingThread = (p: OutreachPerson, connection: boolean) =>
  p.threads.find((t) => t.root.direction === "outbound" && t.root.outcome === "pending" && (t.root.type === "linkedin_connection") === connection);

function usePersonActions(person: OutreachPerson, companyId: number) {
  const router = useRouter();
  const { quickLog } = useAppActions();
  const thread = useThreadActions();

  const log = (type: ActivityType, direction: "outbound" | "inbound" = "outbound") =>
    quickLog({ type, direction, companyId, contactId: person.id });

  /** Logged without a dialog; the toast can take it back. */
  const logInvite = async () => {
    const r = await logActivity({ type: "linkedin_connection", direction: "outbound", companyId, contactId: person.id });
    if (!r.ok) return toast.error(r.error);
    router.refresh();
    toast.success(`Invite to ${person.name} logged`, {
      action: {
        label: "Undo",
        onClick: async () => {
          await deleteRecords("activities", [r.data.id]);
          router.refresh();
        },
      },
    });
  };

  return { log, logInvite, thread };
}

export function PrimaryAction({ person, companyId }: { person: OutreachPerson; companyId: number }) {
  const { log, logInvite, thread } = usePersonActions(person, companyId);
  const invite = pendingThread(person, true);
  const message = pendingThread(person, false);
  const due = person.threads.find((t) => [t.root, ...t.children].some((a) => a.followUpDueAt !== null && a.followUpDueAt === person.followUpDueAt));
  const ctx = (t: OutreachThread) => ({ id: t.root.id, companyId: t.root.companyId, contactId: person.id, opportunityId: t.root.opportunityId });

  if (person.next === "follow_up" && due) {
    return (
      <Button size="xs" onClick={() => thread.logFollowUp(ctx(due))}>
        <CornerDownRight data-icon="inline-start" />
        Follow up
      </Button>
    );
  }
  if (person.stage === "new") {
    return (
      <Button size="xs" variant="outline" onClick={logInvite}>
        <UserPlus data-icon="inline-start" />
        Invite sent
      </Button>
    );
  }
  if (person.stage === "invited" && invite) {
    return (
      <Button size="xs" variant="outline" onClick={() => thread.markReplied(invite.root.id)}>
        <Check data-icon="inline-start" />
        Accepted
      </Button>
    );
  }
  if (person.stage === "connected") {
    return (
      <Button size="xs" onClick={() => log("linkedin_dm")}>
        <Send data-icon="inline-start" />
        Send DM
      </Button>
    );
  }
  if (person.stage === "messaged" && message) {
    return (
      <Button size="xs" variant="outline" onClick={() => thread.markReplied(message.root.id)}>
        <ArrowDownLeft data-icon="inline-start" />
        Got a reply
      </Button>
    );
  }
  return null;
}

export function PersonMenu({ person, companyId }: { person: OutreachPerson; companyId: number }) {
  const { log, logInvite } = usePersonActions(person, companyId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Log something with ${person.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">I sent…</DropdownMenuLabel>
        <DropdownMenuItem onSelect={logInvite}>Connection request</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => log("linkedin_dm")}>LinkedIn DM</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => log("cold_email")}>Email</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => log("referral_request")}>Referral request</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">They…</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => log("linkedin_dm", "inbound")}>Messaged me</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => log("call")}>Had a call</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => log("coffee_chat")}>Had a coffee chat</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => log("note")}>Add a note</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/contacts/${person.id}`}>Open contact</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonNode({ person, companyId, now }: { person: OutreachPerson; companyId: number; now: number }) {
  const [open, setOpen] = useState(person.next === "follow_up");
  const { timezone } = usePrefs();
  const hasThreads = person.threads.length > 0;
  const hint =
    person.next === "follow_up"
      ? "Follow-up due"
      : person.next === "send_message"
        ? "Accepted, no message yet"
        : person.followUpDueAt
          ? `Follow up ${formatTz(person.followUpDueAt, timezone, "MMM d")}`
          : null;

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 py-2 pr-2 pl-4 sm:pl-6">
          <CollapsibleTrigger asChild disabled={!hasThreads}>
            <button type="button" className="group/trig flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default">
              <ChevronRight
                className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/trig:rotate-90", !hasThreads && "invisible")}
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[0.8125rem] font-medium">{person.name}</span>
                  <StagePill person={person} />
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  {[person.role, person.contactType && CONTACT_TYPE_META[person.contactType].label].filter(Boolean).join(" · ") || "No role"}
                  {hint && (
                    <span className={cn("truncate", person.next && person.next !== "reach_out" && "font-medium text-brand")}>· {hint}</span>
                  )}
                </span>
              </span>
            </button>
          </CollapsibleTrigger>
          {person.linkedinUrl && (
            <Button variant="ghost" size="icon-xs" asChild className="hidden sm:inline-flex">
              <a href={person.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`${person.name} on LinkedIn`}>
                <LinkedInIcon className="size-3.5" />
              </a>
            </Button>
          )}
          <RelativeTime value={person.lastAt} now={now} className="hidden w-12 shrink-0 text-right text-xs text-muted-foreground sm:block" />
          <PrimaryAction person={person} companyId={companyId} />
          <PersonMenu person={person} companyId={companyId} />
        </div>
        <CollapsibleContent>
          <ThreadList person={person} className="ml-[1.375rem] border-l pb-2 pl-3 sm:ml-[1.875rem]" />
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/** Every message with this person, each with its follow-ups and replies. */
export function ThreadList({ person, className }: { person: OutreachPerson; className?: string }) {
  return (
    <ul className={cn("space-y-0.5", className)}>
      {person.threads.map((t) => (
        <ThreadNode key={t.root.id} thread={t} personId={person.id} />
      ))}
    </ul>
  );
}

function outcomeLabel(t: OutreachThread) {
  if (t.root.type === "linkedin_connection") {
    if (t.root.direction === "inbound") return { label: "They invited you", color: OUTCOME_META.replied.color };
    if (isAccepted(t)) return { label: "Accepted", color: OUTCOME_META.positive.color };
    if (t.root.outcome === "no_response") return { label: "Not accepted", color: OUTCOME_META.no_response.color };
    return { label: "Pending", color: OUTCOME_META.pending.color };
  }
  if (t.root.type === "note" || t.root.direction === "inbound") return null;
  return OUTCOME_META[t.root.outcome];
}

function activityLabel(a: OutreachActivity, root: OutreachActivity) {
  if (a.direction === "inbound") return root.type === "linkedin_connection" ? "Accepted your invite" : "Their reply";
  return ACTIVITY_META[a.type].label;
}

function ThreadNode({ thread, personId }: { thread: OutreachThread; personId: number }) {
  const { timezone } = usePrefs();
  const actions = useThreadActions();
  const { root } = thread;
  const outcome = outcomeLabel(thread);
  const pending = root.direction === "outbound" && root.outcome === "pending" && root.type !== "note";
  const ctx = { id: root.id, companyId: root.companyId, contactId: personId, opportunityId: root.opportunityId };

  return (
    <li>
      <div className="group/row flex items-center gap-2 rounded-md py-1 pr-1">
        <ActivityIcon type={root.type} className="size-6" />
        <p className="min-w-0 flex-1 truncate text-[0.8125rem]">
          <span className="font-medium">{root.direction === "inbound" && root.type !== "linkedin_connection" ? `${ACTIVITY_META[root.type].label} from them` : ACTIVITY_META[root.type].label}</span>
          {(root.subject || root.summary) && <span className="text-muted-foreground"> · {root.subject || root.summary}</span>}
        </p>
        {outcome && (
          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: outcome.color }} />
            {outcome.label}
          </span>
        )}
        <time className="tabular w-14 shrink-0 text-right text-xs text-muted-foreground">{formatTz(root.at, timezone, "MMM d")}</time>
        {pending ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="Thread actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {root.type === "linkedin_connection" ? (
                <DropdownMenuItem onSelect={() => actions.markReplied(root.id)}>Mark accepted</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem onSelect={() => actions.markReplied(root.id)}>Mark replied</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => actions.markReplied(root.id, "positive")}>Positive reply</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => actions.markReplied(root.id, "negative")}>Negative reply</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => actions.logFollowUp(ctx)}>Log follow-up</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.snooze(root.id)}>Snooze reminder 2 days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span aria-hidden className="w-6 shrink-0" />
        )}
      </div>
      {thread.children.length > 0 && (
        <ul className="ml-3 border-l pl-3">
          {thread.children.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
              {c.direction === "inbound" ? <ArrowDownLeft className="size-3.5 shrink-0 text-brand" /> : <CornerDownRight className="size-3.5 shrink-0" />}
              <span className={cn("min-w-0 flex-1 truncate", c.direction === "inbound" && "text-foreground")}>
                {activityLabel(c, root)}
                {(c.subject || c.summary) && <span className="text-muted-foreground"> · {c.subject || c.summary}</span>}
              </span>
              <time className="tabular w-14 shrink-0 text-right">{formatTz(c.at, timezone, "MMM d")}</time>
              <span aria-hidden className="w-6 shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
