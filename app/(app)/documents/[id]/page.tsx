import { notFound } from "next/navigation";
import { DocumentPreview } from "@/components/documents/document-preview";
import { listDocuments, readDocumentText } from "@/lib/queries/records";

function findDocument(id: string) {
  return listDocuments().find((d) => d.id === Number(id));
}

export async function generateMetadata({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  return { title: findDocument(id)?.name ?? "Document" };
}

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const doc = findDocument(id);
  if (!doc) notFound();
  return <DocumentPreview key={doc.id} doc={doc} text={await readDocumentText(doc)} />;
}
