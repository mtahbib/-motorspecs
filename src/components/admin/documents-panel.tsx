import { Download, EyeOff, Eye, FileText, Trash2 } from "lucide-react";
import { removeDocument, setDocumentShared, uploadDocument } from "@/app/admin/actions/documents";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { Label, Panel } from "@/components/admin/kit";
import { Badge } from "@/components/ui";
import { formatBytes, formatDate } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export type AdminDocument = {
  id: string; kind: string; title: string; file_name: string; size_bytes: number; shared_with_customer: boolean;
  created_at: string; uploaded_by_name: string | null; sale_no?: string | null; deleted_at?: string | null;
};

/** Document list + upload form for a customer (optionally scoped to a sale). */
export function DocumentsPanel({
  customerId,
  saleId,
  documents,
  title = "Documents",
}: {
  customerId: string;
  saleId?: string;
  documents: AdminDocument[];
  title?: string;
}) {
  return (
    <Panel title={title} bodyClassName="p-0">
      {documents.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No documents yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <FileText className="size-5 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.title}</p>
                <p className="text-xs text-muted">
                  {adminT.documentKinds[d.kind as keyof typeof adminT.documentKinds] ?? d.kind} · {d.file_name} · {formatBytes(d.size_bytes)} · {formatDate(d.created_at)}
                  {d.uploaded_by_name && ` · ${d.uploaded_by_name}`}
                  {d.sale_no && ` · ${d.sale_no}`}
                </p>
              </div>
              {d.shared_with_customer ? <Badge tone="ok"><Eye className="size-3" /> Shared</Badge> : <Badge><EyeOff className="size-3" /> Staff only</Badge>}
              <a href={`/api/files/documents/${d.id}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-page hover:text-ink" aria-label="Download">
                <Download className="size-4" />
              </a>
              <ActionForm action={setDocumentShared}>
                <input type="hidden" name="documentId" value={d.id} />
                <input type="hidden" name="shared" value={d.shared_with_customer ? "false" : "true"} />
                <SubmitButton variant="ghost" size="sm" pendingLabel="…">{d.shared_with_customer ? "Unshare" : "Share"}</SubmitButton>
              </ActionForm>
              <ActionForm action={removeDocument} confirm="Remove this document? The customer will no longer see it.">
                <input type="hidden" name="documentId" value={d.id} />
                <button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remove">
                  <Trash2 className="size-4" />
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <details className="border-t border-line">
        <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-brand">Upload a document</summary>
        <ActionForm action={uploadDocument} resetOnSuccess className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          <input type="hidden" name="customerId" value={customerId} />
          {saleId && <input type="hidden" name="saleId" value={saleId} />}
          <div>
            <Label htmlFor={`doc-kind-${saleId ?? customerId}`}>Type</Label>
            <select id={`doc-kind-${saleId ?? customerId}`} name="kind" className="input" defaultValue="invoice">
              {Object.entries(adminT.documentKinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor={`doc-title-${saleId ?? customerId}`}>Title</Label>
            <input id={`doc-title-${saleId ?? customerId}`} name="title" required maxLength={200} className="input" placeholder="e.g. Commercial invoice" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`doc-file-${saleId ?? customerId}`}>File (PDF, JPEG, PNG or WebP · max 10 MB)</Label>
            <input id={`doc-file-${saleId ?? customerId}`} name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="shared" className="size-4 accent-brand" /> Share with the customer now (visible in their portal)
          </label>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </div>
        </ActionForm>
      </details>
    </Panel>
  );
}
