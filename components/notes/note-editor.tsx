"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bold,
  Check,
  Code,
  Columns2,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Quote,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Markdown } from "@/components/shared/markdown";
import { saveNote, setNotePinned } from "@/lib/actions/notes";
import { deleteWithUndo, mutate } from "@/lib/client/mutate";
import { cn } from "@/lib/utils";
import type { Note } from "@/db/schema";

type Mode = "write" | "preview" | "split";
type SaveState = "idle" | "saving" | "saved" | "error";

/* ─────────────────────── markdown editing helpers ─────────────────────── */

/**
 * Replace the selection through the browser's editing pipeline so Ctrl+Z
 * still works; falls back to a plain value swap where execCommand is gone.
 */
function insert(el: HTMLTextAreaElement, text: string, select?: [number, number]) {
  el.focus();
  const start = el.selectionStart;
  if (!document.execCommand("insertText", false, text)) {
    el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (select) el.setSelectionRange(start + select[0], start + select[1]);
}

/** Wrap the selection, or insert a placeholder wrapped and selected. */
function wrap(el: HTMLTextAreaElement, before: string, after: string, placeholder: string) {
  const selected = el.value.slice(el.selectionStart, el.selectionEnd);
  const inner = selected || placeholder;
  insert(el, before + inner + after, [before.length, before.length + inner.length]);
}

/** Expand the selection to whole lines. */
function selectLines(el: HTMLTextAreaElement) {
  const start = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
  let end = el.value.indexOf("\n", el.selectionEnd);
  if (end === -1 || (el.selectionEnd > el.selectionStart && el.value[el.selectionEnd - 1] === "\n")) end = end === -1 ? el.value.length : el.selectionEnd - 1;
  el.setSelectionRange(start, end);
  return el.value.slice(start, end).split("\n");
}

const LINE_MARKER = /^(\s*)(?:#{1,6}\s|[-*+]\s\[[ xX]\]\s|[-*+]\s|\d+[.)]\s|>\s?)?/;

/** Toggle a line prefix (bullet, heading…) on every selected line. */
function prefixLines(el: HTMLTextAreaElement, prefix: (i: number) => string) {
  const lines = selectLines(el);
  const has = lines.every((l, i) => !l.trim() || l.trimStart().startsWith(prefix(i)));
  const next = lines.map((l, i) => {
    if (!l.trim() && lines.length > 1) return l;
    const [marker, indent] = l.match(LINE_MARKER)!;
    const rest = l.slice(marker.length);
    return has ? indent + rest : indent + prefix(i) + rest;
  });
  const text = next.join("\n");
  insert(el, text, lines.length === 1 ? [text.length, text.length] : [0, text.length]);
}

/** Indent or outdent the selected lines by two spaces. */
function indentLines(el: HTMLTextAreaElement, out: boolean) {
  const lines = selectLines(el);
  const text = lines.map((l) => (out ? l.replace(/^ {1,2}/, "") : `  ${l}`)).join("\n");
  insert(el, text, lines.length === 1 ? [text.length, text.length] : [0, text.length]);
}

const LIST_ITEM = /^(\s*)([-*+]|(\d+)([.)]))\s(\[[ xX]\]\s)?/;

/** Enter inside a list: continue it, or end it when the item is empty. */
function continueList(el: HTMLTextAreaElement): boolean {
  if (el.selectionStart !== el.selectionEnd) return false;
  const pos = el.selectionStart;
  const lineStart = el.value.lastIndexOf("\n", pos - 1) + 1;
  const line = el.value.slice(lineStart, pos);
  const m = line.match(LIST_ITEM);
  if (!m) return false;
  if (line.length === m[0].length) {
    // Empty item: drop the marker instead of adding another.
    el.setSelectionRange(lineStart, pos);
    insert(el, "");
    return true;
  }
  const [, indent, bullet, num, sep, task] = m;
  const marker = num ? `${Number(num) + 1}${sep}` : bullet;
  insert(el, `\n${indent}${marker} ${task ? "[ ] " : ""}`);
  return true;
}

/** Flip the `[ ]`/`[x]` of the task item starting at `offset`. */
function toggleTask(body: string, offset: number) {
  const m = /\[([ xX])\]/.exec(body.slice(offset));
  if (!m) return body;
  const at = offset + m.index + 1;
  return body.slice(0, at) + (m[1] === " " ? "x" : " ") + body.slice(at + 1);
}

/* ─────────────────────────────── editor ─────────────────────────────── */

type Tool = { label: string; icon: LucideIcon; keys?: string; run: (el: HTMLTextAreaElement) => void };

const TOOLS: (Tool | "sep")[] = [
  { label: "Heading", icon: Heading2, run: (el) => prefixLines(el, () => "## ") },
  { label: "Bold", icon: Bold, keys: "Ctrl+B", run: (el) => wrap(el, "**", "**", "bold") },
  { label: "Italic", icon: Italic, keys: "Ctrl+I", run: (el) => wrap(el, "_", "_", "italic") },
  { label: "Inline code", icon: Code, run: (el) => wrap(el, "`", "`", "code") },
  { label: "Link", icon: Link2, run: (el) => wrap(el, "[", "](https://)", "text") },
  "sep",
  { label: "Bullet list", icon: List, run: (el) => prefixLines(el, () => "- ") },
  { label: "Numbered list", icon: ListOrdered, run: (el) => prefixLines(el, (i) => `${i + 1}. `) },
  { label: "Checklist", icon: ListChecks, run: (el) => prefixLines(el, () => "- [ ] ") },
  { label: "Quote", icon: Quote, run: (el) => prefixLines(el, () => "> ") },
];

export function NoteEditor({ note }: { note: Note }) {
  const router = useRouter();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [pinned, setPinned] = useState(note.pinned);
  const [mode, setMode] = useState<Mode>(note.body ? "preview" : "write");
  const [state, setState] = useState<SaveState>("idle");
  const textarea = useRef<HTMLTextAreaElement>(null);

  // Autosave 800ms after the last edit, and flush on the way out.
  const latest = useRef({ title, body });
  const saved = useRef({ title: note.title, body: note.body });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const values = latest.current;
    if (values.title === saved.current.title && values.body === saved.current.body) return;
    setState("saving");
    const r = await saveNote(note.id, values);
    if (r.ok) {
      saved.current = values;
      setState(latest.current === values ? "saved" : "idle");
    } else setState("error");
  };

  const edit = (next: { title?: string; body?: string }) => {
    latest.current = { ...latest.current, ...next };
    if (next.title !== undefined) setTitle(next.title);
    if (next.body !== undefined) setBody(next.body);
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  };

  const onLeave = useEffectEvent(() => void flush());
  useEffect(() => {
    const handler = () => onLeave();
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("pagehide", handler);
      handler();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.nativeEvent.isComposing) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && !e.altKey && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      e.stopPropagation(); // Ctrl+B also toggles the sidebar (window listener)
      if (e.key === "b") wrap(el, "**", "**", "bold");
      else wrap(el, "_", "_", "italic");
    } else if (mod && e.key === "s") {
      e.preventDefault();
      void flush();
    } else if (e.key === "Enter" && !mod && !e.shiftKey && !e.altKey) {
      if (continueList(el)) e.preventDefault();
    } else if (e.key === "Tab" && !mod && !e.altKey) {
      // Only inside lists, so Tab still moves focus elsewhere.
      const lineStart = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
      if (LIST_ITEM.test(el.value.slice(lineStart))) {
        e.preventDefault();
        indentLines(el, e.shiftKey);
      }
    }
  };

  const runTool = (tool: Tool) => {
    if (mode === "preview") setMode("write");
    // The textarea mounts after a switch from preview; wait a frame.
    requestAnimationFrame(() => textarea.current && tool.run(textarea.current));
  };

  const togglePin = async () => {
    const next = !pinned;
    setPinned(next);
    if (!(await mutate(setNotePinned(note.id, next), { success: next ? "Pinned" : "Unpinned" }))) setPinned(!next);
  };

  const remove = async () => {
    if (timer.current) clearTimeout(timer.current);
    saved.current = latest.current; // nothing left to autosave
    // Leave first so the page doesn't re-render a note that no longer exists.
    router.push("/notes");
    await deleteWithUndo("notes", [note.id], title.trim() ? `“${title.trim()}”` : "note");
  };

  const editor = (
    <textarea
      ref={textarea}
      value={body}
      onChange={(e) => edit({ body: e.target.value })}
      onKeyDown={onKeyDown}
      onBlur={() => void flush()}
      autoFocus={!note.body && !!note.title}
      placeholder={"Start writing…\n\nMarkdown works: # heading, - bullet, 1. numbered, - [ ] checklist, **bold**, `code`"}
      aria-label="Note body"
      spellCheck
      className="min-h-[50svh] w-full flex-1 resize-none bg-transparent px-5 py-4 font-mono text-[0.8125rem] leading-relaxed outline-none placeholder:text-muted-foreground/70 md:min-h-0"
    />
  );

  const preview = (
    <div className="min-h-[50svh] flex-1 overflow-y-auto px-5 py-4 md:min-h-0" onDoubleClick={() => mode === "preview" && setMode("write")}>
      {body.trim() ? (
        <Markdown className="text-[0.875rem]" onToggleTask={(offset) => edit({ body: toggleTask(body, offset) })}>
          {body}
        </Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing here yet. Switch to Write to start.</p>
      )}
    </div>
  );

  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="icon-sm" asChild className="md:hidden">
          <Link href="/notes" aria-label="All notes">
            <ArrowLeft />
          </Link>
        </Button>
        <input
          value={title}
          onChange={(e) => edit({ title: e.target.value })}
          onBlur={() => void flush()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (mode === "preview") setMode("write");
              requestAnimationFrame(() => textarea.current?.focus());
            }
          }}
          autoFocus={!note.title && !note.body}
          maxLength={200}
          placeholder="Untitled"
          aria-label="Note title"
          className="min-w-0 flex-1 bg-transparent px-2 text-base font-semibold tracking-[-0.01em] outline-none placeholder:text-muted-foreground/60"
        />
        <SaveStatus state={state} />
        <Button variant="ghost" size="icon-sm" onClick={togglePin} aria-label={pinned ? "Unpin note" : "Pin note"} aria-pressed={pinned}>
          <Pin className={cn(pinned && "fill-current text-brand")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Note actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={togglePin}>
              {pinned ? <PinOff /> : <Pin />}
              {pinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={remove}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatting">
          {TOOLS.map((tool, i) =>
            tool === "sep" ? (
              <span key={i} className="mx-1 h-4 w-px bg-border" aria-hidden />
            ) : (
              <Tooltip key={tool.label}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tool.label}
                    onMouseDown={(e) => e.preventDefault() /* keep the textarea's selection */}
                    onClick={() => runTool(tool)}
                  >
                    <tool.icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {tool.label}
                  {tool.keys && <span className="ml-1.5 opacity-60">{tool.keys}</span>}
                </TooltipContent>
              </Tooltip>
            ),
          )}
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={mode}
          onValueChange={(v) => v && setMode(v as Mode)}
          className="ml-auto"
          aria-label="View"
        >
          <ToggleGroupItem value="write" aria-label="Write">
            <Pencil />
            <span className="hidden sm:inline">Write</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="split" aria-label="Side by side" className="hidden lg:inline-flex">
            <Columns2 />
            <span className="hidden sm:inline">Split</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" aria-label="Preview">
            <Eye />
            <span className="hidden sm:inline">Preview</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className={cn("flex min-h-0 flex-1", mode === "split" && "lg:divide-x")}>
        {mode !== "preview" && editor}
        {mode === "preview" && preview}
        {mode === "split" && <div className="hidden min-h-0 flex-1 lg:flex">{preview}</div>}
      </div>
    </section>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
      {state === "saving" && (
        <>
          <LoaderCircle className="size-3 animate-spin" /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="size-3" /> Saved
        </>
      )}
      {state === "error" && <span className="text-destructive">Couldn&apos;t save</span>}
    </span>
  );
}
