import { describe, expect, it } from "vitest";
import { documentFormat, embeddableUrl, storedFile } from "@/lib/documents";

const doc = (d: { filePath?: string; fileUrl?: string; content?: string }) => ({ filePath: null, fileUrl: null, content: null, ...d });

describe("documents", () => {
  it("picks the format from whichever source is set", () => {
    expect(documentFormat(doc({ filePath: "a1.pdf|CV.pdf" }))).toBe("pdf");
    expect(documentFormat(doc({ filePath: "a1.docx|CV.docx" }))).toBe("word");
    expect(documentFormat(doc({ filePath: "a1.md|cv.md" }))).toBe("markdown");
    expect(documentFormat(doc({ content: "Dear team" }))).toBe("written");
    expect(documentFormat(doc({ fileUrl: "https://example.com" }))).toBe("link");
    expect(documentFormat(doc({}))).toBe("empty");
  });

  it("keeps the original upload name", () => {
    expect(storedFile("a1.pdf|My CV.pdf")).toEqual({ stored: "a1.pdf", original: "My CV.pdf" });
    expect(storedFile("a1.pdf")).toEqual({ stored: "a1.pdf", original: "a1.pdf" });
  });

  it("turns Google Drive and Docs links into embeddable previews", () => {
    expect(embeddableUrl("https://drive.google.com/file/d/abc123/view?usp=sharing")).toBe("https://drive.google.com/file/d/abc123/preview");
    expect(embeddableUrl("https://drive.google.com/open?id=abc123")).toBe("https://drive.google.com/file/d/abc123/preview");
    expect(embeddableUrl("https://docs.google.com/document/d/xyz/edit")).toBe("https://docs.google.com/document/d/xyz/preview");
    expect(embeddableUrl("https://example.com/cv.pdf")).toBe("https://example.com/cv.pdf");
    expect(embeddableUrl("https://linkedin.com/in/me")).toBeNull();
  });
});
