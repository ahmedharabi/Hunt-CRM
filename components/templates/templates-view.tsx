"use client";

import { useState } from "react";
import { Copy, FileText, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { TemplateForm } from "@/components/forms/template-form";
import { UseTemplateDialog } from "@/components/detail/use-template-dialog";
import { deleteWithUndo } from "@/lib/client/mutate";
import { ACTIVITY_META, TEMPLATE_TYPE_META } from "@/lib/meta";
import { MIN_SAMPLE, pct } from "@/lib/analytics-constants";
import type { Template } from "@/db/schema";
import type { TemplateType } from "@/lib/domain";

type Stats = Record<number, { sent: number; replied: number }>;

export function TemplatesView({ templates, stats }: { templates: Template[]; stats: Stats }) {
  const [form, setForm] = useState<{ open: boolean; id?: number; initial?: Partial<Template> }>({ open: false });
  const [using, setUsing] = useState<number | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setForm({ open: true })}>
          <Plus data-icon="inline-start" />
          New template
        </Button>
      </div>
      {templates.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={FileText}
            title="No templates yet"
            description="Write your cold email, DM and follow-up once, with {{first_name}}, {{company}} and {{role}} filled in for each person."
            action={
              <Button size="sm" onClick={() => setForm({ open: true })}>
                <Plus data-icon="inline-start" />
                Write one
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const meta = TEMPLATE_TYPE_META[t.type as TemplateType];
            const Icon = ACTIVITY_META[meta.activity].icon;
            const s = stats[t.id];
            const rate = s && s.sent ? s.replied / s.sent : null;
            return (
              <article key={t.id} className="group flex flex-col rounded-xl border bg-card">
                <header className="flex items-start gap-3 px-4 pt-4">
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ color: ACTIVITY_META[meta.activity].color, backgroundColor: `color-mix(in oklch, ${ACTIVITY_META[meta.activity].color} 12%, transparent)` }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[0.875rem] font-medium">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{meta.label}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setForm({ open: true, id: t.id, initial: t })}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setForm({ open: true, initial: { ...t, name: `${t.name} (copy)` } })}>
                        <Copy />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => deleteWithUndo("templates", [t.id], t.name)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </header>
                <div className="mx-4 mt-3 flex-1 rounded-lg bg-muted/40 px-3 py-2.5 text-[0.8125rem] leading-relaxed text-foreground/80">
                  {t.subject && <p className="mb-1 truncate font-medium text-foreground">{t.subject}</p>}
                  <p className="line-clamp-5 whitespace-pre-line">
                    {t.body.split(/(\{\{[^}]+\}\})/).map((part, i) =>
                      part.startsWith("{{") ? (
                        <span key={i} className="rounded bg-brand-soft px-0.5 font-mono text-[0.75rem] text-brand">
                          {part}
                        </span>
                      ) : (
                        part
                      ),
                    )}
                  </p>
                </div>
                <footer className="flex items-center justify-between gap-2 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {s && s.sent ? (
                      <>
                        Sent <span className="tabular font-medium text-foreground">{s.sent}</span> ·{" "}
                        <span className="tabular font-medium text-foreground">{pct(rate!)}</span> replied
                        {s.sent < MIN_SAMPLE && " · small sample"}
                      </>
                    ) : (
                      "Not used yet"
                    )}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setUsing(t.id)}>
                    <Send data-icon="inline-start" />
                    Use
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <TemplateForm
        open={form.open}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        id={form.id}
        initial={form.initial ? { name: form.initial.name, type: form.initial.type, subject: form.initial.subject ?? "", body: form.initial.body } : undefined}
      />
      <UseTemplateDialog open={using !== null} onOpenChange={(o) => !o && setUsing(null)} templateId={using} />
    </>
  );
}
