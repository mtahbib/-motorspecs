"use server";

import { z } from "zod";
import { checkbox, formObject, staffAction, type ActionResult } from "@/lib/admin/action-helpers";

export async function addStaffMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    if (!viewer.isAdmin) throw new Error("Only the owner/admin can manage staff");
    const d = z.object({ email: z.email(), role: z.enum(["admin", "sales"]) }).parse(formObject(formData, ["email", "role"]));
    await tx.query("select public.set_staff_role($1, $2)", [d.email, d.role]);
    return `${d.email} is now ${d.role === "admin" ? "an admin" : "a salesperson"}`;
  }, ["/admin/staff"]);
}

export async function updateStaffMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    if (!viewer.isAdmin) throw new Error("Only the owner/admin can manage staff");
    const d = z
      .object({ id: z.uuid(), role: z.enum(["admin", "sales"]), is_active: checkbox, mfa_required: checkbox })
      .parse(formObject(formData, ["id", "role", "is_active", "mfa_required"]));
    if (d.id === viewer.user.id && (!d.is_active || d.role !== "admin")) throw new Error("You cannot demote or deactivate your own account");
    const rows = await tx.query("update public.profiles set role = $2, is_active = $3, mfa_required = $4 where id = $1 and role in ('admin', 'sales') returning id", [
      d.id, d.role, d.is_active, d.mfa_required,
    ]);
    if (!rows.length) throw new Error("Staff member not found");
    return "Staff member updated";
  }, ["/admin/staff"]);
}
