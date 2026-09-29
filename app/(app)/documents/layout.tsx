import { DocumentsList } from "@/components/documents/documents-list";
import { listDocuments } from "@/lib/queries/records";

export const metadata = { title: "Documents" };

/** List on the left, the open CV or cover letter on the right. */
export default function DocumentsLayout({ children }: LayoutProps<"/documents">) {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-6 md:h-[calc(100svh-3rem)] md:grid-cols-[18rem_minmax(0,1fr)] md:px-8 md:py-6">
      <DocumentsList docs={listDocuments()} />
      {children}
    </div>
  );
}
