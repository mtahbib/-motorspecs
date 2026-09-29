import { Download, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { uploadDocument } from "@/app/admin/actions/documents";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { EmptyRow, Label, PageHeader, Panel, Table, Td, Th } from "@/components/admin/kit";
import { Badge, DemoBadge } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { formatBytes, formatDate } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/admin/documents">) {
  await requireStaff();
  const sp = await searchParams;
  const shared = sp.shared === "yes" ? "yes" : sp.shared === "no" ? "no" : "all";
  const { docs, customers } = await withDb(async (tx) => ({
    docs: await tx.query<{
      id: string; kind: string; title: string; file_name: string; size_bytes: number; shared_with_customer: boolean; created_at: string; is_demo: boolean;
      customer_id: string; customer_name: string; sale_id: string | null; sale_no: string | null; uploaded_by_name: string | null;
    }>(
      `select d.id, d.kind, d.title, d.file_name, d.size_bytes, d.shared_with_customer, d.created_at, d.is_demo, d.sale_id,
              c.id as customer_id, c.full_name as customer_name, (select sale_no from public.sales where id = d.sale_id) as sale_no,
              (select display_name from public.profiles where id = d.uploaded_by) as uploaded_by_name
         from public.documents d join public.customers c on c.id = d.customer_id
        where d.deleted_at is null ${shared === "yes" ? "and d.shared_with_customer" : shared === "no" ? "and not d.shared_with_customer" : ""}
        order by d.created_at desc limit 300`,
    ),
    customers: await tx.query<{ id: string; full_name: string; customer_code: string }>(
      "select id, full_name, customer_code from public.customers where status <> 'merged' order by full_name limit 500",
    ),
  }));

  return (
    <div>
      <PageHeader
        title="Customer documents"
        description="Quotations, invoices, receipts and shipping papers are stored privately. A customer only sees a file after you share it."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="mb-3 flex gap-2 text-sm">
            {(["all", "yes", "no"] as const).map((k) => (
              <Link key={k} href={`/admin/documents?shared=${k}`} className={`rounded-full border px-3 py-1 font-semibold ${shared === k ? "border-ink bg-ink text-white" : "border-line-strong text-muted"}`}>
                {{ all: "All", yes: "Shared", no: "Staff only" }[k]}
              </Link>
            ))}
          </div>
          <Table>
            <thead><tr><Th>Document</Th><Th>Customer</Th><Th>Visibility</Th><Th>Uploaded</Th><Th /></tr></thead>
            <tbody>
              {docs.length === 0 && <EmptyRow colSpan={5}>No documents.</EmptyRow>}
              {docs.map((d) => (
                <tr key={d.id} className="hover:bg-page/50">
                  <Td>
                    <p className="font-medium">{d.title} {d.is_demo && <DemoBadge />}</p>
                    <p className="text-xs text-muted">{adminT.documentKinds[d.kind as keyof typeof adminT.documentKinds]} · {d.file_name} · {formatBytes(d.size_bytes)}</p>
                  </Td>
                  <Td>
                    <Link href={`/admin/customers/${d.customer_id}`} className="hover:text-brand">{d.customer_name}</Link>
                    {d.sale_no && <p className="text-xs"><Link href={`/admin/sales/${d.sale_id}`} className="num text-muted hover:underline">{d.sale_no}</Link></p>}
                  </Td>
                  <Td>{d.shared_with_customer ? <Badge tone="ok"><Eye className="size-3" /> Shared</Badge> : <Badge><EyeOff className="size-3" /> Staff only</Badge>}</Td>
                  <Td className="text-xs text-muted">{formatDate(d.created_at)}<br />{d.uploaded_by_name}</Td>
                  <Td><a href={`/api/files/documents/${d.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><Download className="size-4" /> Download</a></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-muted">Share, unshare or remove a document from the customer&apos;s page or the sale page.</p>
        </div>
        <Panel title="Upload for a customer" className="h-fit">
          <ActionForm action={uploadDocument} resetOnSuccess className="flex flex-col gap-3">
            <div>
              <Label htmlFor="d-customer">Customer</Label>
              <select id="d-customer" name="customerId" required className="input">
                <option value="">Choose…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="d-kind">Type</Label>
              <select id="d-kind" name="kind" defaultValue="quotation" className="input">
                {Object.entries(adminT.documentKinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><Label htmlFor="d-title">Title</Label><input id="d-title" name="title" required maxLength={200} className="input" /></div>
            <div><Label htmlFor="d-file">File (PDF/JPEG/PNG/WebP, max 10 MB)</Label><input id="d-file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className="input" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" className="size-4 accent-brand" /> Share with the customer now</label>
            <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
          </ActionForm>
        </Panel>
      </div>
    </div>
  );
}
