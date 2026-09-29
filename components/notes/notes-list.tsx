"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LoaderCircle, NotebookPen, Pin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/shared/relative-time";
import { createNote } from "@/lib/actions/notes";
import { mutate } from "@/lib/client/mutate";
import { cn } from "@/lib/utils";
import type { NoteListItem } from "@/lib/queries/records";

export function NewNoteButton({ size = "sm" }: { size?: "sm" | "default" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await mutate(createNote());
          if (r) router.push(`/notes/${r.id}`);
        })
      }
    >
      {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
      New note
    </Button>
  );
}

export function NotesList({ notes, now }: { notes: NoteListItem[]; now: number }) {
  const params = useParams<{ id?: string }>();
  const activeId = params.id ? Number(params.id) : null;
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? notes.filter((n) => `${n.title} ${n.preview}`.toLowerCase().includes(q)) : notes;

  return (
    // On phones the list and the open note take turns.
    <aside className={cn("flex min-h-0 flex-col rounded-xl border bg-card", activeId !== null && "hidden md:flex")}>
      <div className="flex items-center gap-2 border-b p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter notes" aria-label="Filter notes" className="h-8 pl-8" />
        </div>
        <NewNoteButton />
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Notes">
        {shown.length === 0 ? (
          <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <NotebookPen className="size-4" />
            {q ? `No notes match “${query.trim()}”.` : "No notes yet."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  aria-current={n.id === activeId ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/60",
                    n.id === activeId && "bg-muted hover:bg-muted",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {n.pinned && <Pin className="size-3 shrink-0 text-brand" aria-label="Pinned" />}
                    <span className={cn("truncate text-[0.8125rem] font-medium", !n.title && "text-muted-foreground")}>{n.title || "Untitled"}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.preview || "Empty note"}</span>
                  <span className="mt-1 block text-[0.6875rem] text-muted-foreground/80">
                    <RelativeTime value={n.updatedAt} now={now} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
