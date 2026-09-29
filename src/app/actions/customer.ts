"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer, withDb } from "@/lib/auth/session";
import { DbError } from "@/lib/db";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";

export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | undefined;

const localeOf = (v: FormDataEntryValue | null): Locale => (isLocale(String(v)) ? (String(v) as Locale) : "en");
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

async function requireCustomerViewer(locale: Locale) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login`);
  if (viewer.role !== "customer" || !viewer.customer) throw new Error("Customer account required");
  return viewer;
}

function friendly(err: unknown, locale: Locale): string {
  const t = getDictionary(locale).common;
  if (err instanceof DbError && err.code === "54000") return err.message;
  console.error(err);
  return t.errorGeneric;
}

// -----------------------------------------------------------------------------
// Favorites
// -----------------------------------------------------------------------------
export async function toggleFavorite(formData: FormData) {
  const locale = localeOf(formData.get("locale"));
  const vehicleId = z.uuid().parse(formData.get("vehicleId"));
  const back = String(formData.get("back") ?? `/${locale}/vehicles`);
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/login?next=${encodeURIComponent(back)}`);
  if (viewer.role !== "customer") return;

  await withDb(async (tx) => {
    const removed = await tx.query(
      "delete from public.favorites where customer_id = public.current_customer_id() and vehicle_id = $1 returning vehicle_id",
      [vehicleId],
    );
    if (!removed.length) {
      await tx.query(
        "insert into public.favorites (customer_id, vehicle_id) values (public.current_customer_id(), $1) on conflict do nothing",
        [vehicleId],
      );
    }
  });
  revalidatePath(`/${locale}`, "layout");
}

// -----------------------------------------------------------------------------
// Inquiries & offers
// -----------------------------------------------------------------------------
const inquirySchema = z.object({
  vehicleId: z.uuid(),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(2).max(5000),
  offerAmount: z.coerce.number().positive().max(9_999_999).optional(),
  destinationPort: optionalText(120),
});

export async function submitInquiry(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData.get("locale"));
  const t = getDictionary(locale);
  await requireCustomerViewer(locale);
  const raw = formData.get("offerAmount");
  const parsed = inquirySchema.safeParse({
    vehicleId: formData.get("vehicleId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    offerAmount: raw === null || raw === "" ? undefined : raw,
    destinationPort: formData.get("destinationPort") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = t.common.required;
    return { error: t.common.errorGeneric, fieldErrors };
  }
  const d = parsed.data;
  try {
    await withDb((tx) =>
      tx.query("select public.create_inquiry($1, $2, $3, $4, $5)", [d.vehicleId, d.subject, d.message, d.offerAmount ?? null, d.destinationPort ?? null]),
    );
  } catch (err) {
    return { error: friendly(err, locale) };
  }
  revalidatePath(`/${locale}/account`, "layout");
  return { ok: true, message: t.inquiry.sent };
}

export async function sendCustomerMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData.get("locale"));
  await requireCustomerViewer(locale);
  const parsed = z
    .object({ inquiryId: z.uuid(), body: z.string().trim().min(1).max(5000) })
    .safeParse({ inquiryId: formData.get("inquiryId"), body: formData.get("body") });
  if (!parsed.success) return { error: getDictionary(locale).common.required };
  try {
    await withDb((tx) =>
      tx.query("insert into public.messages (inquiry_id, customer_id, sender_role, body) values ($1, public.current_customer_id(), 'customer', $2)", [
        parsed.data.inquiryId,
        parsed.data.body,
      ]),
    );
  } catch (err) {
    return { error: friendly(err, locale) };
  }
  revalidatePath(`/${locale}/account/inquiries/${parsed.data.inquiryId}`);
  return { ok: true };
}

export async function respondToOffer(formData: FormData) {
  const locale = localeOf(formData.get("locale"));
  await requireCustomerViewer(locale);
  const offerId = z.uuid().parse(formData.get("offerId"));
  const accept = formData.get("decision") === "accept";
  const inquiryId = z.uuid().parse(formData.get("inquiryId"));
  await withDb((tx) => tx.query("select public.respond_to_offer($1, $2)", [offerId, accept]));
  revalidatePath(`/${locale}/account/inquiries/${inquiryId}`);
}

export async function makeCounterOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData.get("locale"));
  const t = getDictionary(locale);
  await requireCustomerViewer(locale);
  const parsed = z
    .object({ inquiryId: z.uuid(), amount: z.coerce.number().positive().max(9_999_999), message: optionalText(2000) })
    .safeParse({ inquiryId: formData.get("inquiryId"), amount: formData.get("amount"), message: formData.get("message") ?? "" });
  if (!parsed.success) return { error: t.common.required };
  try {
    await withDb(async (tx) => {
      const [inq] = await tx.query<{ vehicle_id: string | null; destination_port: string | null }>(
        "select vehicle_id, destination_port from public.inquiries where id = $1",
        [parsed.data.inquiryId],
      );
      if (!inq) throw new Error("not found");
      await tx.query(
        `insert into public.offers (inquiry_id, customer_id, vehicle_id, kind, amount_usd, destination_port, message)
         values ($1, public.current_customer_id(), $2, 'customer_offer', $3, $4, $5)`,
        [parsed.data.inquiryId, inq.vehicle_id, parsed.data.amount, inq.destination_port, parsed.data.message ?? null],
      );
    });
  } catch (err) {
    return { error: friendly(err, locale) };
  }
  revalidatePath(`/${locale}/account/inquiries/${parsed.data.inquiryId}`);
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Profile (only customer-editable fields; the database rejects the rest)
// -----------------------------------------------------------------------------
const profileSchema = z.object({
  full_name: z.string().trim().min(1).max(160),
  company_name: optionalText(160),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  country_code: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .or(z.literal("").transform(() => null)),
  city: optionalText(120),
  address_line: optionalText(300),
  postal_code: optionalText(20),
  destination_port: optionalText(120),
  preferred_language: z.enum(["en", "ja", "ar"]),
  preferred_contact: z.enum(["email", "phone", "whatsapp"]),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData.get("locale"));
  const t = getDictionary(locale);
  await requireCustomerViewer(locale);
  const input = Object.fromEntries(Object.keys(profileSchema.shape).map((k) => [k, formData.get(k) ?? ""]));
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = t.common.required;
    return { error: t.common.errorGeneric, fieldErrors };
  }
  const d = parsed.data;
  try {
    await withDb((tx) =>
      tx.query(
        `update public.customers set full_name = $1, company_name = $2, phone = $3, whatsapp = $4, country_code = $5,
                city = $6, address_line = $7, postal_code = $8, destination_port = $9, preferred_language = $10, preferred_contact = $11
          where auth_user_id = auth.uid()`,
        [d.full_name, d.company_name ?? null, d.phone ?? null, d.whatsapp ?? null, d.country_code, d.city ?? null, d.address_line ?? null,
          d.postal_code ?? null, d.destination_port ?? null, d.preferred_language, d.preferred_contact],
      ),
    );
  } catch (err) {
    return { error: friendly(err, locale) };
  }
  revalidatePath(`/${locale}/account`, "layout");
  return { ok: true, message: t.portal.saved };
}

// -----------------------------------------------------------------------------
// Link a staff-created customer record with a one-time code
// -----------------------------------------------------------------------------
export async function redeemInvite(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData.get("locale"));
  const t = getDictionary(locale).portal;
  await requireCustomerViewer(locale);
  const code = String(formData.get("code") ?? "").trim().slice(0, 40);
  if (!code) return { error: t.linkErrors.invalid_code };
  const result = await withDb(async (tx) => {
    const [row] = await tx.query<{ r: { ok: boolean; error?: keyof typeof t.linkErrors } }>("select public.redeem_customer_invite($1) as r", [code]);
    return row.r;
  });
  if (!result.ok) return { error: t.linkErrors[result.error ?? "invalid_code"] ?? t.linkErrors.invalid_code };
  revalidatePath(`/${locale}`, "layout");
  return { ok: true, message: t.linkSuccess };
}
