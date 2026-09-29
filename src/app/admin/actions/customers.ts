"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  describeError, formObject, optionalEnum, optionalUuid, requiredText, staffAction, text, type ActionResult,
} from "@/lib/admin/action-helpers";
import { requireStaff, withDb } from "@/lib/auth/session";

const profileFields = {
  full_name: requiredText(160),
  company_name: text(160),
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.union([z.literal(""), z.email().max(254)])).transform((v) => v || null),
  phone: text(40),
  whatsapp: text(40),
  country_code: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[A-Z]{2}$/).nullable()),
  city: text(120),
  address_line: text(300),
  postal_code: text(20),
  destination_port: text(120),
  preferred_language: z.enum(["en", "ja", "ar"]),
  preferred_contact: z.enum(["email", "phone", "whatsapp"]),
};

const createSchema = z.object({
  ...profileFields,
  status: z.enum(["lead", "active"]),
  source: z.enum(["staff", "import", "referral"]),
  assigned_staff_id: optionalUuid,
  note: text(5000),
});

export async function createCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireStaff();
  let id: string;
  try {
    const d = createSchema.parse(formObject(formData, [...Object.keys(createSchema.shape)]));
    id = await withDb(async (tx) => {
      // Warn about possible duplicates, but never merge or link automatically.
      const [row] = await tx.query<{ id: string }>(
        `insert into public.customers (full_name, company_name, email, phone, whatsapp, country_code, city, address_line, postal_code,
                                       destination_port, preferred_language, preferred_contact, status, source, assigned_staff_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) returning id`,
        [d.full_name, d.company_name, d.email, d.phone, d.whatsapp, d.country_code, d.city, d.address_line, d.postal_code,
          d.destination_port, d.preferred_language, d.preferred_contact, d.status, d.source,
          viewer.isAdmin ? d.assigned_staff_id : viewer.user.id],
      );
      if (d.note) {
        await tx.query("insert into public.internal_notes (customer_id, body) values ($1, $2)", [row.id, d.note]);
      }
      return row.id;
    });
  } catch (err) {
    return { error: describeError(err) };
  }
  redirect(`/admin/customers/${id}?created=1`);
}

const updateSchema = z.object({
  id: z.uuid(),
  ...profileFields,
  status: z.enum(["lead", "active", "inactive"]),
  verification_status: z.enum(["unverified", "pending", "verified", "rejected"]),
  verified_name: text(160),
  verified_company: text(160),
  tags: text(300),
});

export async function updateCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = updateSchema.parse(formObject(formData, [...Object.keys(updateSchema.shape)]));
    const tags = (d.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
    const rows = await tx.query(
      `update public.customers set full_name = $2, company_name = $3, email = $4, phone = $5, whatsapp = $6, country_code = $7,
              city = $8, address_line = $9, postal_code = $10, destination_port = $11, preferred_language = $12, preferred_contact = $13,
              status = $14, verification_status = $15, verified_name = $16, verified_company = $17, tags = $18::text[]
        where id = $1 returning id`,
      [d.id, d.full_name, d.company_name, d.email, d.phone, d.whatsapp, d.country_code, d.city, d.address_line, d.postal_code,
        d.destination_port, d.preferred_language, d.preferred_contact, d.status, d.verification_status, d.verified_name,
        d.verified_company, `{${tags.map((t) => `"${t.replace(/["\\]/g, "")}"`).join(",")}}`],
    );
    if (!rows.length) throw new Error("Customer not found or not assigned to you");
    return "Customer saved";
  }, ["/admin/customers"]);
}

export async function reassignCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z
      .object({ customerId: z.uuid(), staffId: optionalUuid, reason: text(500) })
      .parse(formObject(formData, ["customerId", "staffId", "reason"]));
    await tx.query("select public.reassign_customer($1, $2, $3)", [d.customerId, d.staffId, d.reason]);
    return d.staffId ? "Customer reassigned — full history stays with the customer" : "Customer unassigned";
  }, ["/admin/customers", "/admin", "/admin/inquiries"]);
}

export async function addCustomerNote(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z
      .object({ customerId: z.uuid(), inquiryId: optionalUuid, body: requiredText(5000) })
      .parse(formObject(formData, ["customerId", "inquiryId", "body"]));
    if (d.inquiryId) {
      await tx.query("insert into public.internal_notes (customer_id, inquiry_id, body) values ($1, $2, $3)", [d.customerId, d.inquiryId, d.body]);
    } else {
      await tx.query("insert into public.internal_notes (customer_id, body) values ($1, $2)", [d.customerId, d.body]);
    }
    return "Note added (visible to staff only)";
  }, ["/admin/customers", "/admin/inquiries"]);
}

export async function createInviteCode(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const customerId = z.uuid().parse(formData.get("customerId"));
    const [row] = await tx.query<{ code: string }>("select public.create_customer_invite($1) as code", [customerId]);
    return { message: "Link code created. Share it with the customer privately — it is shown only once.", data: { code: row.code } };
  }, ["/admin/customers"]);
}

export async function createInquiryForCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await requireStaff();
  let id: string;
  try {
    const d = z
      .object({ customerId: z.uuid(), vehicleId: optionalUuid, subject: requiredText(200), message: text(5000), kind: optionalEnum(["inquiry", "offer"]) })
      .parse(formObject(formData, ["customerId", "vehicleId", "subject", "message", "kind"]));
    id = await withDb(async (tx) => {
      const [row] = await tx.query<{ id: string }>(
        `insert into public.inquiries (customer_id, vehicle_id, kind, subject, status) values ($1, $2, $3, $4, 'open') returning id`,
        [d.customerId, d.vehicleId, d.kind ?? "inquiry", d.subject],
      );
      if (d.message) {
        await tx.query("insert into public.messages (inquiry_id, customer_id, sender_role, body) values ($1, $2, $3, $4)", [row.id, d.customerId, viewer.role, d.message]);
      }
      return row.id;
    });
  } catch (err) {
    return { error: describeError(err) };
  }
  redirect(`/admin/inquiries/${id}`);
}

