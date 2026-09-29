import { notFound } from "next/navigation";
import { NoteEditor } from "@/components/notes/note-editor";
import { getNote } from "@/lib/queries/records";

export async function generateMetadata({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  return { title: getNote(Number(id))?.title || "Note" };
}

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const note = Number.isInteger(Number(id)) ? getNote(Number(id)) : undefined;
  if (!note) notFound();
  return <NoteEditor key={note.id} note={note} />;
}
