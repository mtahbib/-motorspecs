"use server";

import { z } from "zod";
import { formObject, optionalUuid, requiredText, staffAction, text, type ActionResult } from "@/lib/admin/action-helpers";

const taskSchema = z.object({
  title: requiredText(200),
  notes: text(2000),
  customerId: optionalUuid,
  inquiryId: optionalUuid,
  assignedTo: optionalUuid,
  dueAt: z.string().min(1, "is required"),
  priority: z.enum(["low", "normal", "high"]),
});

export async function createTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    const d = taskSchema.parse(formObject(formData, ["title", "notes", "customerId", "inquiryId", "assignedTo", "dueAt", "priority"]));
    const due = new Date(d.dueAt.length === 10 ? `${d.dueAt}T09:00:00+09:00` : `${d.dueAt}:00+09:00`);
    if (Number.isNaN(due.getTime())) throw new Error("Invalid due date");
    await tx.query(
      `insert into public.tasks (title, notes, customer_id, inquiry_id, assigned_to, due_at, priority)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [d.title, d.notes, d.customerId, d.inquiryId, viewer.isAdmin && d.assignedTo ? d.assignedTo : viewer.user.id, due.toISOString(), d.priority],
    );
    return "Follow-up scheduled";
  }, ["/admin", "/admin/tasks", "/admin/inquiries", "/admin/customers"]);
}

export async function completeTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const id = z.uuid().parse(formData.get("taskId"));
    const done = await tx.query("update public.tasks set status = 'done' where id = $1 and status = 'open' returning id", [id]);
    if (!done.length) throw new Error("Only the assignee (or an admin) can complete this task");
    return "Marked as done";
  }, ["/admin", "/admin/tasks", "/admin/inquiries", "/admin/customers"]);
}

export async function cancelTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const id = z.uuid().parse(formData.get("taskId"));
    await tx.query("update public.tasks set status = 'cancelled' where id = $1 and status = 'open'", [id]);
    return "Cancelled";
  }, ["/admin", "/admin/tasks"]);
}
