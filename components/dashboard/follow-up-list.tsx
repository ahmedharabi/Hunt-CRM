"use client";

import Link from "next/link";
import { Check, Clock, CornerDownRight, MoreHorizontal, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActivityIcon } from "@/components/shared/status-badge";
import { TierBadge } from "@/components/shared/badges";
import { usePrefs } from "@/components/providers/prefs";
import { useThreadActions } from "@/components/quick-log/thread-actions";
import { daysAgo, formatTz } from "@/lib/dates";
import { ACTIVITY_META } from "@/lib/meta";
import type { FollowUpItem } from "@/lib/services/dashboard";
import type { Tier } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function FollowUpList({ items, now, compact }: { items: FollowUpItem[]; now: number; compact?: boolean }) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <FollowUpRow key={item.id} item={item} now={now} compact={compact} />
      ))}
    </ul>
  );
}

function FollowUpRow({ item, now, compact }: { item: FollowUpItem; now: number; compact?: boolean }) {
  const { timezone } = usePrefs();
  const actions = useThreadActions();
  const threadId = item.parentActivityId ?? item.id;
  const overdueDays = daysAgo(item.followUpDueAt, now, timezone);
  const sentDays = daysAgo(item.occurredAt, now, timezone);
  const who = item.contactName ?? item.companyName ?? "Unknown";
  const ctx = { id: threadId, companyId: item.companyId, contactId: item.contactId, opportunityId: item.opportunityId };

  return (
    <li className="group/row flex items-center gap-3 px-4 py-2.5">
      <ActivityIcon type={item.type} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[13.5px]">
          {item.contactId ? (
            <Link href={`/contacts/${item.contactId}`} className="truncate font-medium hover:underline">
              {who}
            </Link>
          ) : (
            <span className="truncate font-medium">{who}</span>
          )}
          {item.companyName && item.contactName && (
            <Link href={`/companies/${item.companyId}`} className="truncate text-muted-foreground hover:text-foreground hover:underline">
              {item.companyName}
            </Link>
          )}
          {!compact && item.companyTier === "dream" && <TierBadge tier={item.companyTier as Tier} />}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {ACTIVITY_META[item.type].label} sent {sentDays === 0 ? "today" : sentDays === 1 ? "yesterday" : `${sentDays} days ago`}
          {item.followUps > 0 && ` · ${item.followUps} follow-up${item.followUps > 1 ? "s" : ""}`}
          {item.opportunityTitle && !compact && ` · ${item.opportunityTitle}`}
          {" · "}
          <span className={cn(overdueDays > 0 && "font-medium text-brand")}>
            {overdueDays > 1 ? `${overdueDays} days overdue` : overdueDays === 1 ? "due yesterday" : overdueDays === 0 ? "due today" : `due ${formatTz(item.followUpDueAt, timezone, "EEE")}`}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => actions.markReplied(threadId, "replied")} aria-label="Mark replied">
              <Check />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mark replied</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => actions.snooze(item.id, 2)} aria-label="Snooze 2 days" className="max-sm:hidden">
              <Clock />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snooze 2 days</TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" onClick={() => actions.logFollowUp(ctx)} className="h-7">
          <CornerDownRight data-icon="inline-start" />
          <span className="max-sm:sr-only">Follow up</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => actions.markReplied(threadId, "positive")}>
              <ThumbsUp />
              Positive reply
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.markReplied(threadId, "negative")}>
              <ThumbsDown />
              Negative reply
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => actions.snooze(item.id, 2)}>
              <Clock />
              Snooze 2 days
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.snooze(item.id, 7)}>
              <Clock />
              Snooze a week
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => actions.dismiss(item.id)}>
              <X />
              Stop reminding me
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
