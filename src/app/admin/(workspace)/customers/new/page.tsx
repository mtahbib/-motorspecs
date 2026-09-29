import { createCustomer } from "@/app/admin/actions/customers";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { CustomerFields } from "@/components/admin/customer-fields";
import { FieldHint, Label, PageHeader, Panel } from "@/components/admin/kit";
import { Alert } from "@/components/ui";
import { requireStaff, withDb } from "@/lib/auth/session";
import { listStaffOptions } from "@/lib/queries/admin";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const viewer = await requireStaff();
  const staff = await withDb(listStaffOptions);

  return (
    <div className="max-w-4xl">
      <PageHeader title="New customer" back={{ href: "/admin/customers", label: "Customers" }} description="Create a record for someone who has not registered on the website yet (phone lead, trade fair contact, repeat buyer)." />
      <Alert tone="info" className="mb-5">
        This record is <strong>not</strong> connected to any website login, even if the email matches. When the customer registers, give them a one-time link code from their record page so they can claim their history.
      </Alert>
      <ActionForm action={createCustomer} className="flex flex-col gap-6">
        <Panel title="Contact details">
          <CustomerFields />
        </Panel>
        <Panel title="Relationship">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue="lead" className="input">
                <option value="lead">Lead</option>
                <option value="active">Active customer</option>
              </select>
            </div>
            <div>
              <Label htmlFor="source">Source</Label>
              <select id="source" name="source" defaultValue="staff" className="input">
                <option value="staff">Staff (phone, visit, event)</option>
                <option value="referral">Referral</option>
                <option value="import">Imported list</option>
              </select>
            </div>
            <div>
              <Label htmlFor="assigned">Salesperson</Label>
              {viewer.isAdmin ? (
                <select id="assigned" name="assigned_staff_id" defaultValue={viewer.user.id} className="input">
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
              ) : (
                <>
                  <input id="assigned" readOnly value={viewer.displayName} className="input" />
                  <FieldHint>Customers you create are assigned to you.</FieldHint>
                </>
              )}
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="note" optional>First internal note</Label>
              <textarea id="note" name="note" rows={3} maxLength={5000} className="input" placeholder="Where you met, what they are looking for… (staff only)" />
            </div>
          </div>
        </Panel>
        <div>
          <SubmitButton size="lg" pendingLabel="Creating…">Create customer</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
