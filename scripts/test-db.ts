/**
 * Security & business-rule tests for the Supabase schema.
 *
 * Runs the real migrations + demo seed in an in-memory PostgreSQL (PGlite) and
 * exercises Row Level Security as anon, customers, salespeople and the admin.
 *
 *   npm run db:test
 */
process.env.DEMO_DB_IN_MEMORY = "true";

import { DEMO_INVITE_CODE, ids } from "../src/lib/demo/seed-data";
import type { DbClaims, Tx } from "../src/lib/db/types";

const OWNER = ids.user(1);
const AIKO = ids.user(2);
const DANIEL = ids.user(3);
const AMARA = ids.user(11);
const OMAR = ids.user(12);
const LIAM_CUSTOMER = ids.customer(4);
const MOHAMED_CUSTOMER = ids.customer(6);

let passed = 0;
const failures: string[] = [];

async function main() {
  const { pgliteDriver, withDemoSystem } = await import("../src/lib/db/pglite-driver");
  const as = <T>(sub: string | null, fn: (tx: Tx) => Promise<T>, aal: "aal1" | "aal2" = "aal1") =>
    pgliteDriver.withClaims(sub ? ({ sub, role: "authenticated", aal } satisfies DbClaims) : null, fn);
  const count = async (sub: string | null, sql: string, params: unknown[] = []) =>
    as(sub, async (tx) => (await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) x`, params))[0].n);

  const t0 = Date.now();
  await as(null, async (tx) => tx.query("select 1"));
  console.log(`Demo database ready in ${Date.now() - t0} ms\n`);

  // ---------------------------------------------------------------------------
  section("Anonymous visitor");
  eq("catalogue lists only published/reserved/sold vehicles", await count(null, "select * from catalog_vehicles"), 21);
  eq("'Ask for price' vehicles never expose the amount",
    await count(null, "select * from catalog_vehicles where price_visibility = 'ask' and fob_price_usd is not null"), 0);
  eq("sold vehicles do not expose a price", await count(null, "select * from catalog_vehicles where status = 'sold' and fob_price_usd is not null"), 0);
  await rejects("cannot read the vehicles base table", as(null, (tx) => tx.query("select * from vehicles")));
  await rejects("cannot read customers", as(null, (tx) => tx.query("select * from customers")));
  eq("cannot see photos of draft vehicles",
    await count(null, "select * from vehicle_media where vehicle_id = $1", [ids.vehicle(23)]), 0);
  eq("private auction sheets are hidden", await count(null, "select * from vehicle_media where not is_public"), 0);
  eq("draft vehicle translations are hidden",
    await count(null, "select * from vehicle_translations where vehicle_id = $1", [ids.vehicle(22)]), 0);

  // ---------------------------------------------------------------------------
  section("Customer (Amara)");
  eq("sees exactly one customer record (her own)", await count(AMARA, "select * from customers"), 1);
  eq("sees only her own inquiries", await count(AMARA, "select * from inquiries"), 2);
  eq("never sees internal notes", await count(AMARA, "select * from internal_notes"), 0);
  eq("cannot read private vehicle costs", await count(AMARA, "select * from vehicle_private"), 0);
  eq("cannot read the activity log", await count(AMARA, "select * from activity_log"), 0);
  eq("sees only documents shared with her", await count(AMARA, "select * from documents"), 1);
  await ok("can edit permitted profile fields",
    as(AMARA, (tx) => tx.query("update customers set city = 'Lagos Island', phone = '+44 7700 900111' where auth_user_id = $1", [AMARA])));
  await rejects("cannot change her verification status",
    as(AMARA, (tx) => tx.query("update customers set verification_status = 'rejected' where auth_user_id = $1", [AMARA])));
  await rejects("cannot change her customer ID",
    as(AMARA, (tx) => tx.query("update customers set customer_code = 'MSC-1' where auth_user_id = $1", [AMARA])));
  await rejects("cannot reassign herself", as(AMARA, (tx) => tx.query("update customers set assigned_staff_id = $2 where auth_user_id = $1", [AMARA, DANIEL])));
  await rejects("cannot promote her own profile to admin",
    as(AMARA, (tx) => tx.query("update profiles set role = 'admin' where id = $1", [AMARA])));
  await rejects("cannot post into another customer's conversation",
    as(AMARA, (tx) => tx.query("insert into messages (inquiry_id, customer_id, sender_role, body) values ($1, $2, 'customer', 'hi')", [ids.inquiry(2), ids.customer(1)])));
  await rejects("cannot create reservations", as(AMARA, (tx) =>
    tx.query("insert into reservations (vehicle_id, customer_id) values ($1, $2)", [ids.vehicle(3), ids.customer(1)])));
  eq("cannot modify payments (no rows visible to update)", await as(AMARA, async (tx) =>
    (await tx.query("update payments set status = 'verified' returning id")).length), 0);
  const newInquiry = await as(AMARA, async (tx) =>
    (await tx.query<{ id: string }>("select public.create_inquiry($1, 'Test', 'Is this available?', 9000, 'Lagos') as id", [ids.vehicle(12)]))[0].id);
  eq("can open an inquiry with an offer", typeof newInquiry, "string");
  eq("her salesperson sees the new inquiry", await count(AIKO, "select * from inquiries where id = $1", [newInquiry]), 1);
  eq("another salesperson does not", await count(DANIEL, "select * from inquiries where id = $1", [newInquiry]), 0);
  eq("offer is forced to a customer offer", await count(AMARA, "select * from offers where inquiry_id = $1 and kind = 'customer_offer'", [newInquiry]), 1);
  await rejects("cannot accept her own offer", as(AMARA, async (tx) => {
    const [o] = await tx.query<{ id: string }>("select id from offers where inquiry_id = $1", [newInquiry]);
    await tx.query("select public.respond_to_offer($1, true)", [o.id]);
  }));

  section("Customer (Omar) documents & storage");
  eq("sees 3 of 4 sale documents (draft export certificate not shared)", await count(OMAR, "select * from documents"), 3);
  await withDemoSystem(async (tx) => {
    await tx.query("insert into storage.objects (bucket_id, name) select 'customer-documents', storage_path from public.documents");
  });
  eq("storage: can read only objects of documents shared with him",
    await count(OMAR, "select * from storage.objects where bucket_id = 'customer-documents'"), 3);
  eq("storage: cannot read another customer's files",
    await count(OMAR, "select * from storage.objects where name like $1", [`${ids.customer(3)}/%`]), 0);
  eq("sees his payments (read-only)", await count(OMAR, "select * from payments"), 2);
  eq("sees shipping events", await count(OMAR, "select * from shipment_events"), 3);

  // ---------------------------------------------------------------------------
  section("Salesperson (Aiko)");
  eq("sees only customers assigned to her", await count(AIKO, "select * from customers"), 3);
  eq("does not see Omar's (Daniel's) deals", await count(AIKO, "select * from sales where customer_id = $1", [ids.customer(2)]), 0);
  eq("cannot read private vehicle costs", await count(AIKO, "select * from vehicle_private"), 0);
  eq("can read draft vehicles in the CMS", await count(AIKO, "select * from vehicles where status = 'draft'"), 2);
  await rejects("cannot reassign customers", as(AIKO, (tx) =>
    tx.query("update customers set assigned_staff_id = $2 where id = $1", [ids.customer(1), DANIEL])));
  const created = await as(AIKO, async (tx) =>
    (await tx.query<{ assigned_staff_id: string; auth_user_id: string | null }>(
      "insert into customers (full_name, email, assigned_staff_id, auth_user_id) values ('New Lead', 'new.lead@demo.motorspecs.example', $1, $2) returning assigned_staff_id, auth_user_id",
      [AIKO, AMARA]))[0]);
  eq("customers she creates are assigned to her", created.assigned_staff_id, AIKO);
  eq("staff cannot pre-link a record to someone's login", created.auth_user_id, null);
  eq("cannot create a customer for another salesperson (assignment forced to self)", await as(AIKO, async (tx) =>
    (await tx.query<{ a: string }>("insert into customers (full_name, assigned_staff_id) values ('X', $1) returning assigned_staff_id as a", [DANIEL]))[0].a), AIKO);
  await ok("can record a payment", as(AIKO, (tx) =>
    tx.query("insert into payments (sale_id, customer_id, amount_usd, reference) values ($1, $2, 10, 'TEST')", [ids.sale(2), ids.customer(3)])));
  await rejects("cannot verify payments", as(AIKO, (tx) =>
    tx.query("update payments set status = 'verified' where reference = 'TEST'").then((r) => { if (!r.length) throw new Error("no row"); })));
  await rejects("cannot delete payments", as(AIKO, (tx) =>
    tx.query("delete from payments where reference = 'TEST' returning id").then((r) => { if (!r.length) throw new Error("no row"); })));
  eq("sees only his/her own activity and assigned customers' activity",
    await count(AIKO, "select * from activity_log where customer_id = $1", [ids.customer(2)]), 0);

  section("Reassignment keeps history");
  eq("Aiko no longer sees Liam (reassigned to Daniel)", await count(AIKO, "select * from customers where id = $1", [LIAM_CUSTOMER]), 0);
  eq("Daniel sees Liam's full inquiry history", await count(DANIEL, "select * from inquiries where customer_id = $1", [LIAM_CUSTOMER]), 1);
  eq("assignment history has both owners", await count(OWNER, "select * from customer_assignments where customer_id = $1", [LIAM_CUSTOMER]), 2);
  await ok("admin reassigns Amara to Daniel", as(OWNER, (tx) =>
    tx.query("select public.reassign_customer($1, $2, 'Test handover')", [ids.customer(1), DANIEL])));
  eq("Daniel now sees Amara's inquiries, notes and deals",
    await count(DANIEL, "select * from inquiries where customer_id = $1", [ids.customer(1)]), 3);
  eq("Aiko lost access to Amara", await count(AIKO, "select * from inquiries where customer_id = $1", [ids.customer(1)]), 0);
  eq("reassignment reason recorded",
    await count(OWNER, "select * from customer_assignments where customer_id = $1 and reason = 'Test handover'", [ids.customer(1)]), 1);
  eq("open tasks moved to the new owner",
    await count(OWNER, "select * from tasks where customer_id = $1 and status = 'open' and assigned_to <> $2", [ids.customer(1), DANIEL]), 0);

  // ---------------------------------------------------------------------------
  section("Owner / admin");
  eq("sees every customer", await count(OWNER, "select * from customers where is_demo"), 8);
  eq("reads private vehicle costs", await count(OWNER, "select * from vehicle_private") > 0, true);
  await ok("verifies a payment", as(OWNER, (tx) => tx.query("update payments set status = 'verified' where reference = 'TEST'")));
  await rejects("payment amounts are immutable", as(OWNER, (tx) => tx.query("update payments set amount_usd = 1 where reference = 'TEST'")));
  await rejects("voiding requires a reason", as(OWNER, (tx) => tx.query("update payments set status = 'void' where reference = 'TEST'")));
  await rejects("activity log is append-only", as(OWNER, (tx) => tx.query("delete from activity_log")));
  await rejects("owner cannot be demoted", as(OWNER, (tx) => tx.query("update profiles set role = 'sales' where id = $1", [OWNER])));
  await rejects("staff cannot pre-set reserved/sold by hand", as(OWNER, (tx) =>
    tx.query("update vehicles set status = 'sold' where id = $1", [ids.vehicle(3)])));

  section("Vehicle CMS");
  const blockers = await as(OWNER, async (tx) =>
    (await tx.query<{ b: string[] }>("select public.vehicle_publish_blockers($1) as b", [ids.vehicle(22)]))[0].b);
  eq("incomplete draft reports what is missing", blockers, ["photo"]);
  await rejects("publishing an incomplete draft fails", as(OWNER, (tx) =>
    tx.query("update vehicles set status = 'published' where id = $1", [ids.vehicle(22)])));
  await ok("draft can be saved with optional fields empty", as(AIKO, (tx) =>
    tx.query("insert into vehicles (slug, status) values ('quick-draft-test', 'draft')")));
  await rejects("new vehicles cannot skip the draft stage", as(AIKO, (tx) =>
    tx.query("insert into vehicles (slug, status) values ('skip-draft-test', 'published')")));
  const readyToPublish = await as(OWNER, async (tx) => {
    await tx.query("update vehicles set price_visibility = 'public' where id = $1", [ids.vehicle(23)]);
    await tx.query("update vehicles set status = 'published' where id = $1", [ids.vehicle(23)]);
    return (await tx.query<{ status: string }>("select status from vehicles where id = $1", [ids.vehicle(23)]))[0].status;
  });
  eq("a complete draft publishes", readyToPublish, "published");
  eq("price change was recorded in history",
    await count(OWNER, "select * from vehicle_price_history where vehicle_id = $1", [ids.vehicle(1)]) >= 2, true);

  section("Reservations & sales");
  await rejects("second active reservation on the same vehicle is refused", as(OWNER, (tx) =>
    tx.query("insert into reservations (vehicle_id, customer_id) values ($1, $2)", [ids.vehicle(2), ids.customer(4)])));
  await rejects("reserving a sold vehicle is refused", as(OWNER, (tx) =>
    tx.query("insert into reservations (vehicle_id, customer_id) values ($1, $2)", [ids.vehicle(20), ids.customer(4)])));
  await rejects("selling a vehicle reserved for someone else is refused", as(OWNER, (tx) =>
    tx.query("insert into sales (vehicle_id, customer_id, price_usd) values ($1, $2, 20000)", [ids.vehicle(2), ids.customer(4)])));
  await rejects("selling an already sold vehicle is refused", as(OWNER, (tx) =>
    tx.query("insert into sales (vehicle_id, customer_id, price_usd) values ($1, $2, 20000)", [ids.vehicle(20), ids.customer(4)])));
  const saleStatus = await as(OWNER, async (tx) => {
    const [r] = await tx.query<{ id: string }>("select id from reservations where vehicle_id = $1 and status = 'active'", [ids.vehicle(2)]);
    const [s] = await tx.query<{ id: string }>("select public.convert_reservation_to_sale($1, 24500, 'CFR', 1650) as id", [r.id]);
    await tx.query("insert into payments (sale_id, customer_id, amount_usd) values ($1, $2, 5000)", [s.id, ids.customer(1)]);
    const [v] = await tx.query<{ status: string }>("select status from vehicles where id = $1", [ids.vehicle(2)]);
    const [sale] = await tx.query<{ status: string }>("select status from sales where id = $1", [s.id]);
    const [ship] = await tx.query<{ n: number }>("select count(*)::int n from shipments where sale_id = $1", [s.id]);
    return `${v.status}/${sale.status}/${ship.n}`;
  });
  eq("converting a reservation marks the vehicle sold, tracks payments and opens a shipment", saleStatus, "sold/partially_paid/1");

  // ---------------------------------------------------------------------------
  section("Linking a staff-created record (verified invite only)");
  const newUser = "a0000000-0000-4000-8000-000000000099";
  const sameEmailUser = "a0000000-0000-4000-8000-000000000098";
  await withDemoSystem(async (tx) => {
    await tx.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'new.signup@demo.motorspecs.example', '{\"full_name\":\"Mo F\"}')", [newUser]);
    // Same email as the staff-created lead: must NOT be linked automatically.
    await tx.query("insert into auth.users (id, email) values ($1, 'mohamed.lead@demo.motorspecs.example')", [sameEmailUser]);
  });
  eq("matching email does not expose the historical record",
    await count(sameEmailUser, "select * from customers where id = $1", [MOHAMED_CUSTOMER]), 0);
  eq("new sign-up gets its own empty record", await count(newUser, "select * from customers"), 1);
  eq("cannot see the lead before redeeming", await count(newUser, "select * from customers where id = $1", [MOHAMED_CUSTOMER]), 0);
  const bad = await as(newUser, async (tx) => (await tx.query<{ r: { ok: boolean; error: string } }>("select public.redeem_customer_invite('WRONG-CODE') as r"))[0].r);
  eq("a wrong code is refused", bad.error, "invalid_code");
  await as(newUser, (tx) => tx.query("insert into favorites (customer_id, vehicle_id) values (public.current_customer_id(), $1)", [ids.vehicle(3)]));
  const good = await as(newUser, async (tx) => (await tx.query<{ r: { ok: boolean } }>("select public.redeem_customer_invite($1) as r", [DEMO_INVITE_CODE.toLowerCase()]))[0].r);
  eq("the correct one-time code links the record", good.ok, true);
  eq("customer now sees the linked record", await count(newUser, "select * from customers where id = $1", [MOHAMED_CUSTOMER]), 1);
  eq("favorites carried over", await count(newUser, "select * from favorites where customer_id = $1", [MOHAMED_CUSTOMER]), 1);
  eq("staff-only notes stay hidden after linking", await count(newUser, "select * from internal_notes"), 0);
  eq("unshared documents stay hidden after linking", await count(newUser, "select * from documents"), 0);
  const reuse = await as(sameEmailUser, async (tx) => (await tx.query<{ r: { ok: boolean; error: string } }>("select public.redeem_customer_invite($1) as r", [DEMO_INVITE_CODE]))[0].r);
  eq("the code cannot be used twice", reuse.error, "invalid_code");
  for (let i = 0; i < 5; i++) {
    await as(sameEmailUser, (tx) => tx.query("select public.redeem_customer_invite('GUESS-" + i + "')"));
  }
  const throttled = await as(sameEmailUser, async (tx) => (await tx.query<{ r: { error: string } }>("select public.redeem_customer_invite('ANY') as r"))[0].r);
  eq("repeated guessing is throttled", throttled.error, "too_many_attempts");

  // ---------------------------------------------------------------------------
  section("MFA-ready staff access");
  await as(OWNER, (tx) => tx.query("update profiles set mfa_required = true where id = $1", [DANIEL]));
  eq("staff with MFA required get no access without MFA (aal1)", await count(DANIEL, "select * from customers"), 0);
  eq("same staff after MFA (aal2) regain access", await as(DANIEL, async (tx) =>
    (await tx.query<{ n: number }>("select count(*)::int n from customers"))[0].n, "aal2") > 0, true);
  await rejects("salesperson cannot switch MFA off for themselves", as(DANIEL, (tx) =>
    tx.query("update profiles set mfa_required = false where id = $1", [DANIEL]), "aal2"));

  section("Schema hygiene");
  eq("every public table has RLS enabled", await withDemoSystem(async (tx) => (await tx.query<{ n: number }>(
    "select count(*)::int n from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"))[0].n), 0);
  eq("views are read-only for API roles", await withDemoSystem(async (tx) => (await tx.query<{ n: number }>(
    "select count(*)::int n from information_schema.role_table_grants where table_schema = 'public' and table_name in ('catalog_vehicles','staff_directory') and privilege_type <> 'SELECT' and grantee in ('anon','authenticated')"))[0].n), 0);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:\n" + failures.map((f) => `  ✗ ${f}`).join("\n"));
    process.exit(1);
  }
  process.exit(0);
}

function section(name: string) {
  console.log(`\n${name}`);
}

function eq(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    console.log(`  ✗ ${name} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

async function ok(name: string, p: Promise<unknown>) {
  try {
    await p;
    eq(name, true, true);
  } catch (err) {
    eq(name, (err as Error).message, "success");
  }
}

async function rejects(name: string, p: Promise<unknown>) {
  try {
    await p;
    eq(name, "succeeded", "rejected");
  } catch {
    eq(name, true, true);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
