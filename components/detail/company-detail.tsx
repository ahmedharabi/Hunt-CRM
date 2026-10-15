"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, MapPin, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { TierBadge } from "@/components/shared/badges";
import { StatusBadge } from "@/components/shared/status-badge";
import { Markdown } from "@/components/shared/markdown";
import { CompanyLocalTime } from "@/components/shared/local-time";
import { RelativeTime } from "@/components/shared/relative-time";
import { LinkedInIcon } from "@/components/brand/icons";
import { CompanyForm } from "@/components/forms/company-form";
import { useAppActions } from "@/components/quick-log/app-actions";
import { deleteWithUndo } from "@/lib/client/mutate";
import { REMOTE_META } from "@/lib/meta";
import type { CompanyRow, ContactRow, OpportunityRow, TimelineItem } from "@/lib/queries/records";
import type { Company } from "@/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutreachPeople } from "@/components/outreach/outreach-tree";
import { CompanyGraph, StageLegend } from "@/components/outreach/outreach-graph";
import { useOutreachView, ViewToggle } from "@/components/outreach/outreach-board";
import type { OutreachCompany } from "@/lib/outreach";
import { Panel, MetaItem, StatStrip } from "./parts";
import { Timeline } from "./timeline";

type Props = {
  company: Company & { tags: string[] };
  contacts: ContactRow[];
  opportunities: OpportunityRow[];
  timeline: TimelineItem[];
  outreach: OutreachCompany;
  now: number;
};

export function CompanyDetail({ company, contacts, opportunities, timeline, outreach, now }: Props) {
  const router = useRouter();
  const { quickLog, addContact, addOpportunity } = useAppActions();
  const [editing, setEditing] = useState(false);
  const [view, setView] = useOutreachView();

  const acts = timeline.filter((t) => t.kind === "activity");
  const sent = acts.filter((a) => a.kind === "activity" && a.direction === "outbound").length;
  const replies = acts.filter((a) => a.kind === "activity" && a.direction === "inbound").length;
  const last = acts[0]?.at ?? null;
  const domain = company.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <CompanyAvatar name={company.name} logoUrl={company.logoUrl} className="size-14 rounded-xl text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.025em]">{company.name}</h2>
            <TierBadge tier={company.tier} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
            {company.industry && <span>{company.industry}</span>}
            {company.size && <MetaItem icon={Users}>{company.size}</MetaItem>}
            {(company.hqLocation || company.country) && (
              <MetaItem icon={MapPin}>{[company.hqLocation, company.country].filter(Boolean).join(", ")}</MetaItem>
            )}
            {company.remotePolicy && <span>{REMOTE_META[company.remotePolicy].label}</span>}
            <CompanyLocalTime timezone={company.timezone} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {domain && (
              <a href={company.website!} target="_blank" rel="noreferrer" className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted">
                <Globe className="size-3.5" strokeWidth={1.85} />
                {domain}
              </a>
            )}
            {company.linkedinUrl && (
              <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted">
                <LinkedInIcon className="size-3.5" />
                LinkedIn
              </a>
            )}
            {company.techStack.map((t) => (
              <span key={t} className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs">
                {t}
              </span>
            ))}
            {company.tags.map((t) => (
              <span key={t} className="inline-flex h-6 items-center rounded-md px-1.5 text-xs text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => quickLog({ companyId: company.id })}>
            <Plus data-icon="inline-start" />
            Log activity
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => addOpportunity({ companyId: company.id })}>New opportunity</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => addContact({ companyId: company.id })}>Add contact</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => deleteWithUndo("companies", [company.id], company.name, () => router.push("/companies"))}
              >
                <Trash2 />
                Delete company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <StatStrip
        items={[
          { label: "Messages sent", value: sent },
          { label: "Replies", value: replies },
          { label: "Open roles", value: opportunities.filter((o) => ["wishlist", "applied", "screening", "interviewing", "offer"].includes(o.status)).length },
          { label: "Last activity", value: last ? <RelativeTime value={last} now={now} /> : "—" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Tabs defaultValue={contacts.length ? "outreach" : "timeline"} className="min-w-0 gap-3">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="outreach">Outreach · {contacts.length}</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <ViewToggle view={view} onChange={setView} />
          </div>
          <TabsContent value="outreach" className="space-y-3">
            {view === "graph" ? (
              <>
                {outreach.people.length > 0 && <StageLegend />}
                <CompanyGraph company={outreach} now={now} linkCompany={false} />
              </>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card [&>ul]:border-t-0">
                <OutreachPeople company={outreach} now={now} />
              </div>
            )}
          </TabsContent>
          <TabsContent value="timeline" className="rounded-xl border bg-card p-4 md:p-5">
            <Timeline items={timeline} now={now} show={{ contact: true, opportunity: true }} />
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Panel
            title={`Opportunities · ${opportunities.length}`}
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => addOpportunity({ companyId: company.id })} aria-label="New opportunity">
                <Plus />
              </Button>
            }
            bodyClassName="p-0"
          >
            {opportunities.length ? (
              <ul className="divide-y">
                {opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/opportunities/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50">
                      <span className="truncate text-[0.8125rem] font-medium">{o.title}</span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">No roles tracked here yet.</p>
            )}
          </Panel>

          <Panel
            title="Notes"
            action={
              <Button variant="ghost" size="icon-xs" onClick={() => setEditing(true)} aria-label="Edit notes">
                <Pencil />
              </Button>
            }
          >
            {company.notes ? <Markdown>{company.notes}</Markdown> : <p className="text-sm text-muted-foreground">Nothing yet. Culture, blog posts, people to ask for referrals…</p>}
          </Panel>
        </aside>
      </div>

      <CompanyForm
        open={editing}
        onOpenChange={setEditing}
        id={company.id}
        initial={{
          name: company.name,
          website: company.website ?? "",
          linkedinUrl: company.linkedinUrl ?? "",
          logoUrl: company.logoUrl ?? "",
          industry: company.industry ?? "",
          size: company.size ?? "",
          hqLocation: company.hqLocation ?? "",
          country: company.country ?? "",
          timezone: company.timezone ?? "",
          remotePolicy: company.remotePolicy ?? "",
          techStack: company.techStack,
          tier: company.tier,
          notes: company.notes ?? "",
          tags: company.tags,
        }}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

export type { CompanyRow };
