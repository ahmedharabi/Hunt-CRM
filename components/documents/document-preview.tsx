"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, ExternalLink, FileType, Globe, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { Markdown } from "@/components/shared/markdown";
import { DocumentForm } from "@/components/documents/document-form";
import { FORMAT_META } from "@/components/documents/documents-list";
import { useLookups } from "@/components/providers/lookups";
import { deleteWithUndo } from "@/lib/client/mutate";
import { DOCUMENT_KIND_META, documentFormat, embeddableUrl, storedFile, type DocumentItem } from "@/lib/documents";

/** `text` is the contents of an uploaded .md/.txt file, read on the server. */
export function DocumentPreview({ doc, text }: { doc: DocumentItem; text: string | null }) {
  const router = useRouter();
  const { refresh } = useLookups();
  const [editing, setEditing] = useState(false);
  const format = documentFormat(doc);
  const fileHref = doc.filePath ? `/api/resumes/${doc.id}` : null;
  const openHref = fileHref ?? doc.fileUrl;
  const copyable = format === "written" ? doc.content : text;

  const remove = async () => {
    // Leave first so the page doesn't re-render a document that no longer exists.
    router.push("/documents");
    if (await deleteWithUndo("resumes", [doc.id], doc.name)) void refresh();
  };

  return (
    <section className="flex min-h-[70svh] min-w-0 flex-col rounded-xl border bg-card md:min-h-0">
      <header className="flex items-start gap-2 border-b px-3 py-2.5">
        <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
          <Link href="/documents" aria-label="All documents">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 px-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-[-0.01em]">{doc.name}</h2>
            <Badge variant="secondary" className="shrink-0">
              {DOCUMENT_KIND_META[doc.kind].label}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {FORMAT_META[format].label}
            {doc.filePath && ` · ${storedFile(doc.filePath).original}`}
            {doc.kind === "resume" && ` · used in ${doc.applications} application${doc.applications === 1 ? "" : "s"}`}
            {doc.description && ` · ${doc.description}`}
          </p>
        </div>
        {copyable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard.writeText(copyable).then(() => toast.success("Copied"), () => toast.error("Couldn't copy"))}
          >
            <Copy data-icon="inline-start" />
            <span className="hidden sm:inline">Copy text</span>
          </Button>
        )}
        {openHref && (
          <Button variant="outline" size="icon-sm" asChild>
            <a href={openHref} target="_blank" rel="noreferrer" aria-label="Open in a new tab">
              <ExternalLink />
            </a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Document actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            {fileHref && (
              <DropdownMenuItem asChild>
                <a href={`${fileHref}?download`}>
                  <Download />
                  Download
                </a>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={remove}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <Body doc={doc} text={text} onEdit={() => setEditing(true)} />
      </div>

      {editing && <DocumentForm key={doc.updatedAt} open onOpenChange={setEditing} doc={doc} />}
    </section>
  );
}

function Body({ doc, text, onEdit }: { doc: DocumentItem; text: string | null; onEdit: () => void }) {
  const format = documentFormat(doc);
  const frame = (src: string) => (
    // The browser's own PDF viewer: zoom, page nav and print for free.
    <iframe key={src} src={src} title={`Preview of ${doc.name}`} className="min-h-[70svh] w-full flex-1 rounded-b-xl bg-muted/30 md:min-h-0" />
  );

  if (format === "pdf") return frame(`/api/resumes/${doc.id}#view=FitH`);

  if (format === "written" || format === "markdown" || format === "text") {
    const body = format === "written" ? doc.content! : text;
    if (body == null) return <Missing />;
    return (
      <div className="flex-1 overflow-y-auto bg-muted/30 p-4 md:p-8">
        {/* A page, so it reads like what you'll send. */}
        <article className="mx-auto max-w-[46rem] rounded-lg border bg-background px-6 py-8 shadow-xs md:px-12 md:py-12">
          {format === "text" ? (
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{body}</pre>
          ) : (
            <Markdown className="text-[0.875rem]">{body}</Markdown>
          )}
        </article>
      </div>
    );
  }

  if (format === "link") {
    const embed = embeddableUrl(doc.fileUrl!);
    if (embed) return frame(embed);
    return (
      <EmptyState
        icon={Globe}
        title="This link can't be previewed here"
        description="Most sites block being shown inside another page. Google Drive, Google Docs and direct PDF links do preview."
        action={
          <Button asChild>
            <a href={doc.fileUrl!} target="_blank" rel="noreferrer">
              <ExternalLink data-icon="inline-start" />
              Open link
            </a>
          </Button>
        }
        className="my-auto"
      />
    );
  }

  if (format === "word") {
    return (
      <EmptyState
        icon={FileType}
        title="Word files can't be previewed in the browser"
        description="Download it, or export it as PDF and upload that instead to see it here."
        action={
          <>
            <Button variant="outline" asChild>
              <a href={`/api/resumes/${doc.id}?download`}>
                <Download data-icon="inline-start" />
                Download
              </a>
            </Button>
            <Button onClick={onEdit}>Upload a PDF</Button>
          </>
        }
        className="my-auto"
      />
    );
  }

  return (
    <EmptyState
      icon={Pencil}
      title="Nothing attached yet"
      description="Upload a file, paste a link, or write it here."
      action={<Button onClick={onEdit}>Add content</Button>}
      className="my-auto"
    />
  );
}

function Missing() {
  return <EmptyState icon={FileType} title="File missing" description="It's no longer in ./data/uploads. Edit the document to upload it again." className="my-auto" />;
}
