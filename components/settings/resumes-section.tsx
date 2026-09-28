"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, LoaderCircle, Paperclip, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLookups } from "@/components/providers/lookups";
import { saveResume } from "@/lib/actions/misc";
import { deleteWithUndo } from "@/lib/client/mutate";

type Resume = { id: number; name: string; description: string | null; fileUrl: string | null; filePath: string | null; applications: number };

export function ResumesSection({ resumes }: { resumes: Resume[] }) {
  const router = useRouter();
  const { refresh } = useLookups();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border bg-card">
      {resumes.length ? (
        <ul className="divide-y">
          {resumes.map((r) => {
            const href = r.filePath ? `/api/resumes/${r.id}` : r.fileUrl;
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.85} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.84375rem] font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.applications} application{r.applications === 1 ? "" : "s"}
                    {r.description && ` · ${r.description}`}
                  </p>
                </div>
                {href && (
                  <Button variant="ghost" size="icon-sm" asChild aria-label={`Open ${r.name}`}>
                    <a href={href} target="_blank" rel="noreferrer">
                      {r.filePath ? <Paperclip /> : <ExternalLink />}
                    </a>
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${r.name}`} onClick={() => deleteWithUndo("resumes", [r.id], r.name)}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">Add each version of your CV to see which one gets interviews.</p>
      )}
      <div className="border-t px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          Add resume version
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add resume version</DialogTitle>
            <DialogDescription>Upload the file (stored in ./data/uploads) or paste a link.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await saveResume(new FormData(e.currentTarget));
              setBusy(false);
              if (!r.ok) return toast.error(r.error);
              toast.success("Resume added");
              setOpen(false);
              void refresh();
              router.refresh();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rv-name">Name</Label>
              <Input id="rv-name" name="name" required placeholder="Backend · Go v4" className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-desc">What&apos;s different</Label>
              <Input id="rv-desc" name="description" placeholder="Leads with the Kubernetes operator project" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-file">File</Label>
              <Input id="rv-file" name="file" type="file" accept=".pdf,.doc,.docx,.md,.txt" className="h-9 pt-1.5" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-url">…or link</Label>
              <Input id="rv-url" name="fileUrl" placeholder="https://drive.google.com/…" className="h-9" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
