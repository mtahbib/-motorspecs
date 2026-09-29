"use server";

import { z } from "zod";
import { formObject, optionalNumber, optionalUuid, requiredText, staffAction, text, type ActionResult } from "@/lib/admin/action-helpers";

const dealPaths = ["/admin", "/admin/reservations", "/admin/sales", "/admin/shipping", "/admin/inquiries", "/admin/customers", "/admin/vehicles"];

// -----------------------------------------------------------------------------
// Reservations
// -----------------------------------------------------------------------------
const reserveSchema = z.object({
  vehicleId: z.uuid(),
  customerId: z.uuid(),
  inquiryId: optionalUuid,
  offerId: optionalUuid,
  holdDays: z.coerce.number().int().min(1).max(30),
  agreedPrice: optionalNumber(1, 9_999_999),
  notes: text(2000),
});

export async function reserveVehicle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = reserveSchema.parse(formObject(formData, Object.keys(reserveSchema.shape)));
    // The database refuses a second active reservation or a sold vehicle.
    await tx.query(
      `insert into public.reservations (vehicle_id, customer_id, inquiry_id, offer_id, agreed_price_usd, reserved_until, notes)
       values ($1, $2, $3, $4, $5, now() + make_interval(days => $6::int), $7)`,
      [d.vehicleId, d.customerId, d.inquiryId, d.offerId, d.agreedPrice, d.holdDays, d.notes],
    );
    if (d.inquiryId) {
      const [inq] = await tx.query<{ customer_id: string }>("select customer_id from public.inquiries where id = $1", [d.inquiryId]);
      await tx.query(
        "insert into public.messages (inquiry_id, customer_id, sender_role, body) values ($1, $2, 'system', $3)",
        [d.inquiryId, inq.customer_id, `The vehicle is reserved for you for ${d.holdDays} day${d.holdDays === 1 ? "" : "s"}.`],
      );
    }
    return "Vehicle reserved — it now shows as Reserved on the website";
  }, dealPaths);
}

export async function releaseReservation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z.object({ reservationId: z.uuid(), reason: requiredText(500) }).parse(formObject(formData, ["reservationId", "reason"]));
    const rows = await tx.query(
      "update public.reservations set status = 'released', release_reason = $2 where id = $1 and status = 'active' returning id",
      [d.reservationId, d.reason],
    );
    if (!rows.length) throw new Error("Reservation is not active");
    return "Reservation released — the vehicle is available again";
  }, dealPaths);
}

export async function extendReservation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z.object({ reservationId: z.uuid(), days: z.coerce.number().int().min(1).max(30) }).parse(formObject(formData, ["reservationId", "days"]));
    const rows = await tx.query(
      "update public.reservations set reserved_until = greatest(reserved_until, now()) + make_interval(days => $2::int) where id = $1 and status = 'active' returning id",
      [d.reservationId, d.days],
    );
    if (!rows.length) throw new Error("Reservation is not active");
    return `Extended by ${d.days} day${d.days === 1 ? "" : "s"}`;
  }, dealPaths);
}

export async function expireOverdueReservations(): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const [row] = await tx.query<{ n: number }>("select public.expire_reservations() as n");
    return row.n ? `${row.n} overdue reservation${row.n === 1 ? "" : "s"} expired` : "No overdue reservations";
  }, dealPaths);
}

const convertSchema = z.object({
  reservationId: z.uuid(),
  price: z.coerce.number().positive().max(9_999_999),
  incoterm: z.enum(["FOB", "CFR", "CIF"]),
  freight: optionalNumber(0, 1_000_000),
  insurance: optionalNumber(0, 1_000_000),
  other: optionalNumber(0, 1_000_000),
  notes: text(2000),
});

export async function convertToSale(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = convertSchema.parse(formObject(formData, Object.keys(convertSchema.shape)));
    const [row] = await tx.query<{ id: string }>(
      "select public.convert_reservation_to_sale($1, $2, $3, $4, $5, $6, $7) as id",
      [d.reservationId, d.price, d.incoterm, d.freight ?? 0, d.insurance ?? 0, d.other ?? 0, d.notes],
    );
    return { message: "Sale created. Record payments and shipping on the sale page.", data: { saleId: row.id } };
  }, dealPaths);
}

// -----------------------------------------------------------------------------
// Sales & payments
// -----------------------------------------------------------------------------
export async function updateSale(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z
      .object({ saleId: z.uuid(), invoiceNo: text(60), notes: text(2000) })
      .parse(formObject(formData, ["saleId", "invoiceNo", "notes"]));
    await tx.query("update public.sales set invoice_no = $2, notes = $3 where id = $1", [d.saleId, d.invoiceNo, d.notes]);
    return "Sale updated";
  }, dealPaths);
}

export async function setSaleStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = z
      .object({ saleId: z.uuid(), status: z.enum(["delivered", "completed", "cancelled"]), reason: text(500) })
      .parse(formObject(formData, ["saleId", "status", "reason"]));
    if (d.status === "cancelled" && !d.reason) throw new Error("Give a reason for cancelling");
    await tx.query("update public.sales set status = $2, cancel_reason = coalesce($3, cancel_reason) where id = $1", [d.saleId, d.status, d.reason]);
    return d.status === "cancelled" ? "Sale cancelled — the vehicle is back on sale" : "Sale status updated";
  }, dealPaths);
}

const paymentSchema = z.object({
  saleId: z.uuid(),
  amount: z.coerce.number().positive("must be greater than 0").max(9_999_999),
  method: z.enum(["bank_transfer", "card", "cash", "other"]),
  reference: text(120),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date"),
  note: text(1000),
});

export async function recordPayment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx) => {
    const d = paymentSchema.parse(formObject(formData, Object.keys(paymentSchema.shape)));
    const [sale] = await tx.query<{ customer_id: string }>("select customer_id from public.sales where id = $1", [d.saleId]);
    if (!sale) throw new Error("Sale not found");
    await tx.query(
      `insert into public.payments (sale_id, customer_id, amount_usd, method, reference, paid_on, note) values ($1, $2, $3, $4, $5, $6, $7)`,
      [d.saleId, sale.customer_id, d.amount, d.method, d.reference, d.paidOn, d.note],
    );
    return "Payment recorded. An admin will verify it.";
  }, dealPaths);
}

export async function verifyPayment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    if (!viewer.isAdmin) throw new Error("Only the owner/admin can verify payments");
    const id = z.uuid().parse(formData.get("paymentId"));
    const rows = await tx.query("update public.payments set status = 'verified' where id = $1 and status = 'recorded' returning id", [id]);
    if (!rows.length) throw new Error("Payment is not awaiting verification");
    return "Payment verified";
  }, dealPaths);
}

export async function voidPayment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    if (!viewer.isAdmin) throw new Error("Only the owner/admin can void payments");
    const d = z.object({ paymentId: z.uuid(), reason: requiredText(500) }).parse(formObject(formData, ["paymentId", "reason"]));
    const rows = await tx.query("update public.payments set status = 'void', void_reason = $2 where id = $1 and status <> 'void' returning id", [d.paymentId, d.reason]);
    if (!rows.length) throw new Error("Payment already void");
    return "Payment voided (kept in the record)";
  }, dealPaths);
}

// -----------------------------------------------------------------------------
// Shipping
// -----------------------------------------------------------------------------
const shipmentSchema = z.object({
  shipmentId: z.uuid(),
  status: z.enum(["awaiting_booking", "booked", "at_port", "in_transit", "arrived", "released"]),
  method: z.preprocess((v) => (v === "" ? null : v), z.enum(["roro", "container"]).nullable()),
  vesselName: text(120),
  voyageNo: text(40),
  portOfLoading: text(120),
  portOfDischarge: text(120),
  etd: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  eta: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  blNumber: text(60),
  containerNo: text(40),
  note: text(1000),
});

export async function updateShipment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return staffAction(async (tx, viewer) => {
    const d = shipmentSchema.parse(formObject(formData, Object.keys(shipmentSchema.shape)));
    // The note is attached to the automatic status-change event by the trigger.
    await tx.query("select set_config('app.shipment_note', $1, true)", [d.note ?? ""]);
    const [before] = await tx.query<{ status: string; customer_id: string }>("select status, customer_id from public.shipments where id = $1", [d.shipmentId]);
    if (!before) throw new Error("Shipment not found");
    await tx.query(
      `update public.shipments set status = $2, method = $3, vessel_name = $4, voyage_no = $5, port_of_loading = $6, port_of_discharge = $7,
              etd = $8, eta = $9, bl_number = $10, container_no = $11, updated_by = $12 where id = $1`,
      [d.shipmentId, d.status, d.method, d.vesselName, d.voyageNo, d.portOfLoading, d.portOfDischarge, d.etd, d.eta, d.blNumber, d.containerNo, viewer.user.id],
    );
    if (before.status === d.status && d.note) {
      await tx.query(
        "insert into public.shipment_events (shipment_id, customer_id, status, note, created_by) values ($1, $2, $3, $4, $5)",
        [d.shipmentId, before.customer_id, d.status, d.note, viewer.user.id],
      );
    }
    await tx.query("select set_config('app.shipment_note', '', true)");
    return "Shipping updated — the customer sees the new status";
  }, dealPaths);
}
