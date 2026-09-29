import { scryptSync } from "node:crypto";
import {
  DEMO_INVITE_CODE,
  DEMO_PASSWORD,
  OWNER,
  ids,
  seedBodyTypes,
  seedCustomerNotes,
  seedCustomers,
  seedFeatures,
  seedInquiries,
  seedLocations,
  seedLooseDocuments,
  seedMakes,
  seedOffers,
  seedReservations,
  seedSales,
  seedTasks,
  seedUsers,
  seedVehicles,
} from "./seed-data";
import { createHash } from "node:crypto";

/**
 * Builds the demo seed as SQL.
 *
 * - `supabase`: creates demo logins in Supabase's real auth.users/auth.identities
 *   (for `supabase db reset` locally or a throwaway hosted demo project).
 * - `stub`: creates logins in the local auth stub used by the embedded demo DB.
 *
 * Everything after the auth block is identical. Timestamps are relative to
 * now() so the demo always looks current.
 */
export function buildSeedSql(authMode: "supabase" | "stub"): string {
  const out: string[] = [];
  const push = (s: string) => out.push(s);

  push("-- =============================================================================");
  push("-- MotorSpecs DEMO seed data — fictional people, companies and documents.");
  push("-- Generated from src/lib/demo/seed-data.ts by `npm run db:seed:generate`.");
  push("-- Do not edit by hand. Remove before go-live: supabase/scripts/purge_demo_data.sql");
  push("-- =============================================================================");
  push("begin;");
  push("create temp table _seed_activity_start on commit drop as select coalesce(max(id), 0) as id from public.activity_log;");
  push("");

  // --- Auth users --------------------------------------------------------------
  push("-- Demo logins");
  for (const u of seedUsers) {
    const meta = JSON.stringify({ full_name: u.name, locale: u.locale, demo: true });
    if (authMode === "supabase") {
      push(
        `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', ${q(u.id)}, 'authenticated', 'authenticated', ${q(u.email)}, extensions.crypt(${q(DEMO_PASSWORD)}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', ${q(meta)}::jsonb, now(), now(), '', '', '', '')
on conflict (id) do nothing;`,
      );
      push(
        `insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), ${q(u.id)}, ${q(u.id)}, jsonb_build_object('sub', ${q(u.id)}, 'email', ${q(u.email)}, 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;`,
      );
    } else {
      push(
        `insert into auth.users (id, email, raw_user_meta_data, demo_password_hash, email_confirmed_at)
values (${q(u.id)}, ${q(u.email)}, ${q(meta)}::jsonb, ${q(hashDemoPassword(DEMO_PASSWORD))}, now())
on conflict (id) do nothing;`,
      );
    }
  }
  push("");

  // --- Profiles ----------------------------------------------------------------
  for (const u of seedUsers) {
    push(
      `update public.profiles set role = ${q(u.role)}, display_name = ${q(u.name)}, locale = ${q(u.locale)}, is_owner = ${u.isOwner ? "true" : "false"}, is_demo = true where id = ${q(u.id)};`,
    );
  }
  const staffIds = seedUsers.filter((u) => u.role !== "customer").map((u) => u.id);
  push(`delete from public.customers where auth_user_id in (${staffIds.map(q).join(", ")});`);
  push("");

  // --- Lookups -------------------------------------------------------------------
  push("-- Lookups (safe to keep in production)");
  seedMakes.forEach((m, i) => {
    push(`insert into public.makes (name, slug, sort_order) values (${q(m.name)}, ${q(m.slug)}, ${(i + 1) * 10}) on conflict (slug) do nothing;`);
    for (const model of m.models) {
      push(
        `insert into public.models (make_id, name, slug) select id, ${q(model)}, ${q(slugify(model))} from public.makes where slug = ${q(m.slug)} on conflict (make_id, slug) do nothing;`,
      );
    }
  });
  seedBodyTypes.forEach((b, i) =>
    push(`insert into public.body_types (code, sort_order) values (${q(b)}, ${(i + 1) * 10}) on conflict do nothing;`),
  );
  for (const l of seedLocations) {
    push(`insert into public.locations (name, country_code, port) values (${q(l.name)}, 'JP', ${q(l.port)}) on conflict (name) do nothing;`);
  }
  seedFeatures.forEach((f, i) =>
    push(`insert into public.features (code, category, sort_order) values (${q(f.code)}, ${q(f.category)}, ${(i + 1) * 10}) on conflict do nothing;`),
  );
  push("");

  // --- Customers ---------------------------------------------------------------
  push("-- Customers");
  for (const [index, c] of seedCustomers.entries()) {
    const current = c.assignments.length ? c.assignments[c.assignments.length - 1].to : null;
    const fields: Record<string, string> = {
      customer_code: q(`MSC-${10001 + index}`),
      full_name: q(c.fullName),
      company_name: q(c.company ?? null),
      email: q(c.email ?? null),
      phone: q(c.phone ?? null),
      whatsapp: q(c.whatsapp ?? null),
      country_code: q(c.country),
      city: q(c.city ?? null),
      destination_port: q(c.destinationPort ?? null),
      preferred_language: q(c.language),
      preferred_contact: q(c.preferredContact ?? "email"),
      status: q(c.status),
      verification_status: q(c.verification),
      verified_name: q(c.verifiedName ?? null),
      verified_company: q(c.verifiedCompany ?? null),
      verified_at: c.verification === "verified" ? ago(c.createdDaysAgo - 1) : "null",
      verified_by: c.verification === "verified" ? q(OWNER) : "null",
      source: q(c.source),
      tags: `array[${(c.tags ?? []).map(q).join(", ")}]::text[]`,
      assigned_staff_id: q(current),
      created_by: q(c.createdBy ?? null),
      created_at: ago(c.createdDaysAgo),
      is_demo: "true",
    };
    if (c.authUserId) {
      const sets = Object.entries(fields).map(([k, v]) => `${k} = ${v}`);
      push(`update public.customers set id = ${q(c.id)}, ${sets.join(", ")} where auth_user_id = ${q(c.authUserId)};`);
    } else {
      push(
        `insert into public.customers (id, ${Object.keys(fields).join(", ")}) values (${q(c.id)}, ${Object.values(fields).join(", ")});`,
      );
    }
  }
  push("select setval('public.customer_code_seq', greatest(nextval('public.customer_code_seq'), 10100));");
  const demoCustomerIds = seedCustomers.map((c) => q(c.id)).join(", ");
  // Replace trigger-generated history with the realistic timeline.
  push(`delete from public.customer_assignments where customer_id in (${demoCustomerIds});`);
  for (const c of seedCustomers) {
    let prev: string | null = null;
    for (const a of c.assignments) {
      push(
        `insert into public.customer_assignments (customer_id, from_staff_id, to_staff_id, assigned_by, reason, created_at) values (${q(c.id)}, ${q(prev)}, ${q(a.to)}, ${q(a.by ?? OWNER)}, ${q(a.reason ?? null)}, ${ago(a.daysAgo)});`,
      );
      prev = a.to;
    }
  }
  for (const n of seedCustomerNotes) {
    push(`insert into public.internal_notes (customer_id, author_id, body, created_at) values (${q(n.customer)}, ${q(n.by)}, ${q(n.body)}, ${ago(n.daysAgo)});`);
  }
  push(
    `insert into public.customer_invites (customer_id, code_hash, code_hint, expires_at, created_by, created_at) values (${q(ids.customer(6))}, ${q(sha256(DEMO_INVITE_CODE))}, ${q(DEMO_INVITE_CODE.slice(-4))}, now() + interval '60 days', ${q(ids.user(2))}, ${ago(11)});`,
  );
  push("");

  // --- Vehicles ------------------------------------------------------------------
  push("-- Vehicles");
  for (const v of seedVehicles) {
    const id = ids.vehicle(v.n);
    const createdDays = (v.publishedDaysAgo ?? 5) + 2;
    const cols: Record<string, string> = {
      id: q(id),
      ref_no: q(v.ref),
      slug: q(slugify(`${v.regYear ?? ""} ${v.make} ${v.model} ${v.ref}`)),
      chassis_no: q(v.chassis ?? null),
      model_code: q(v.modelCode ?? null),
      engine_code: q(v.engineCode ?? null),
      condition_grade: q(v.conditionGrade ?? null),
      auction_sheet_ref: q(v.auctionSheetRef ?? null),
      make_id: `(select id from public.makes where slug = ${q(v.make)})`,
      model_id: `(select m.id from public.models m join public.makes mk on mk.id = m.make_id where mk.slug = ${q(v.make)} and m.slug = ${q(slugify(v.model))})`,
      body_type: q(v.body),
      location_id: `(select id from public.locations where name = ${q(seedLocations[v.location - 1].name)})`,
      reg_year: num(v.regYear),
      reg_month: num(v.regMonth),
      grade: q(v.grade ?? null),
      mileage_km: num(v.mileage),
      operating_hours: num(v.hours),
      engine_cc: num(v.cc),
      transmission: q(v.transmission ?? null),
      fuel: q(v.fuel ?? null),
      drive: q(v.drive ?? null),
      steering: q(v.steering ?? null),
      exterior_color: q(v.color ?? null),
      interior_color: q(v.interior ?? null),
      doors: num(v.doors),
      seats: num(v.seats),
      has_360_view: v.view360 ? "true" : "false",
      length_mm: num(v.dims?.[0]),
      width_mm: num(v.dims?.[1]),
      height_mm: num(v.dims?.[2]),
      m3: num(v.m3),
      weight_kg: num(v.weight),
      gross_weight_kg: num(v.grossWeight),
      max_load_kg: num(v.maxLoad),
      tyre_front: q(v.tyre ?? null),
      tyre_rear: q(v.tyre ?? null),
      price_visibility: q(v.askPrice || v.price == null ? "ask" : "public"),
      fob_price_usd: num(v.price),
      previous_price_usd: num(v.previousPrice),
      status: q(v.status),
      is_featured: v.featured ? "true" : "false",
      published_at: v.status === "published" ? ago(v.publishedDaysAgo ?? 1) : "null",
      is_demo: "true",
      created_by: q(OWNER),
      updated_by: q(OWNER),
      created_at: ago(createdDays),
      updated_at: ago(v.publishedDaysAgo ?? 1),
    };
    push(`insert into public.vehicles (${Object.keys(cols).join(", ")}) values (${Object.values(cols).join(", ")});`);

    if (v.costJpy || v.costUsd || v.supplier) {
      push(
        `insert into public.vehicle_private (vehicle_id, internal_cost_jpy, internal_cost_usd, supplier, auction_house, purchase_date, internal_notes, updated_by) values (${q(id)}, ${num(v.costJpy)}, ${num(v.costUsd)}, ${q(v.supplier ?? null)}, ${q(v.auctionHouse ?? null)}, (now() - interval '${createdDays + 5} days')::date, ${q("Demo purchase record — fictional supplier and cost.")}, ${q(OWNER)});`,
      );
    }
    for (const locale of ["en", "ja", "ar"] as const) {
      const t = v[locale];
      if (!t) continue;
      push(
        `insert into public.vehicle_translations (vehicle_id, locale, title, description, remarks) values (${q(id)}, ${q(locale)}, ${q(t.title)}, ${q(t.description || null)}, ${q(t.remarks ?? null)});`,
      );
    }
    if (v.features.length) {
      push(
        `insert into public.vehicle_features (vehicle_id, feature_code) values ${v.features.map((f) => `(${q(id)}, ${q(f)})`).join(", ")};`,
      );
    }
    for (let i = 1; i <= v.photos; i++) {
      push(
        `insert into public.vehicle_media (vehicle_id, kind, bucket, storage_path, is_public, sort_order, caption, mime_type) values (${q(id)}, 'photo', 'vehicle-photos', ${q(`demo/${v.ref}/${i}.svg`)}, true, ${i}, ${q(`Demo photo ${i}`)}, 'image/svg+xml');`,
      );
    }
    if (v.inspectionSheet) {
      push(
        `insert into public.vehicle_media (vehicle_id, kind, bucket, storage_path, is_public, sort_order, caption, mime_type) values (${q(id)}, 'inspection_sheet', 'vehicle-photos', ${q(`demo/${v.ref}/inspection.svg`)}, true, 50, 'Inspection sheet (demo)', 'image/svg+xml');`,
      );
    }
    if (v.privateAuctionSheet) {
      push(
        `insert into public.vehicle_media (vehicle_id, kind, bucket, storage_path, is_public, sort_order, caption, mime_type) values (${q(id)}, 'auction_sheet', 'vehicle-internal', ${q(`demo/${v.ref}/auction-sheet.svg`)}, false, 60, 'Original auction sheet (staff only, demo)', 'image/svg+xml');`,
      );
    }
    if (v.previousPrice && v.price) {
      push(
        `insert into public.vehicle_price_history (vehicle_id, old_price_usd, new_price_usd, old_visibility, new_visibility, changed_by, changed_at) values (${q(id)}, ${v.previousPrice}, ${v.price}, 'public', 'public', ${q(OWNER)}, ${ago((v.publishedDaysAgo ?? 5) / 2)});`,
      );
      push(
        `update public.vehicle_price_history set new_price_usd = ${v.previousPrice}, changed_at = ${ago(createdDays)} where vehicle_id = ${q(id)} and old_price_usd is null;`,
      );
    }
  }
  const demoVehicleIds = seedVehicles.map((v) => q(ids.vehicle(v.n))).join(", ");
  push(`update public.vehicle_status_history h set changed_at = v.created_at, changed_by = ${q(OWNER)} from public.vehicles v where v.id = h.vehicle_id and v.id in (${demoVehicleIds});`);
  push(`update public.vehicle_price_history h set changed_by = ${q(OWNER)} where h.changed_by is null and h.vehicle_id in (${demoVehicleIds});`);
  push("select setval('public.vehicle_ref_seq', greatest(nextval('public.vehicle_ref_seq'), 24100));");
  push("");

  // --- Favorites ---------------------------------------------------------------
  const favs: [string, number, number][] = [
    [ids.customer(1), 1, 3], [ids.customer(1), 2, 9], [ids.customer(1), 13, 12],
    [ids.customer(2), 20, 28], [ids.customer(2), 17, 2],
    [ids.customer(4), 4, 6], [ids.customer(4), 6, 6], [ids.customer(4), 14, 3],
    [ids.customer(5), 5, 3], [ids.customer(5), 10, 2],
  ];
  for (const [c, v, d] of favs) {
    push(`insert into public.favorites (customer_id, vehicle_id, created_at) values (${q(c)}, ${q(ids.vehicle(v))}, ${ago(d)});`);
  }
  push("");

  // --- Inquiries, messages, notes ----------------------------------------------
  push("-- Inquiries and conversations");
  const customerLogin = new Map(seedCustomers.map((c) => [c.id, c.authUserId ?? null]));
  const staffRole = new Map(seedUsers.map((u) => [u.id, u.role]));
  for (const inq of seedInquiries) {
    const id = ids.inquiry(inq.n);
    push(
      `insert into public.inquiries (id, customer_id, vehicle_id, kind, subject, status, destination_port, is_demo, created_by, created_at, last_message_at) values (${q(id)}, ${q(inq.customer)}, ${inq.vehicle ? q(ids.vehicle(inq.vehicle)) : "null"}, ${q(inq.kind)}, ${q(inq.subject)}, 'new', ${q(inq.destinationPort ?? null)}, true, ${q(customerLogin.get(inq.customer) ?? null)}, ${ago(inq.createdDaysAgo)}, ${ago(inq.createdDaysAgo)});`,
    );
    for (const m of inq.messages) {
      const isCustomer = m.from === "customer";
      push(
        `insert into public.messages (inquiry_id, customer_id, sender_id, sender_role, body, created_at, read_at) values (${q(id)}, ${q(inq.customer)}, ${q(isCustomer ? customerLogin.get(inq.customer) ?? null : m.from)}, ${q(isCustomer ? "customer" : staffRole.get(m.from) ?? "sales")}, ${q(m.body)}, ${ago(m.daysAgo)}, ${inq.status === "new" ? "null" : ago(m.daysAgo - 0.1)});`,
      );
    }
    for (const n of inq.notes ?? []) {
      push(
        `insert into public.internal_notes (customer_id, inquiry_id, author_id, body, created_at) values (${q(inq.customer)}, ${q(id)}, ${q(n.by)}, ${q(n.body)}, ${ago(n.daysAgo)});`,
      );
    }
  }
  for (const o of seedOffers) {
    const inq = seedInquiries.find((i) => i.n === o.inquiry)!;
    const byCustomer = o.by === "customer";
    push(
      `insert into public.offers (id, inquiry_id, customer_id, vehicle_id, kind, amount_usd, incoterm, freight_usd, insurance_usd, inspection_usd, destination_port, valid_until, message, status, responded_at, created_by, created_at) values (${q(ids.offer(o.n))}, ${q(ids.inquiry(o.inquiry))}, ${q(inq.customer)}, ${inq.vehicle ? q(ids.vehicle(inq.vehicle)) : "null"}, ${q(o.kind)}, ${o.amount}, ${q(o.incoterm ?? "FOB")}, ${num(o.freight)}, ${num(o.insurance)}, ${num(o.inspection)}, ${q(inq.destinationPort ?? null)}, ${o.validDays ? `(${ago(o.daysAgo)} + interval '${o.validDays} days')::date` : "null"}, ${q(o.message ?? null)}, ${q(o.status)}, ${o.status === "accepted" || o.status === "declined" ? ago(o.daysAgo - 0.5) : "null"}, ${q(byCustomer ? customerLogin.get(inq.customer) ?? null : o.by)}, ${ago(o.daysAgo)});`,
    );
  }
  push("");

  // --- Reservations & sales --------------------------------------------------------
  push("-- Reservations, sales, payments, shipping");
  for (const r of seedReservations) {
    push(
      `insert into public.reservations (id, vehicle_id, customer_id, inquiry_id, offer_id, agreed_price_usd, reserved_until, notes, is_demo, reserved_by, created_at) values (${q(ids.reservation(r.n))}, ${q(ids.vehicle(r.vehicle))}, ${q(r.customer)}, ${q(ids.inquiry(r.inquiry))}, ${q(ids.offer(r.offer))}, ${r.price}, ${ago(r.daysAgo - r.holdDays)}, ${q(r.notes ?? null)}, true, ${q(r.by)}, ${ago(r.daysAgo)});`,
    );
    const sale = seedSales.find((s) => s.reservation === r.n);
    if (!sale) continue;
    const saleId = ids.sale(sale.n);
    push(
      `insert into public.sales (id, vehicle_id, customer_id, reservation_id, inquiry_id, staff_id, incoterm, price_usd, freight_usd, insurance_usd, other_charges_usd, invoice_no, is_demo, created_by, sold_at, created_at) values (${q(saleId)}, ${q(ids.vehicle(r.vehicle))}, ${q(r.customer)}, ${q(ids.reservation(r.n))}, ${q(ids.inquiry(r.inquiry))}, ${q(sale.staff)}, ${q(sale.incoterm)}, ${sale.price}, ${sale.freight ?? 0}, ${sale.insurance ?? 0}, ${sale.other ?? 0}, ${q(sale.invoiceNo)}, true, ${q(sale.staff)}, ${ago(sale.daysAgo)}, ${ago(sale.daysAgo)});`,
    );
    push(`update public.reservations set updated_at = ${ago(sale.daysAgo)} where id = ${q(ids.reservation(r.n))};`);
    for (const p of sale.payments) {
      push(
        `insert into public.payments (id, sale_id, customer_id, amount_usd, method, reference, paid_on, status, recorded_by, verified_by, verified_at, is_demo, created_at) values (${q(ids.payment(p.n))}, ${q(saleId)}, ${q(r.customer)}, ${p.amount}, 'bank_transfer', ${q(p.ref)}, (${ago(p.daysAgo)})::date, ${q(p.status)}, ${q(p.by)}, ${p.status === "verified" ? q(OWNER) : "null"}, ${p.status === "verified" ? ago(p.daysAgo - 1) : "null"}, true, ${ago(p.daysAgo)});`,
      );
    }
    const s = sale.shipment;
    push(
      `update public.shipments set status = ${q(s.status)}, method = ${q(s.method)}, vessel_name = ${q(s.vessel ?? null)}, voyage_no = ${q(s.voyage ?? null)}, port_of_loading = ${q(s.pol ?? null)}, port_of_discharge = ${q(s.pod ?? null)}, etd = ${s.etdDays != null ? `(now() + interval '${s.etdDays} days')::date` : "null"}, eta = ${s.etaDays != null ? `(now() + interval '${s.etaDays} days')::date` : "null"}, bl_number = ${q(s.bl ?? null)}, updated_by = ${q(sale.staff)}, created_at = ${ago(sale.daysAgo)} where sale_id = ${q(saleId)};`,
    );
    push(`delete from public.shipment_events where shipment_id = (select id from public.shipments where sale_id = ${q(saleId)});`);
    for (const e of s.events) {
      push(
        `insert into public.shipment_events (shipment_id, customer_id, status, note, visible_to_customer, created_by, created_at) select id, customer_id, ${q(e.status)}, ${q(e.note ?? null)}, ${e.visible === false ? "false" : "true"}, ${q(sale.staff)}, ${ago(e.daysAgo)} from public.shipments where sale_id = ${q(saleId)};`,
      );
    }
    if (sale.completed) {
      push(`update public.sales set status = 'completed', completed_at = ${ago(28)} where id = ${q(saleId)};`);
    }
    for (const d of sale.documents) {
      push(documentSql(d.n, r.customer, saleId, null, d.kind, d.title, d.file, d.shared, d.daysAgo, d.by));
    }
  }
  for (const d of seedLooseDocuments) {
    push(documentSql(d.n, d.customer, null, d.inquiry ? ids.inquiry(d.inquiry) : null, d.kind, d.title, d.file, d.shared, d.daysAgo, d.by));
  }
  push("");

  // --- Tasks ---------------------------------------------------------------------
  for (const t of seedTasks) {
    push(
      `insert into public.tasks (id, title, customer_id, inquiry_id, assigned_to, due_at, priority, is_demo, created_by, created_at) values (${q(ids.task(t.n))}, ${q(t.title)}, ${q(t.customer)}, ${t.inquiry ? q(ids.inquiry(t.inquiry)) : "null"}, ${q(t.to)}, now() + interval '${t.dueDays} days', ${q(t.priority)}, true, ${q(t.to)}, ${ago(2)});`,
    );
  }
  push("");

  // --- Final statuses (triggers moved some along while seeding) -------------------
  for (const inq of seedInquiries) {
    push(`update public.inquiries set status = ${q(inq.status)} where id = ${q(ids.inquiry(inq.n))};`);
  }
  push("");

  // --- Curated activity trail -------------------------------------------------------
  push("-- Replace seeding noise with a readable activity history");
  push("delete from public.activity_log where id > (select id from _seed_activity_start);");
  const act = (daysAgo: number, actor: string | null, action: string, entity: string, entityId: string | null, customer: string | null, summary: string) =>
    push(
      `insert into public.activity_log (occurred_at, actor_id, actor_role, action, entity_type, entity_id, customer_id, summary) values (${ago(daysAgo)}, ${q(actor)}, ${q(actor ? staffRole.get(actor) ?? "customer" : "system")}, ${q(action)}, ${q(entity)}, ${q(entityId)}, ${q(customer)}, ${q(summary)});`,
    );
  const staffName = (id: string) => seedUsers.find((u) => u.id === id)?.name.replace(/ \(.*\)$/, "") ?? "staff";
  for (const c of seedCustomers) {
    act(c.createdDaysAgo, c.createdBy ?? null, "insert", "customer", c.id, c.id, c.createdBy ? `Customer record created by ${staffName(c.createdBy)}` : "Customer registered on the website");
    let prev: string | null = null;
    for (const a of c.assignments) {
      act(a.daysAgo, a.by ?? OWNER, "assigned", "customer", c.id, c.id,
        prev ? `Reassigned from ${staffName(prev)} to ${a.to ? staffName(a.to) : "nobody"}${a.reason ? ` — ${a.reason}` : ""}` : `Assigned to ${a.to ? staffName(a.to) : "nobody"}${a.reason ? ` — ${a.reason}` : ""}`);
      prev = a.to;
    }
  }
  for (const o of seedOffers.filter((o) => o.by !== "customer")) {
    const inq = seedInquiries.find((i) => i.n === o.inquiry)!;
    act(o.daysAgo, o.by, "insert", "offer", ids.offer(o.n), inq.customer, `${o.kind === "quotation" ? "Quotation" : "Counter-offer"} sent: USD ${o.amount.toLocaleString("en-US")} ${o.incoterm ?? "FOB"}`);
  }
  for (const r of seedReservations) {
    const v = seedVehicles.find((x) => x.n === r.vehicle)!;
    act(r.daysAgo, r.by, "insert", "reservation", ids.reservation(r.n), r.customer, `Reserved ${v.ref} (${v.en.title})`);
  }
  for (const s of seedSales) {
    const r = seedReservations.find((x) => x.n === s.reservation)!;
    act(s.daysAgo, s.staff, "insert", "sale", ids.sale(s.n), r.customer, `Sale created — invoice ${s.invoiceNo}`);
    for (const p of s.payments) {
      act(p.daysAgo, p.by, "insert", "payment", ids.payment(p.n), r.customer, `Payment recorded: USD ${p.amount.toLocaleString("en-US")} (${p.ref})`);
      if (p.status === "verified") act(p.daysAgo - 1, OWNER, "update", "payment", ids.payment(p.n), r.customer, "Payment verified by admin");
    }
  }
  for (const v of seedVehicles.filter((x) => x.previousPrice && x.price)) {
    act((v.publishedDaysAgo ?? 5) / 2, OWNER, "update", "vehicle", ids.vehicle(v.n), null, `Price of ${v.ref} changed from USD ${v.previousPrice!.toLocaleString("en-US")} to USD ${v.price!.toLocaleString("en-US")}`);
  }
  act(11, ids.user(2), "invite_created", "customer", ids.customer(6), ids.customer(6), "Portal link code issued");

  push("");
  push("commit;");
  return out.join("\n") + "\n";

  function documentSql(n: number, customer: string, sale: string | null, inquiry: string | null, kind: string, title: string, file: string, shared: boolean, daysAgo: number, by: string) {
    const id = ids.document(n);
    return `insert into public.documents (id, customer_id, sale_id, inquiry_id, kind, title, storage_path, file_name, mime_type, size_bytes, shared_with_customer, is_demo, uploaded_by, created_at) values (${q(id)}, ${q(customer)}, ${q(sale)}, ${q(inquiry)}, ${q(kind)}, ${q(title)}, ${q(`${customer}/${id}/${file}`)}, ${q(file)}, 'application/pdf', 2048, ${shared ? "true" : "false"}, true, ${q(by)}, ${ago(daysAgo)});`;
  }
}

function q(v: string | null | undefined): string {
  if (v === null || v === undefined) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? "null" : String(v);
}

function ago(days: number): string {
  return `(now() - interval '${Math.round(days * 1000) / 1000} days')`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sha256(s: string): string {
  return createHash("sha256").update(s.toUpperCase().trim(), "utf8").digest("hex");
}

const DEMO_SALT = "motorspecs-demo-salt";

/** scrypt hash used only by the demo-mode auth stub. */
export function hashDemoPassword(password: string, salt = DEMO_SALT): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}
