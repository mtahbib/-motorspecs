"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { formObject, optionalUuid, requiredText, staffAction, checkbox, type ActionResult } from "@/lib/admin/action-helpers";
import { uploadLimits } from "@/lib/config";
import { putObject, safeFileName, sniffMime } from "@/lib/storage";

const DOC_KINDS = [
  "quotation", "proforma_invoice", "invoice", "receipt", "export_certificate", "deregistration", "bill_of_lading", "inspection", "shipping", "other",
] as const;

const uploadSchema = z.object({
  customerId: z.uuid(),
  saleId: optionalUuid,
  inquiryId: optionalUuid,
  kind: z.enum(DOC_KINDS),
  title: requiredText(200),
  shared: checkbox,
});

/**
 * Upload a customer-specific document to the private bucket.
 * The documents row is inserted first inside the RLS transaction (so only
 * staff with access to this customer get this far); the file is then stored,
 * and any storage failure rolls the row back.
 */
export async function uploadDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    const d = uploadSchema.parse(formObject(formData, ["customerId", "saleId", "inquiryId", "kind", "title", "shared"]));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload");
    if (file.size > uploadLimits.maxBytes) throw new Error("Files must be 10 MB or smaller");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(bytes);
    if (!mime || !(uploadLimits.documentMimeTypes as readonly string[]).includes(mime)) {
      throw new Error("Only PDF, JPEG, PNG or WebP files are allowed");
    }
    const id = randomUUID();
    const fileName = safeFileName(file.name);
    const path = `${d.customerId}/${id}/${fileName}`;
    await tx.query(
      `insert into public.documents (id, customer_id, sale_id, inquiry_id, kind, title, storage_path, file_name, mime_type, size_bytes, shared_with_customer, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, d.customerId, d.saleId, d.inquiryId, d.kind, d.title, path, fileName, mime, bytes.length, d.shared, viewer.user.id],
    );
    await putObject("customer-documents", path, bytes, mime);
    return d.shared ? "Uploaded and shared with the customer" : "Uploaded (staff only until you share it)";
  }, ["/admin/customers", "/admin/documents", "/admin/sales"]);
}

export async function setDocumentShared(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z.object({ documentId: z.uuid(), shared: z.enum(["true", "false"]) }).parse(formObject(formData, ["documentId", "shared"]));
    const rows = await tx.query("update public.documents set shared_with_customer = $2 where id = $1 and deleted_at is null returning id", [d.documentId, d.shared === "true"]);
    if (!rows.length) throw new Error("Document not found");
    return d.shared === "true" ? "Now visible to the customer" : "Hidden from the customer";
  }, ["/admin/customers", "/admin/documents", "/admin/sales"]);
}

export async function removeDocument(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const id = z.uuid().parse(formData.get("documentId"));
    // Soft delete keeps the audit trail; the file stays in private storage.
    const rows = await tx.query("update public.documents set deleted_at = now(), shared_with_customer = false where id = $1 and deleted_at is null returning id", [id]);
    if (!rows.length) throw new Error("Document not found");
    return "Document removed";
  }, ["/admin/customers", "/admin/documents", "/admin/sales"]);
}
