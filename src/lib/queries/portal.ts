import "server-only";
import type { Tx } from "../db";
import type { Locale } from "../i18n/config";

/**
 * Customer-portal queries. They run as the signed-in customer, so RLS limits
 * every row to their own record — the WHERE clauses below are for clarity only.
 */

const vehicleSummary = (alias: string, locale: Locale) => `
  (select jsonb_build_object(
      'id', cv.id, 'slug', cv.slug, 'ref_no', cv.ref_no, 'status', cv.status,
      'title', coalesce(
        (select t.title from public.vehicle_translations t where t.vehicle_id = cv.id and t.locale = '${["en", "ja", "ar"].includes(locale) ? locale : "en"}' and coalesce(t.title, '') <> ''),
        (select t.title from public.vehicle_translations t where t.vehicle_id = cv.id and t.locale = 'en')),
      'cover', (select jsonb_build_object('bucket', m.bucket, 'storage_path', m.storage_path)
                  from public.vehicle_media m where m.vehicle_id = cv.id and m.kind = 'photo' and m.is_public
                 order by m.sort_order limit 1))
     from public.catalog_vehicles cv where cv.id = ${alias}.vehicle_id)`;

export type VehicleSummary = {
  id: string;
  slug: string;
  ref_no: string;
  status: string;
  title: string | null;
  cover: { bucket: string; storage_path: string } | null;
} | null;

export type MyCustomer = {
  id: string;
  customer_code: string;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country_code: string | null;
  city: string | null;
  address_line: string | null;
  postal_code: string | null;
  destination_port: string | null;
  preferred_language: Locale;
  preferred_contact: "email" | "phone" | "whatsapp";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verified_name: string | null;
  verified_company: string | null;
  verified_at: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
  salesperson: string | null;
};

export async function getMyCustomer(tx: Tx): Promise<MyCustomer | null> {
  const [row] = await tx.query<MyCustomer>(
    `select c.id, c.customer_code, c.full_name, c.company_name, c.email, c.phone, c.whatsapp, c.country_code, c.city,
            c.address_line, c.postal_code, c.destination_port, c.preferred_language, c.preferred_contact,
            c.verification_status, c.verified_name, c.verified_company, c.verified_at, c.status, c.is_demo, c.created_at,
            (select s.display_name from public.staff_directory s where s.id = c.assigned_staff_id) as salesperson
       from public.customers c where c.auth_user_id = auth.uid() and c.status <> 'merged'`,
  );
  return row ?? null;
}

export async function getPortalCounts(tx: Tx) {
  const [row] = await tx.query<{ favorites: number; open_inquiries: number; pending_offers: number; reserved: number; purchased: number }>(
    `select
       (select count(*)::int from public.favorites) as favorites,
       (select count(*)::int from public.inquiries where status not in ('won', 'lost', 'closed')) as open_inquiries,
       (select count(*)::int from public.offers where status = 'pending' and kind <> 'customer_offer') as pending_offers,
       (select count(*)::int from public.reservations where status = 'active') as reserved,
       (select count(*)::int from public.sales where status <> 'cancelled') as purchased`,
  );
  return row;
}

export type MyInquiryRow = {
  id: string;
  ref_no: string;
  subject: string;
  kind: string;
  status: string;
  last_message_at: string;
  created_at: string;
  vehicle: VehicleSummary;
  last_message: { body: string; sender_role: string } | null;
  pending_offer: { kind: string; amount_usd: number; incoterm: string } | null;
};

export async function listMyInquiries(tx: Tx, locale: Locale) {
  return tx.query<MyInquiryRow>(
    `select i.id, i.ref_no, i.subject, i.kind, i.status, i.last_message_at, i.created_at,
            ${vehicleSummary("i", locale)} as vehicle,
            (select jsonb_build_object('body', m.body, 'sender_role', m.sender_role) from public.messages m
              where m.inquiry_id = i.id order by m.created_at desc limit 1) as last_message,
            (select jsonb_build_object('kind', o.kind, 'amount_usd', o.amount_usd, 'incoterm', o.incoterm) from public.offers o
              where o.inquiry_id = i.id and o.status = 'pending' order by o.created_at desc limit 1) as pending_offer
       from public.inquiries i
      where i.customer_id = public.current_customer_id()
      order by i.last_message_at desc`,
  );
}

export type Offer = {
  id: string;
  kind: "customer_offer" | "counter_offer" | "quotation";
  amount_usd: number;
  incoterm: string;
  freight_usd: number | null;
  insurance_usd: number | null;
  inspection_usd: number | null;
  destination_port: string | null;
  valid_until: string | null;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired" | "superseded";
  created_at: string;
  responded_at: string | null;
};

export type Message = {
  id: string;
  sender_role: "customer" | "admin" | "sales" | "system";
  sender_name: string | null;
  body: string;
  created_at: string;
};

export async function getMyInquiry(tx: Tx, id: string, locale: Locale) {
  const [inquiry] = await tx.query<Omit<MyInquiryRow, "last_message" | "pending_offer"> & { destination_port: string | null }>(
    `select i.id, i.ref_no, i.subject, i.kind, i.status, i.last_message_at, i.created_at, i.destination_port,
            ${vehicleSummary("i", locale)} as vehicle
       from public.inquiries i where i.id = $1 and i.customer_id = public.current_customer_id()`,
    [id],
  );
  if (!inquiry) return null;
  const messages = await tx.query<Message>(
    `select m.id, m.sender_role, m.body, m.created_at,
            (select s.display_name from public.staff_directory s where s.id = m.sender_id) as sender_name
       from public.messages m where m.inquiry_id = $1 order by m.created_at`,
    [id],
  );
  const offers = await tx.query<Offer>(
    `select id, kind, amount_usd, incoterm, freight_usd, insurance_usd, inspection_usd, destination_port, valid_until,
            message, status, created_at, responded_at
       from public.offers where inquiry_id = $1 order by created_at desc`,
    [id],
  );
  return { inquiry, messages, offers };
}

export type MyReservation = {
  id: string;
  status: string;
  agreed_price_usd: number | null;
  reserved_until: string;
  created_at: string;
  inquiry_id: string | null;
  vehicle: VehicleSummary;
};

export async function listMyReservations(tx: Tx, locale: Locale) {
  return tx.query<MyReservation>(
    `select r.id, r.status, r.agreed_price_usd, r.reserved_until, r.created_at, r.inquiry_id, ${vehicleSummary("r", locale)} as vehicle
       from public.reservations r
      where r.customer_id = public.current_customer_id() and r.status in ('active', 'released', 'expired')
      order by (r.status = 'active') desc, r.created_at desc`,
  );
}

export type MyDocument = { id: string; kind: string; title: string; file_name: string; size_bytes: number; created_at: string; shared_at: string | null };

export type MyPurchase = {
  id: string;
  sale_no: string;
  invoice_no: string | null;
  status: string;
  incoterm: string;
  price_usd: number;
  freight_usd: number;
  insurance_usd: number;
  other_charges_usd: number;
  total_usd: number;
  sold_at: string;
  vehicle: VehicleSummary;
  payments: { id: string; amount_usd: number; paid_on: string; status: string; reference: string | null; method: string }[];
  shipment: {
    status: string;
    method: string | null;
    vessel_name: string | null;
    voyage_no: string | null;
    port_of_loading: string | null;
    port_of_discharge: string | null;
    etd: string | null;
    eta: string | null;
    bl_number: string | null;
    events: { status: string; note: string | null; created_at: string }[];
  } | null;
  documents: MyDocument[];
};

export async function listMyPurchases(tx: Tx, locale: Locale) {
  return tx.query<MyPurchase>(
    `select s.id, s.sale_no, s.invoice_no, s.status, s.incoterm, s.price_usd, s.freight_usd, s.insurance_usd,
            s.other_charges_usd, s.total_usd, s.sold_at, ${vehicleSummary("s", locale)} as vehicle,
            coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'amount_usd', p.amount_usd, 'paid_on', p.paid_on,
                        'status', p.status, 'reference', p.reference, 'method', p.method) order by p.paid_on)
                      from public.payments p where p.sale_id = s.id), '[]'::jsonb) as payments,
            (select jsonb_build_object('status', sh.status, 'method', sh.method, 'vessel_name', sh.vessel_name,
                      'voyage_no', sh.voyage_no, 'port_of_loading', sh.port_of_loading, 'port_of_discharge', sh.port_of_discharge,
                      'etd', sh.etd, 'eta', sh.eta, 'bl_number', sh.bl_number,
                      'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.status, 'note', e.note, 'created_at', e.created_at) order by e.created_at)
                                           from public.shipment_events e where e.shipment_id = sh.id), '[]'::jsonb))
               from public.shipments sh where sh.sale_id = s.id) as shipment,
            coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'title', d.title, 'file_name', d.file_name,
                        'size_bytes', d.size_bytes, 'created_at', d.created_at, 'shared_at', d.shared_at) order by d.created_at)
                      from public.documents d where d.sale_id = s.id), '[]'::jsonb) as documents
       from public.sales s
      where s.customer_id = public.current_customer_id() and s.status <> 'cancelled'
      order by s.sold_at desc`,
  );
}

export async function listMyOtherDocuments(tx: Tx) {
  return tx.query<MyDocument>(
    `select id, kind, title, file_name, size_bytes, created_at, shared_at from public.documents
      where customer_id = public.current_customer_id() and sale_id is null order by created_at desc`,
  );
}
