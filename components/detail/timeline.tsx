"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowRight, MoreHorizontal, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityIcon, StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { usePrefs } from "@/components/providers/prefs";
import { useThreadActions } from "@/components/quick-log/thread-actions";
import { deleteWithUndo } from "@/lib/client/mutate";
import { formatTz, dayKey } from "@/lib/dates";
import { ACTIVITY_META, INTERVIEW_OUTCOME_META, INTERVIEW_STAGE_META, OUTCOME_META } from "@/lib/meta";
import type { TimelineItem } from "@/lib/queries/records";
import { Activity } from "lucide-react";

/**
 * One vertical feed of everything that happened: messages, replies,
 * stage changes and interviews, grouped by day.
 */
export function Timeline({
  items,
  now,
  show = { company: false, contact: true, opportunity: true },
  empty,
}: {
  items: TimelineItem[];
  now: number;
  show?: { company?: boolean; contact?: boolean; opportunity?: boolean };
  empty?: React.ReactNode;
}) {
  const { timezone } = usePrefs();
  if (!items.length) {
    return <>{empty ?? <EmptyState icon={Activity} title="No history yet" description="Activities, stage changes and interviews will show up here." />}</>;
  }

  const groups: { day: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const day = dayKey(item.at, timezone);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  const today = dayKey(now, timezone);
  const yesterday = dayKey(now - 86_400_000, timezone);

  return (
    <ol className="space-y-6">
      {groups.map((g) => (
        <li key={g.day}>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            {g.day === today ? "Today" : g.day === yesterday ? "Yesterday" : formatTz(g.items[0].at, timezone, g.day > today ? "EEEE, MMM d" : "EEEE, MMM d, yyyy")}
            {g.day > today && <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-[0.625rem] text-brand">upcoming</span>}
          </h4>
          <ol className="relative space-y-1 before:absolute before:top-3 before:bottom-3 before:left-[13px] before:w-px before:bg-border">
            {g.items.map((item) => (
              <TimelineRow key={`${item.kind}-${item.id}`} item={item} show={show} now={now} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

function TimelineRow({ item, show, now }: { item: TimelineItem; show: { company?: boolean; contact?: boolean; opportunity?: boolean }; now: number }) {
  const { timezone } = usePrefs();
  const thread = useThreadActions();
  const time = formatTz(item.at, timezone, "HH:mm");

  if (item.kind === "status") {
    return (
      <li className="relative flex items-center gap-3 py-1.5 pl-0">
        <span className="relative z-10 flex size-7 shrink-0 items-center justify-center">
          <span className="size-2 rounded-full bg-muted-foreground/40 ring-4 ring-background" />
        </span>
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
          {item.from ? <StatusBadge status={item.from} /> : <span>Created as</span>}
          {item.from && <ArrowRight className="size-3.5" />}
          <StatusBadge status={item.to} />
          {show.opportunity && (
            <Link href={`/opportunities/${item.opportunityId}`} className="truncate hover:text-foreground hover:underline">
              {item.opportunityTitle}
            </Link>
          )}
        </p>
        <time className="tabular ml-auto shrink-0 text-xs text-muted-foreground">{time}</time>
        <span aria-hidden className="w-5 shrink-0" />
      </li>
    );
  }

  if (item.kind === "interview") {
    const outcome = INTERVIEW_OUTCOME_META[item.outcome];
    return (
      <li className="relative flex items-start gap-3 rounded-lg py-2">
        <span
          className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md ring-4 ring-background"
          style={{ color: "var(--act-interview)", backgroundColor: "color-mix(in oklch, var(--act-interview) 14%, var(--background))" }}
        >
          <Video className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.84375rem]">
            <span className="font-medium">{INTERVIEW_STAGE_META[item.stage].label} interview</span>
            <span className="text-muted-foreground"> · {item.durationMinutes} min</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: outcome.color }} />
              {outcome.label}
            </span>
            {item.selfRating && <span>self-rating {item.selfRating}/5</span>}
            {show.opportunity && (
              <Link href={`/opportunities/${item.opportunityId}`} className="hover:text-foreground hover:underline">
                {item.opportunityTitle}
              </Link>
            )}
          </p>
        </div>
        <time className="tabular shrink-0 pt-0.5 text-xs text-muted-foreground">{time}</time>
        <span aria-hidden className="w-5 shrink-0" />
      </li>
    );
  }

  const meta = ACTIVITY_META[item.type];
  const inbound = item.direction === "inbound";
  const threadId = item.parentActivityId ?? item.id;
  const context = [
    show.company && item.companyName && { href: `/companies/${item.companyId}`, label: item.companyName },
    show.contact && item.contactName && { href: `/contacts/${item.contactId}`, label: item.contactName },
    show.opportunity && item.opportunityTitle && { href: `/opportunities/${item.opportunityId}`, label: item.opportunityTitle },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <li className="group/item relative flex items-start gap-3 rounded-lg py-2">
      {inbound ? (
        <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-md bg-status-accepted/15 text-status-accepted ring-4 ring-background">
          <ArrowDownLeft className="size-3.5" strokeWidth={2.25} />
        </span>
      ) : (
        <ActivityIcon type={item.type} className="relative z-10 ring-4 ring-background" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[0.84375rem]">
          <span className="font-medium">{inbound ? "Reply received" : meta.label}</span>
          {context.map((c) => (
            <span key={c.href} className="text-muted-foreground">
              {" · "}
              <Link href={c.href as never} className="hover:text-foreground hover:underline">
                {c.label}
              </Link>
            </span>
          ))}
        </p>
        {item.subject && <p className="mt-0.5 text-[0.8125rem] text-foreground/85">{item.subject}</p>}
        {item.summary && <p className="mt-0.5 line-clamp-3 text-[0.8125rem] whitespace-pre-line text-muted-foreground">{item.summary}</p>}
        {!inbound && item.type !== "note" && item.type !== "interview" && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ backgroundColor: OUTCOME_META[item.outcome].color }} />
              {OUTCOME_META[item.outcome].label}
            </span>
            {item.followUpDueAt && item.outcome === "pending" && (
              <span className={item.followUpDueAt < now ? "font-medium text-brand" : ""}>
                follow up {formatTz(item.followUpDueAt, timezone, "EEE d MMM")}
              </span>
            )}
          </p>
        )}
      </div>
      <time className="tabular shrink-0 pt-0.5 text-xs text-muted-foreground">{time}</time>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Activity actions" className="-mr-1 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-60">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!inbound && (
            <>
              <DropdownMenuItem onSelect={() => thread.markReplied(threadId, "positive")}>Mark positive reply</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => thread.markReplied(threadId, "replied")}>Mark replied</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => thread.markReplied(threadId, "negative")}>Mark negative reply</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => thread.logFollowUp({ id: threadId, companyId: item.companyId, contactId: item.contactId, opportunityId: item.opportunityId })}
              >
                Log follow-up
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("activities", [item.id], meta.label.toLowerCase())}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
