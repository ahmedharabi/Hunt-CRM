import type { DocumentKind } from "./domain";

/** A CV or cover letter as the Documents page sees it. */
export type DocumentItem = {
  id: number;
  kind: DocumentKind;
  name: string;
  description: string | null;
  fileUrl: string | null;
  filePath: string | null;
  content: string | null;
  createdAt: number;
  updatedAt: number;
  applications: number;
};

export type DocumentFormat = "pdf" | "word" | "markdown" | "text" | "link" | "written" | "empty";

export const DOCUMENT_KIND_META: Record<DocumentKind, { label: string; plural: string }> = {
  resume: { label: "CV", plural: "CVs" },
  cover_letter: { label: "Cover letter", plural: "Cover letters" },
};

/** `file_path` is "<stored uuid name>|<original name>". */
export function storedFile(filePath: string) {
  const [stored, original] = filePath.split("|");
  return { stored, original: original ?? stored };
}

export function documentFormat(d: Pick<DocumentItem, "filePath" | "fileUrl" | "content">): DocumentFormat {
  if (d.filePath) {
    const ext = storedFile(d.filePath).stored.toLowerCase().split(".").pop();
    if (ext === "pdf") return "pdf";
    if (ext === "md") return "markdown";
    if (ext === "txt") return "text";
    return "word";
  }
  if (d.content) return "written";
  if (d.fileUrl) return "link";
  return "empty";
}

/**
 * Google Drive and Docs links can be embedded through their /preview page;
 * most other sites refuse to load inside a frame.
 */
export function embeddableUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "drive.google.com") {
      const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
      return id ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    if (u.hostname === "docs.google.com") {
      const m = u.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([^/]+)/);
      return m ? `https://docs.google.com/${m[1]}/d/${m[2]}/preview` : null;
    }
    if (u.pathname.toLowerCase().endsWith(".pdf")) return url;
  } catch {
    /* not a URL */
  }
  return null;
}
