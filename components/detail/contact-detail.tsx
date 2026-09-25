"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, MessageSquareText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CompanyAvatar } from "@/components/shared/company-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Markdown } from "@/components/shared/markdown";
import { CompanyLocalTime } from "@/components/shared/local-time";
import { RelativeTime } from "@/components/shared/relative-time";
import { LinkedInIcon } from "@/components/brand/icons";
import { ContactForm } from "@/components/forms/contact-form";
import { useAppActions } from "@/components/quick-log/app-actions";
import { deleteWithUndo } from "@/lib/client/mutate";
import { CONTACT_TYPE_META } from "@/lib/meta";
import type { TimelineItem } from "@/lib/queries/records";
import type { Company, Contact } from "@/db/schema";
import type { OpportunityStatus } from "@/lib/domain";
import { Panel, StatStrip } from "./parts";
import { Timeline } from "./timeline";
import { UseTemplateDialog } from "./use-template-dialog";

export function ContactDetail({
  contact,
  opportunities,
  timeline,
  now,
}: {
  contact: Contact & { company: Company | null };
  opportunities: { id: number; title: string; status: OpportunityStatus }[];
  timeline: TimelineItem[];
  now: number;
}) {
  const router = useRouter();
  const { quickLog } = useAppActions();
  const [editing, setEditing] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const acts = timeline.filter((t) => t.kind === "activity");
  const sent = acts.filter((a) => a.kind === "activity" && a.direction === "outbound").length;
  const replies = acts.filter((a) => a.kind === "activity" && a.direction === "inbound").length;
  const initials = contact.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const company = contact.company && !contact.company.deletedAt ? contact.company : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">{initials}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">{contact.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
            {contact.role && <span>{contact.role}</span>}
            {company && (
              <>
                {contact.role && <span>at</span>}
                <Link href={`/companies/${company.id}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline hover:underline-offset-2">
                  <CompanyAvatar name={company.name} logoUrl={company.logoUrl} className="size-4 rounded text-[7px]" />
                  {company.name}
                </Link>
              </>
            )}
            {contact.contactType && <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{CONTACT_TYPE_META[contact.contactType].label}</span>}
            <CompanyLocalTime timezone={company?.timezone ?? null} />
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted">
                <Mail className="size-3.5" strokeWidth={1.85} />
                {contact.email}
              </a>
            )}
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted">
                <LinkedInIcon className="size-3.5" />
                LinkedIn
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => setMessaging(true)}>
            <MessageSquareText data-icon="inline-start" />
            Message
          </Button>
          <Button variant="outline" onClick={() => quickLog({ type: "linkedin_dm", companyId: contact.companyId, contactId: contact.id })}>
            <Plus data-icon="inline-start" />
            Log
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Edit contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("contacts", [contact.id], contact.name, () => router.push("/contacts"))}>
                <Trash2 />
                Delete contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <StatStrip
        items={[
          { label: "Messages sent", value: sent },
          { label: "Replies", value: replies },
          { label: "Reply rate", value: sent ? `${Math.round((replies / sent) * 100)}%` : "—" },
          { label: "Last contacted", value: <RelativeTime value={contact.lastContactedAt} now={now} /> },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-xl border bg-card p-4 md:p-5">
          <h3 className="mb-4 text-[13px] font-medium">Interactions</h3>
          <Timeline items={timeline} now={now} show={{ contact: false, opportunity: true }} />
        </section>
        <aside className="space-y-4">
          <Panel title="Involved in" bodyClassName="p-0">
            {opportunities.length ? (
              <ul className="divide-y">
                {opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/opportunities/${o.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50">
                      <span className="truncate text-[13px] font-medium">{o.title}</span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Not linked to any opportunity.</p>
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
            {contact.notes ? <Markdown>{contact.notes}</Markdown> : <p className="text-sm text-muted-foreground">How you met, what they work on, what to ask next time.</p>}
          </Panel>
        </aside>
      </div>

      <ContactForm
        open={editing}
        onOpenChange={setEditing}
        id={contact.id}
        initial={{
          name: contact.name,
          companyId: contact.companyId,
          role: contact.role ?? "",
          contactType: contact.contactType ?? "",
          email: contact.email ?? "",
          linkedinUrl: contact.linkedinUrl ?? "",
          notes: contact.notes ?? "",
        }}
        onSaved={() => router.refresh()}
      />
      <UseTemplateDialog open={messaging} onOpenChange={setMessaging} contactId={contact.id} opportunityId={opportunities[0]?.id ?? null} />
    </div>
  );
}
