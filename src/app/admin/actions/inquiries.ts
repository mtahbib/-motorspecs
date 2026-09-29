"use server";

import { z } from "zod";
import { formObject, optionalNumber, requiredText, staffAction, text, type ActionResult } from "@/lib/admin/action-helpers";

const paths = (id?: string) => ["/admin", "/admin/inquiries", ...(id ? [`/admin/inquiries/${id}`] : []), "/admin/offers", "/admin/customers"];

export async function staffReply(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const d = z.object({ inquiryId: z.uuid(), body: requiredText(5000) }).safeParse(formObject(formData, ["inquiryId", "body"]));
  if (!d.success) return { error: "Write a message first" };
  return staffAction(async (tx, viewer) => {
    const [inq] = await tx.query<{ customer_id: string }>("select customer_id from public.inquiries where id = $1", [d.data.inquiryId]);
    if (!inq) throw new Error("Conversation not found");
    await tx.query("insert into public.messages (inquiry_id, customer_id, sender_role, body) values ($1, $2, $3, $4)", [
      d.data.inquiryId, inq.customer_id, viewer.role, d.data.body,
    ]);
    // Mark customer messages as read once staff reply.
    await tx.query("update public.messages set read_at = now() where inquiry_id = $1 and sender_role = 'customer' and read_at is null", [d.data.inquiryId]);
    return "Reply sent — the customer sees it in their portal";
  }, paths(d.data.inquiryId));
}

export async function setInquiryStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z
      .object({ inquiryId: z.uuid(), status: z.enum(["open", "quoted", "negotiating", "won", "lost", "closed"]), reason: text(500) })
      .parse(formObject(formData, ["inquiryId", "status", "reason"]));
    await tx.query("update public.inquiries set status = $2, closed_reason = $3 where id = $1", [d.inquiryId, d.status, d.reason]);
    return "Status updated";
  }, paths());
}

const quoteSchema = z.object({
  inquiryId: z.uuid(),
  kind: z.enum(["quotation", "counter_offer"]),
  amount: z.coerce.number().positive("must be greater than 0").max(9_999_999),
  incoterm: z.enum(["FOB", "CFR", "CIF"]),
  freight: optionalNumber(0, 1_000_000),
  insurance: optionalNumber(0, 1_000_000),
  inspection: optionalNumber(0, 1_000_000),
  destinationPort: text(120),
  validDays: z.coerce.number().int().min(1).max(60),
  message: text(2000),
});

export async function sendQuotation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = quoteSchema.parse(formObject(formData, Object.keys(quoteSchema.shape)));
    const [inq] = await tx.query<{ customer_id: string; vehicle_id: string | null }>("select customer_id, vehicle_id from public.inquiries where id = $1", [d.inquiryId]);
    if (!inq) throw new Error("Conversation not found");
    await tx.query(
      `insert into public.offers (inquiry_id, customer_id, vehicle_id, kind, amount_usd, incoterm, freight_usd, insurance_usd, inspection_usd,
                                  destination_port, valid_until, message)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, current_date + $11::int, $12)`,
      [d.inquiryId, inq.customer_id, inq.vehicle_id, d.kind, d.amount, d.incoterm, d.freight, d.insurance, d.inspection, d.destinationPort, d.validDays, d.message],
    );
    return d.kind === "quotation" ? "Quotation sent to the customer" : "Counter-offer sent";
  }, paths());
}

/** Staff decision on a customer's offer (accept → usually followed by a reservation). */
export async function decideCustomerOffer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    const d = z.object({ offerId: z.uuid(), decision: z.enum(["accepted", "declined", "withdrawn"]) }).parse(formObject(formData, ["offerId", "decision"]));
    const [offer] = await tx.query<{ inquiry_id: string; customer_id: string; amount_usd: number; kind: string }>(
      "update public.offers set status = $2 where id = $1 and status = 'pending' returning inquiry_id, customer_id, amount_usd, kind",
      [d.offerId, d.decision],
    );
    if (!offer) throw new Error("This offer is no longer pending");
    const verb = { accepted: "accepted", declined: "declined", withdrawn: "withdrew" }[d.decision];
    await tx.query("insert into public.messages (inquiry_id, customer_id, sender_role, body) values ($1, $2, $3, $4)", [
      offer.inquiry_id, offer.customer_id, viewer.role,
      d.decision === "withdrawn"
        ? `We have withdrawn our ${offer.kind.replace("_", " ")} of USD ${offer.amount_usd.toLocaleString("en-US")}.`
        : `We have ${verb} your offer of USD ${offer.amount_usd.toLocaleString("en-US")}.`,
    ]);
    return `Offer ${d.decision}`;
  }, paths());
}
