import { NextResponse } from "next/server";
import { withDb } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { placeholderPdf } from "@/lib/demo/placeholder-pdf";
import { getObject, signedUrl } from "@/lib/storage";

/**
 * Customer document download.
 *
 * 1. The documents row is read through RLS as the current user: staff with
 *    access to the customer, or the customer only if the file is shared.
 * 2. Supabase mode: a 60-second signed URL is created with the user's own
 *    session, so storage RLS is checked again before any bytes are served.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/files/documents/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const doc = await withDb(async (tx) => {
    const [row] = await tx.query<{
      storage_path: string;
      file_name: string;
      mime_type: string;
      title: string;
      kind: string;
      is_demo: boolean;
      customer_code: string | null;
      created_at: string;
    }>(
      `select d.storage_path, d.file_name, d.mime_type, d.title, d.kind, d.is_demo, d.created_at,
              (select c.customer_code from public.customers c where c.id = d.customer_id) as customer_code
         from public.documents d where d.id = $1 and d.deleted_at is null`,
      [id],
    );
    return row;
  }).catch(() => undefined);
  if (!doc) return new Response("Not found", { status: 404 });

  const disposition = `attachment; filename="${doc.file_name.replace(/[^\w.\-]/g, "_")}"`;
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": disposition };

  if (!isDemoMode) {
    const url = await signedUrl("customer-documents", doc.storage_path, 60);
    if (url) return NextResponse.redirect(url);
    if (!doc.is_demo) return new Response("Not found", { status: 404 });
  } else {
    const object = await getObject("customer-documents", doc.storage_path);
    if (object) return new Response(Buffer.from(object.bytes), { headers: { ...headers, "Content-Type": doc.mime_type } });
    if (!doc.is_demo) return new Response("Not found", { status: 404 });
  }

  // Seeded demo documents have no stored file: generate a clearly-labelled placeholder.
  const pdf = placeholderPdf(doc.title, [
    `Document type: ${doc.kind.replace(/_/g, " ")}`,
    `Customer: ${doc.customer_code ?? "-"}`,
    `Issued: ${doc.created_at.slice(0, 10)}`,
    "",
    "This is sample data generated for the MotorSpecs prototype.",
    "It is not an invoice, receipt or certificate and has no legal value.",
    "No bank or payment details are included on purpose.",
  ]);
  return new Response(Buffer.from(pdf), { headers: { ...headers, "Content-Type": "application/pdf" } });
}
