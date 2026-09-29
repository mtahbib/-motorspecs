-- =============================================================================
-- Row Level Security
--
--   anon       : public catalogue only (through the catalog_vehicles view and
--                the listed-vehicle policies on translations/media/features).
--   customer   : own customer record and everything attached to it; documents
--                only when explicitly shared. Never internal notes, private
--                vehicle data, activity log or other customers.
--   sales      : customers assigned to them (and all history of those
--                customers), all vehicles (except private cost data), own tasks.
--   admin      : everything.
--
-- Helper functions are wrapped in (select ...) so Postgres evaluates them once
-- per statement instead of once per row.
-- =============================================================================

-- Table privileges. RLS below decides which rows are reachable.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The activity log is append-only from triggers; no direct writes at all.
revoke insert, update, delete on public.activity_log from anon, authenticated;
-- Assignment history and invites are written by triggers/RPCs only.
revoke insert, update, delete on public.customer_assignments from anon, authenticated;
revoke insert, update, delete on public.customer_invites from anon, authenticated;
revoke insert, update, delete on public.vehicle_price_history, public.vehicle_status_history from anon, authenticated;
-- Anonymous visitors never read base tables other than lookups; the policies
-- below also enforce this, the revoke is defence in depth.
revoke select on public.customers, public.customer_assignments, public.customer_invites,
  public.vehicles, public.vehicle_private, public.favorites, public.inquiries, public.messages,
  public.internal_notes, public.offers, public.reservations, public.sales, public.payments,
  public.shipments, public.shipment_events, public.documents, public.tasks, public.activity_log,
  public.profiles, public.vehicle_price_history, public.vehicle_status_history
  from anon;

alter table public.profiles enable row level security;
alter table public.makes enable row level security;
alter table public.models enable row level security;
alter table public.body_types enable row level security;
alter table public.locations enable row level security;
alter table public.features enable row level security;
alter table public.customers enable row level security;
alter table public.customer_assignments enable row level security;
alter table public.customer_invites enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_private enable row level security;
alter table public.vehicle_translations enable row level security;
alter table public.vehicle_features enable row level security;
alter table public.vehicle_media enable row level security;
alter table public.vehicle_price_history enable row level security;
alter table public.vehicle_status_history enable row level security;
alter table public.favorites enable row level security;
alter table public.inquiries enable row level security;
alter table public.messages enable row level security;
alter table public.internal_notes enable row level security;
alter table public.offers enable row level security;
alter table public.reservations enable row level security;
alter table public.sales enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_log enable row level security;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: staff read staff" on public.profiles
  for select to authenticated using ((select public.is_staff()) and role in ('admin', 'sales'));
create policy "profiles: admin read all" on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: admin update" on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Public-safe directory of staff names (for "your sales contact" and message
-- authors). Exposes nothing but id, name and role of active staff.
create view public.staff_directory
with (security_barrier = true)
as
  select p.id, p.display_name, p.role
  from public.profiles p
  where p.role in ('admin', 'sales') and p.is_active;

-- Hosted Supabase grants ALL on new relations to anon/authenticated by default.
-- This view runs with owner rights, so it must never be writable.
revoke all on public.staff_directory from public, anon, authenticated;
grant select on public.staff_directory to authenticated;

-- -----------------------------------------------------------------------------
-- Lookups: readable by everyone, writable by staff
-- -----------------------------------------------------------------------------
create policy "makes: read" on public.makes for select to anon, authenticated using (true);
create policy "makes: staff write" on public.makes for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "models: read" on public.models for select to anon, authenticated using (true);
create policy "models: staff write" on public.models for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "body_types: read" on public.body_types for select to anon, authenticated using (true);
create policy "body_types: admin write" on public.body_types for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "locations: read" on public.locations for select to anon, authenticated using (true);
create policy "locations: admin write" on public.locations for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "features: read" on public.features for select to anon, authenticated using (true);
create policy "features: admin write" on public.features for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Customers (master database)
-- -----------------------------------------------------------------------------
-- Checked against the row's own columns (not can_access_customer) so that
-- INSERT ... RETURNING works for the row being created.
create policy "customers: staff read accessible" on public.customers
  for select to authenticated using (
    (select public.is_admin()) or ((select public.is_staff()) and assigned_staff_id = (select auth.uid()))
  );
create policy "customers: read own" on public.customers
  for select to authenticated using (auth_user_id = (select auth.uid()));
create policy "customers: staff create" on public.customers
  for insert to authenticated with check (
    (select public.is_admin()) or ((select public.is_staff()) and assigned_staff_id = (select auth.uid()))
  );
create policy "customers: staff update accessible" on public.customers
  for update to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and assigned_staff_id = (select auth.uid())))
  with check ((select public.is_admin()) or ((select public.is_staff()) and assigned_staff_id = (select auth.uid())));
-- Protected columns are enforced by the customers_guard trigger.
create policy "customers: update own profile" on public.customers
  for update to authenticated
  using (auth_user_id = (select auth.uid()) and status <> 'merged')
  with check (auth_user_id = (select auth.uid()));

create policy "customer_assignments: staff read" on public.customer_assignments
  for select to authenticated using (public.can_access_customer(customer_id));

create policy "customer_invites: staff read" on public.customer_invites
  for select to authenticated using (public.can_access_customer(customer_id));

-- -----------------------------------------------------------------------------
-- Vehicles
-- -----------------------------------------------------------------------------
create policy "vehicles: staff read" on public.vehicles
  for select to authenticated using ((select public.is_staff()));
create policy "vehicles: staff insert" on public.vehicles
  for insert to authenticated with check ((select public.is_staff()));
create policy "vehicles: staff update" on public.vehicles
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "vehicles: admin delete drafts" on public.vehicles
  for delete to authenticated using ((select public.is_admin()) and status = 'draft');

create policy "vehicle_private: admin only" on public.vehicle_private
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "vehicle_translations: read visible" on public.vehicle_translations
  for select to anon, authenticated using (public.vehicle_visible_to_me(vehicle_id));
create policy "vehicle_translations: staff write" on public.vehicle_translations
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "vehicle_features: read visible" on public.vehicle_features
  for select to anon, authenticated using (public.vehicle_visible_to_me(vehicle_id));
create policy "vehicle_features: staff write" on public.vehicle_features
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "vehicle_media: read public media" on public.vehicle_media
  for select to anon, authenticated using (is_public and public.vehicle_visible_to_me(vehicle_id));
create policy "vehicle_media: staff read all" on public.vehicle_media
  for select to authenticated using ((select public.is_staff()));
create policy "vehicle_media: staff write" on public.vehicle_media
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

create policy "vehicle_price_history: staff read" on public.vehicle_price_history
  for select to authenticated using ((select public.is_staff()));
create policy "vehicle_status_history: staff read" on public.vehicle_status_history
  for select to authenticated using ((select public.is_staff()));

-- Public catalogue view. Runs with the view owner's rights so it can read the
-- vehicles table, and therefore does its own row filtering. The price is
-- nulled out unless the listing is "public price"; internal data lives in
-- vehicle_private and is never selected here.
create view public.catalog_vehicles
with (security_barrier = true)
as
  select
    v.id, v.ref_no, v.slug, v.chassis_no, v.model_code, v.engine_code, v.condition_grade,
    v.make_id, mk.name as make_name, mk.slug as make_slug,
    v.model_id, md.name as model_name, md.slug as model_slug,
    v.body_type, v.location_id, loc.name as location_name,
    v.reg_year, v.reg_month, v.manufacture_year, v.grade,
    v.mileage_km, v.operating_hours, v.engine_cc, v.transmission, v.fuel, v.drive, v.steering,
    v.exterior_color, v.interior_color, v.doors, v.seats, v.has_360_view,
    v.length_mm, v.width_mm, v.height_mm, v.m3, v.weight_kg, v.gross_weight_kg, v.max_load_kg,
    v.tyre_front, v.tyre_rear,
    v.price_visibility,
    case when v.price_visibility = 'public' and v.status <> 'sold' then v.fob_price_usd end as fob_price_usd,
    case when v.price_visibility = 'public' and v.status <> 'sold' then v.previous_price_usd end as previous_price_usd,
    v.status, v.is_featured, v.published_at, v.is_demo,
    (v.status in ('published', 'reserved', 'sold')) as is_listed
  from public.vehicles v
  left join public.makes mk on mk.id = v.make_id
  left join public.models md on md.id = v.model_id
  left join public.locations loc on loc.id = v.location_id
  where v.status in ('published', 'reserved', 'sold')
     or (
       auth.uid() is not null
       and public.vehicle_visible_to_me(v.id)
     );

revoke all on public.catalog_vehicles from public, anon, authenticated;
grant select on public.catalog_vehicles to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Favorites
-- -----------------------------------------------------------------------------
create policy "favorites: own" on public.favorites
  for all to authenticated
  using (customer_id = (select public.current_customer_id()))
  with check (customer_id = (select public.current_customer_id()));
create policy "favorites: staff read" on public.favorites
  for select to authenticated using (public.can_access_customer(customer_id));

-- -----------------------------------------------------------------------------
-- Inquiries, messages, notes, offers
-- -----------------------------------------------------------------------------
create policy "inquiries: customer read own" on public.inquiries
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "inquiries: customer create own" on public.inquiries
  for insert to authenticated with check (customer_id = (select public.current_customer_id()));
create policy "inquiries: staff read" on public.inquiries
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "inquiries: staff create" on public.inquiries
  for insert to authenticated with check (public.can_access_customer(customer_id));
create policy "inquiries: staff update" on public.inquiries
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

create policy "messages: customer read own" on public.messages
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "messages: customer send" on public.messages
  for insert to authenticated with check (
    customer_id = (select public.current_customer_id())
    and exists (select 1 from public.inquiries i where i.id = inquiry_id and i.status not in ('won', 'lost', 'closed'))
  );
create policy "messages: staff read" on public.messages
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "messages: staff send" on public.messages
  for insert to authenticated with check (public.can_access_customer(customer_id));
create policy "messages: staff mark read" on public.messages
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

create policy "internal_notes: staff" on public.internal_notes
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "internal_notes: staff create" on public.internal_notes
  for insert to authenticated with check (public.can_access_customer(customer_id));

create policy "offers: customer read own" on public.offers
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "offers: customer create" on public.offers
  for insert to authenticated with check (
    customer_id = (select public.current_customer_id()) and kind = 'customer_offer'
  );
create policy "offers: staff read" on public.offers
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "offers: staff create" on public.offers
  for insert to authenticated with check (public.can_access_customer(customer_id));
create policy "offers: staff update" on public.offers
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

-- -----------------------------------------------------------------------------
-- Reservations, sales, payments, shipping (customers: read only)
-- -----------------------------------------------------------------------------
create policy "reservations: customer read own" on public.reservations
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "reservations: staff read" on public.reservations
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "reservations: staff create" on public.reservations
  for insert to authenticated with check (public.can_access_customer(customer_id));
create policy "reservations: staff update" on public.reservations
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

create policy "sales: customer read own" on public.sales
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "sales: staff read" on public.sales
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "sales: staff create" on public.sales
  for insert to authenticated with check (public.can_access_customer(customer_id));
create policy "sales: staff update" on public.sales
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

create policy "payments: customer read own" on public.payments
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "payments: staff read" on public.payments
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "payments: staff record" on public.payments
  for insert to authenticated with check (public.can_access_customer(customer_id));
-- Verification/voiding is admin-only (also enforced by payments_guard).
create policy "payments: admin update" on public.payments
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "shipments: customer read own" on public.shipments
  for select to authenticated using (customer_id = (select public.current_customer_id()));
create policy "shipments: staff read" on public.shipments
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "shipments: staff update" on public.shipments
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

create policy "shipment_events: customer read visible" on public.shipment_events
  for select to authenticated using (customer_id = (select public.current_customer_id()) and visible_to_customer);
create policy "shipment_events: staff read" on public.shipment_events
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "shipment_events: staff create" on public.shipment_events
  for insert to authenticated with check (public.can_access_customer(customer_id));

-- -----------------------------------------------------------------------------
-- Documents: customers only see rows explicitly shared with them.
-- -----------------------------------------------------------------------------
create policy "documents: customer read shared" on public.documents
  for select to authenticated using (
    customer_id = (select public.current_customer_id()) and shared_with_customer and deleted_at is null
  );
create policy "documents: staff read" on public.documents
  for select to authenticated using (public.can_access_customer(customer_id));
create policy "documents: staff create" on public.documents
  for insert to authenticated with check (public.can_access_customer(customer_id) and uploaded_by = (select auth.uid()));
create policy "documents: staff update" on public.documents
  for update to authenticated using (public.can_access_customer(customer_id)) with check (public.can_access_customer(customer_id));

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
create policy "tasks: staff read" on public.tasks
  for select to authenticated using (
    (select public.is_admin())
    or ((select public.is_staff()) and (assigned_to = (select auth.uid()) or public.can_access_customer(customer_id)))
  );
create policy "tasks: staff create" on public.tasks
  for insert to authenticated with check (
    (select public.is_staff()) and (customer_id is null or public.can_access_customer(customer_id))
  );
create policy "tasks: assignee or admin update" on public.tasks
  for update to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and assigned_to = (select auth.uid())))
  with check ((select public.is_admin()) or ((select public.is_staff()) and assigned_to = (select auth.uid())));

-- -----------------------------------------------------------------------------
-- Activity log (read-only)
-- -----------------------------------------------------------------------------
create policy "activity_log: admin read" on public.activity_log
  for select to authenticated using ((select public.is_admin()));
create policy "activity_log: sales read related" on public.activity_log
  for select to authenticated using (
    (select public.is_staff()) and (actor_id = (select auth.uid()) or (customer_id is not null and public.can_access_customer(customer_id)))
  );
