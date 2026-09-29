import { NotesList } from "@/components/notes/notes-list";
import { listNotes } from "@/lib/queries/records";

export const metadata = { title: "Notes" };

/** List on the left, the open note on the right; both scroll on their own. */
export default function NotesLayout({ children }: LayoutProps<"/notes">) {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-6 md:h-[calc(100svh-3rem)] md:grid-cols-[18rem_minmax(0,1fr)] md:px-8 md:py-6">
      <NotesList notes={listNotes()} now={new Date().getTime()} />
      {children}
    </div>
  );
}
