import { NotebookPen } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { NewNoteButton } from "@/components/notes/notes-list";

export default function NotesPage() {
  return (
    // Phones show just the list here.
    <div className="hidden items-center justify-center rounded-xl border bg-card md:flex">
      <EmptyState
        icon={NotebookPen}
        title="Pick a note or start a new one"
        description="Write in markdown: headings, bullet points, checklists, code, links."
        action={<NewNoteButton size="default" />}
      />
    </div>
  );
}
