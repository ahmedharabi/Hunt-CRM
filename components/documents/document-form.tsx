"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle, PenLine, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLookups } from "@/components/providers/lookups";
import { saveResume } from "@/lib/actions/misc";
import { DOCUMENT_KIND_META, documentFormat, storedFile, type DocumentItem } from "@/lib/documents";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/domain";

type Source = "file" | "link" | "write";

function initialSource(doc?: DocumentItem): Source {
  if (!doc) return "file";
  const format = documentFormat(doc);
  return format === "written" ? "write" : format === "link" ? "link" : "file";
}

/** Add or edit a CV / cover letter: upload a file, paste a link, or write it here. */
export function DocumentForm({
  open,
  onOpenChange,
  doc,
  kind: defaultKind = "resume",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc?: DocumentItem;
  kind?: DocumentKind;
}) {
  const router = useRouter();
  const { refresh } = useLookups();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentKind>(doc?.kind ?? defaultKind);
  const [source, setSource] = useState<Source>(initialSource(doc));
  const label = DOCUMENT_KIND_META[kind].label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{doc ? `Edit ${doc.name}` : `Add ${label.toLowerCase()}`}</DialogTitle>
          <DialogDescription>Upload a file (kept in ./data/uploads), paste a link, or write it here in markdown.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await saveResume(new FormData(e.currentTarget), doc?.id);
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            toast.success(doc ? "Saved" : `${label} added`);
            onOpenChange(false);
            void refresh();
            if (doc) router.refresh();
            else router.push(`/documents/${r.data.id}`);
          }}
        >
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="source" value={source} />
          <div className="space-y-1.5">
            <Label>Type</Label>
            <ToggleGroup type="single" variant="outline" size="sm" value={kind} onValueChange={(v) => v && setKind(v as DocumentKind)}>
              {DOCUMENT_KINDS.map((k) => (
                <ToggleGroupItem key={k} value={k}>
                  {DOCUMENT_KIND_META[k].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-name">Name</Label>
              <Input
                id="doc-name"
                name="name"
                required
                defaultValue={doc?.name}
                placeholder={kind === "resume" ? "Backend · Go v4" : "Cloud-native startups"}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-desc">What&apos;s different</Label>
              <Input
                id="doc-desc"
                name="description"
                defaultValue={doc?.description ?? ""}
                placeholder={kind === "resume" ? "Leads with the Kubernetes operator project" : "Short, for DevOps internships"}
                className="h-9"
              />
            </div>
          </div>

          <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
            <TabsList>
              <TabsTrigger value="file">
                <Upload /> Upload
              </TabsTrigger>
              <TabsTrigger value="link">
                <Link2 /> Link
              </TabsTrigger>
              <TabsTrigger value="write">
                <PenLine /> Write
              </TabsTrigger>
            </TabsList>
            {/* Kept mounted so switching tabs doesn't lose what you typed. */}
            <TabsContent value="file" forceMount className="space-y-1.5 data-[state=inactive]:hidden">
              <Input name="file" type="file" accept=".pdf,.doc,.docx,.md,.txt" aria-label="File" className="h-9 pt-1.5" />
              <p className="text-xs text-muted-foreground">
                {doc?.filePath
                  ? `Current file: ${storedFile(doc.filePath).original}. Pick another to replace it.`
                  : "PDF previews best. Word files can be downloaded but not previewed. Up to 10 MB."}
              </p>
            </TabsContent>
            <TabsContent value="link" forceMount className="space-y-1.5 data-[state=inactive]:hidden">
              <Input name="fileUrl" defaultValue={doc?.fileUrl ?? ""} placeholder="https://drive.google.com/file/d/…" aria-label="Link" className="h-9" />
              <p className="text-xs text-muted-foreground">Google Drive and Google Docs links show a preview. Other sites open in a new tab.</p>
            </TabsContent>
            <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
              <Textarea
                name="content"
                defaultValue={doc?.content ?? ""}
                rows={14}
                aria-label="Content"
                placeholder={
                  kind === "cover_letter"
                    ? "Dear hiring team,\n\nI'm a software engineering student…"
                    : "# Your Name\n\n## Experience\n- …"
                }
                className="max-h-[50svh] font-mono text-[0.8125rem] leading-relaxed"
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}
              {doc ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
