"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, FileText, FileType, Globe, Mail, PenLine, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DocumentForm } from "@/components/documents/document-form";
import { DOCUMENT_KIND_META, documentFormat, type DocumentFormat, type DocumentItem } from "@/lib/documents";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const FORMAT_META: Record<DocumentFormat, { label: string; icon: LucideIcon }> = {
  pdf: { label: "PDF", icon: FileText },
  word: { label: "Word", icon: FileType },
  markdown: { label: "Markdown", icon: FileText },
  text: { label: "Text", icon: FileText },
  link: { label: "Link", icon: Globe },
  written: { label: "Written here", icon: PenLine },
  empty: { label: "No file", icon: FileText },
};

/** Opens the add dialog for either kind. Remounts per open so it starts clean. */
export function AddDocumentButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const [adding, setAdding] = useState<DocumentKind | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size={size}>
            <Plus data-icon="inline-start" />
            Add
            <ChevronDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setAdding("resume")}>
            <FileText />
            CV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAdding("cover_letter")}>
            <Mail />
            Cover letter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {adding && <DocumentForm key={adding} open onOpenChange={(o) => !o && setAdding(null)} kind={adding} />}
    </>
  );
}

export function DocumentsList({ docs }: { docs: DocumentItem[] }) {
  const params = useParams<{ id?: string }>();
  const activeId = params.id ? Number(params.id) : null;

  return (
    // On phones the list and the open document take turns.
    <aside className={cn("flex min-h-0 flex-col rounded-xl border bg-card", activeId !== null && "hidden md:flex")}>
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <p className="text-sm font-medium">Documents</p>
        <AddDocumentButton />
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1.5 pt-3" aria-label="Documents">
        {DOCUMENT_KINDS.map((kind) => {
          const group = docs.filter((d) => d.kind === kind);
          return (
            <section key={kind}>
              <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                {DOCUMENT_KIND_META[kind].plural} <span className="tabular">· {group.length}</span>
              </h3>
              {group.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground/80">None yet.</p>
              ) : (
                <ul className="space-y-0.5">
                  {group.map((d) => {
                    const format = FORMAT_META[documentFormat(d)];
                    return (
                      <li key={d.id}>
                        <Link
                          href={`/documents/${d.id}`}
                          aria-current={d.id === activeId ? "page" : undefined}
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60",
                            d.id === activeId && "bg-muted hover:bg-muted",
                          )}
                        >
                          <format.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.85} />
                          <span className="min-w-0">
                            <span className="block truncate text-[0.8125rem] font-medium">{d.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {format.label}
                              {kind === "resume" && ` · ${d.applications} application${d.applications === 1 ? "" : "s"}`}
                              {d.description && ` · ${d.description}`}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
