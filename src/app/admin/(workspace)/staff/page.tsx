import { ShieldCheck } from "lucide-react";
import { addStaffMember, updateStaffMember } from "@/app/admin/actions/staff";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldHint, Label, PageHeader, Panel, Table, Td, Th } from "@/components/admin/kit";
import { Badge, DemoBadge } from "@/components/ui";
import { requireAdmin, withDb } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { adminT } from "@/lib/i18n/admin/en";

export const metadata = { title: "Staff & roles" };

const matrix: [string, string, string][] = [
  ["See all customers & the master database", "Yes", "Only customers assigned to them"],
  ["Create customers", "Yes (assign to anyone)", "Yes (assigned to themselves)"],
  ["Assign / reassign customers", "Yes", "No"],
  ["Reply, notes, quotations, follow-ups", "All customers", "Their customers"],
  ["Reserve vehicles, create sales", "Yes", "For their customers"],
  ["Record payments", "Yes", "Yes (marked “to verify”)"],
  ["Verify or void payments", "Yes", "No"],
  ["Vehicle listings (create, edit, publish)", "Yes", "Yes"],
  ["Private purchase cost & margin", "Yes", "No"],
  ["Upload & share customer documents", "Yes", "For their customers"],
  ["Staff, roles & reports", "Yes", "No"],
  ["Activity log", "Everything", "Their own actions and their customers"],
];

export default async function StaffPage() {
  const viewer = await requireAdmin();
  const t = adminT;
  const staff = await withDb((tx) =>
    tx.query<{ id: string; display_name: string | null; email: string | null; role: "admin" | "sales"; is_active: boolean; is_owner: boolean; mfa_required: boolean; is_demo: boolean; created_at: string; customers: number }>(
      `select p.id, p.display_name, p.email, p.role, p.is_active, p.is_owner, p.mfa_required, p.is_demo, p.created_at,
              (select count(*)::int from public.customers c where c.assigned_staff_id = p.id and c.status in ('lead', 'active')) as customers
         from public.profiles p where p.role in ('admin', 'sales') order by p.is_owner desc, p.role, p.display_name`,
    ),
  );

  return (
    <div>
      <PageHeader title="Staff & roles" description="Who can sign in to the staff workspace and what they can do. Permissions are enforced by the database, not just hidden in the interface." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <Table>
            <thead><tr><Th>Person</Th><Th>Role</Th><Th>Customers</Th><Th>Access</Th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="align-top">
                  <Td>
                    <p className="font-semibold">{s.display_name} {s.is_owner && <Badge tone="brand">Owner</Badge>} {s.is_demo && <DemoBadge />}</p>
                    <p className="text-xs text-muted">{s.email} · since {formatDate(s.created_at)}</p>
                  </Td>
                  <Td>{t.roles[s.role]}</Td>
                  <Td className="num">{s.customers}</Td>
                  <Td>
                    {s.is_owner ? (
                      <p className="text-xs text-muted">The owner account cannot be demoted or deactivated here.{s.mfa_required && " MFA required."}</p>
                    ) : (
                      <ActionForm action={updateStaffMember} className="flex flex-wrap items-center gap-3">
                        <input type="hidden" name="id" value={s.id} />
                        <select name="role" defaultValue={s.role} className="input h-8 w-auto py-1 text-sm" aria-label="Role">
                          <option value="sales">Salesperson</option>
                          <option value="admin">Admin</option>
                        </select>
                        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="is_active" defaultChecked={s.is_active} className="accent-brand" /> Active</label>
                        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="mfa_required" defaultChecked={s.mfa_required} className="accent-brand" /> Require MFA</label>
                        <SubmitButton size="sm" variant="secondary" pendingLabel="…">Save</SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Panel title="Permission matrix">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-start text-xs text-muted uppercase"><th className="py-2 text-start">Action</th><th className="py-2 text-start">Owner / admin</th><th className="py-2 text-start">Salesperson</th></tr>
                </thead>
                <tbody>
                  {matrix.map(([what, admin, sales]) => (
                    <tr key={what} className="border-t border-line"><td className="py-2 pe-3 font-medium">{what}</td><td className="py-2 pe-3">{admin}</td><td className="py-2">{sales}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">Customers only ever see their own record, conversations, offers, reservations, purchases, payments (read-only) and documents explicitly shared with them.</p>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel title="Add a staff member">
            <ol className="mb-4 list-decimal ps-5 text-sm text-muted">
              <li>Ask them to register on the website (email or Google).</li>
              <li>Enter the same email here and choose a role.</li>
            </ol>
            <ActionForm action={addStaffMember} resetOnSuccess className="flex flex-col gap-3">
              <div><Label htmlFor="s-email">Their login email</Label><input id="s-email" name="email" type="email" required className="input" /></div>
              <div>
                <Label htmlFor="s-role">Role</Label>
                <select id="s-role" name="role" defaultValue="sales" className="input"><option value="sales">Salesperson</option><option value="admin">Admin</option></select>
              </div>
              <SubmitButton pendingLabel="Adding…">Give staff access</SubmitButton>
              <FieldHint>This keeps the Supabase service-role key out of the app entirely: no one is created from the server, access is granted to an existing login.</FieldHint>
            </ActionForm>
          </Panel>
          <Panel title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-brand" /> Two-step verification</span>}>
            <p className="text-sm text-muted">
              Tick <strong>Require MFA</strong> for any staff member. Their staff permissions switch off in the database until they sign in with an authenticator-app code. Each person sets up their app under <em>Sign-in security</em>.
            </p>
            {viewer.isDemo && <p className="mt-2 text-xs text-warn">Demo accounts can simulate verification.</p>}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
