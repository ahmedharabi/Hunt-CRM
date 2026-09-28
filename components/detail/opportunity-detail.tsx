"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { Dots, PriorityBars, TierBadge } from "@/components/shared/badges";
import { Markdown } from "@/components/shared/markdown";
import { DateText } from "@/components/shared/relative-time";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { InterviewForm } from "@/components/forms/interview-form";
import { useAppActions } from "@/components/quick-log/app-actions";
import { usePrefs } from "@/components/providers/prefs";
import { deleteWithUndo } from "@/lib/client/mutate";
import { formatTz } from "@/lib/dates";
import { EMPLOYMENT_META, INTERVIEW_OUTCOME_META, INTERVIEW_STAGE_META, REMOTE_META, SOURCE_META, STATUS_META } from "@/lib/meta";
import type { getOpportunity, TimelineItem } from "@/lib/queries/records";
import { Panel } from "./parts";
import { StatusStepper } from "./status-stepper";
import { Timeline } from "./timeline";

type Data = NonNullable<ReturnType<typeof getOpportunity>>;
type Interview = Data["opportunity"]["interviews"][number];

export function OpportunityDetail({ opportunity: o, timeline, now }: { opportunity: Data["opportunity"]; timeline: TimelineItem[]; now: number }) {
  const router = useRouter();
  const { timezone } = usePrefs();
  const { quickLog } = useAppActions();
  const [editing, setEditing] = useState(false);
  const [interview, setInterview] = useState<{ open: boolean; item?: Interview }>({ open: false });

  const reached = [...new Set(o.statusHistory.map((h) => h.toStatus))];
  const stageSince = o.statusHistory.at(-1)?.changedAt ?? o.createdAt;
  const daysInStage = Math.floor((now - stageSince.getTime()) / 86_400_000);
  const activities = timeline.filter((t) => t.kind !== "interview");

  const details: [string, React.ReactNode][] = [
    ["Type", EMPLOYMENT_META[o.employmentType].label],
    ["Work mode", o.workMode ? REMOTE_META[o.workMode].label : null],
    ["Country", o.country],
    ["Source", o.source ? SOURCE_META[o.source].label : null],
    ["Stipend / salary", o.compensation],
    ["Applied", o.appliedAt ? <DateText key="a" value={o.appliedAt} /> : null],
    ["Deadline", o.deadline ? <DateText key="d" value={o.deadline} /> : null],
    [
      "Resume",
      o.resumeVersion ? (
        o.resumeVersion.filePath || o.resumeVersion.fileUrl ? (
          <a key="r" href={o.resumeVersion.filePath ? `/api/resumes/${o.resumeVersion.id}` : o.resumeVersion.fileUrl!} target="_blank" rel="noreferrer" className="hover:underline">
            {o.resumeVersion.name}
          </a>
        ) : (
          o.resumeVersion.name
        )
      ) : null,
    ],
    ["Cover letter", o.coverLetterUsed ? "Sent" : "No"],
    ["Priority", <span key="p" className="inline-flex items-center gap-1.5">{o.priority === 1 ? "High" : o.priority === 2 ? "Medium" : "Low"}<PriorityBars priority={o.priority} /></span>],
    ["Excitement", <Dots key="e" value={o.excitement} max={5} label="Excitement" />],
    [
      "Referred by",
      o.referredBy ? (
        <Link key="ref" href={`/contacts/${o.referredBy.id}`} className="hover:underline">
          {o.referredBy.name}
        </Link>
      ) : null,
    ],
  ];
  if (o.status === "rejected") {
    details.unshift(["Rejected at", o.rejectedAtStage ? STATUS_META[o.rejectedAtStage].label : null], ["Reason", o.rejectionReason]);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CompanyAvatar name={o.company.name} logoUrl={o.company.logoUrl} className="size-14 rounded-xl text-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">{o.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted-foreground">
            <Link href={`/companies/${o.company.id}`} className="font-medium text-foreground hover:underline hover:underline-offset-2">
              {o.company.name}
            </Link>
            <TierBadge tier={o.company.tier} />
            <span>·</span>
            <span>
              {daysInStage === 0 ? "entered" : `${daysInStage} day${daysInStage === 1 ? "" : "s"} in`} {STATUS_META[o.status].label.toLowerCase()}
              {daysInStage === 0 && " today"}
            </span>
            {o.tags.map((t) => (
              <span key={t} className="text-xs">
                #{t}
              </span>
            ))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={() =>
              quickLog({ type: o.status === "wishlist" ? "application" : "follow_up", companyId: o.company.id, opportunityId: o.id })
            }
          >
            <Plus data-icon="inline-start" />
            {o.status === "wishlist" ? "Log application" : "Log activity"}
          </Button>
          {o.jobUrl && (
            <Button variant="outline" asChild>
              <a href={o.jobUrl} target="_blank" rel="noreferrer">
                <ExternalLink data-icon="inline-start" />
                Posting
              </a>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInterview({ open: true })}>
                <CalendarPlus />
                Schedule interview
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("opportunities", [o.id], o.title, () => router.push("/opportunities"))}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <StatusStepper opportunityId={o.id} status={o.status} reached={reached} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel
            title={`Interviews · ${o.interviews.length}`}
            action={
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setInterview({ open: true })}>
                <Plus data-icon="inline-start" />
                Schedule
              </Button>
            }
            bodyClassName="p-0"
          >
            {o.interviews.length ? (
              <ul className="divide-y">
                {o.interviews.map((iv) => {
                  const outcome = INTERVIEW_OUTCOME_META[iv.outcome];
                  const upcoming = iv.scheduledAt.getTime() > now;
                  return (
                    <li key={iv.id}>
                      <button type="button" onClick={() => setInterview({ open: true, item: iv })} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50">
                        <div className="flex w-11 shrink-0 flex-col items-center rounded-md border py-1 leading-none">
                          <span className="text-[0.625rem] font-medium text-muted-foreground uppercase">{formatTz(iv.scheduledAt, timezone, "MMM")}</span>
                          <span className="tabular mt-0.5 text-base font-semibold">{formatTz(iv.scheduledAt, timezone, "d")}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-[0.84375rem] font-medium">
                            {INTERVIEW_STAGE_META[iv.stage].label}
                            {upcoming && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[0.625rem] text-brand">upcoming</span>}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                            <span>
                              {formatTz(iv.scheduledAt, timezone, "EEE HH:mm")} · {iv.durationMinutes} min
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="size-1.5 rounded-full" style={{ backgroundColor: outcome.color }} />
                              {outcome.label}
                            </span>
                            {iv.selfRating && <span>felt {iv.selfRating}/5</span>}
                            {iv.interviewers.length > 0 && <span>with {iv.interviewers.map((x) => x.contact.name).join(", ")}</span>}
                          </p>
                          {iv.prepNotes && upcoming && <p className="mt-1 line-clamp-2 text-xs text-foreground/75">{iv.prepNotes}</p>}
                          {iv.feedback && <p className="mt-1 line-clamp-2 text-xs text-foreground/75">“{iv.feedback}”</p>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex items-center gap-3 px-4 py-4 text-sm text-muted-foreground">
                <Video className="size-4" strokeWidth={1.75} />
                No interviews yet.
              </div>
            )}
          </Panel>

          <Tabs defaultValue="activity" className="gap-3">
            <TabsList>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="jd">Job description</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="activity" className="rounded-xl border bg-card p-4 md:p-5">
              <Timeline items={activities} now={now} show={{ contact: true, opportunity: false }} />
            </TabsContent>
            <TabsContent value="jd" className="rounded-xl border bg-card p-4 md:p-5">
              {o.jobDescription ? (
                <Markdown>{o.jobDescription}</Markdown>
              ) : (
                <EmptyText onEdit={() => setEditing(true)}>Paste the job description so it&apos;s searchable after the posting disappears.</EmptyText>
              )}
            </TabsContent>
            <TabsContent value="notes" className="rounded-xl border bg-card p-4 md:p-5">
              {o.notes ? <Markdown>{o.notes}</Markdown> : <EmptyText onEdit={() => setEditing(true)}>No notes yet.</EmptyText>}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <Panel
            title="Details"
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => setEditing(true)} aria-label="Edit details">
                <Pencil />
              </Button>
            }
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.8125rem]">
              {details
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 text-right break-words">{v}</dd>
                  </div>
                ))}
            </dl>
          </Panel>
          <Panel title="People" bodyClassName="p-0">
            {o.contacts.length ? (
              <ul className="divide-y">
                {o.contacts.map((c) => (
                  <li key={c.id}>
                    <Link href={`/contacts/${c.id}`} className="block px-4 py-2.5 hover:bg-muted/50">
                      <span className="block truncate text-[0.8125rem] font-medium">{c.name}</span>
                      {c.role && <span className="block truncate text-xs text-muted-foreground">{c.role}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nobody linked yet.</p>
            )}
          </Panel>
        </aside>
      </div>

      <OpportunityForm
        open={editing}
        onOpenChange={setEditing}
        id={o.id}
        initial={{
          companyId: o.companyId,
          title: o.title,
          employmentType: o.employmentType,
          workMode: o.workMode ?? "",
          country: o.country ?? "",
          jobUrl: o.jobUrl ?? "",
          source: o.source ?? "",
          status: o.status,
          compensation: o.compensation ?? "",
          deadline: o.deadline,
          resumeVersionId: o.resumeVersionId,
          coverLetterUsed: o.coverLetterUsed,
          priority: o.priority,
          excitement: o.excitement,
          notes: o.notes ?? "",
          jobDescription: o.jobDescription ?? "",
          rejectionReason: o.rejectionReason ?? "",
          referredByContactId: o.referredByContactId,
          contactIds: o.contacts.map((c) => c.id),
          tags: o.tags,
        }}
        onSaved={() => router.refresh()}
      />
      <InterviewForm
        open={interview.open}
        onOpenChange={(open) => setInterview((s) => ({ ...s, open }))}
        opportunityId={o.id}
        companyId={o.companyId}
        id={interview.item?.id}
        initial={
          interview.item
            ? {
                stage: interview.item.stage,
                scheduledAt: interview.item.scheduledAt,
                durationMinutes: interview.item.durationMinutes,
                prepNotes: interview.item.prepNotes ?? "",
                questionsAsked: interview.item.questionsAsked ?? "",
                selfRating: interview.item.selfRating,
                outcome: interview.item.outcome,
                feedback: interview.item.feedback ?? "",
                interviewerIds: interview.item.interviewers.map((x) => x.contactId),
              }
            : undefined
        }
      />
    </div>
  );
}

function EmptyText({ children, onEdit }: { children: React.ReactNode; onEdit: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
      <p>{children}</p>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil data-icon="inline-start" />
        Add
      </Button>
    </div>
  );
}
