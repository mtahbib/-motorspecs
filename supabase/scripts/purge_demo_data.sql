-- =============================================================================
-- Remove ALL demo data (rows flagged is_demo and the demo logins) before
-- go-live. Run once in the Supabase SQL editor (as postgres).
--
-- Real records are never deleted: if a real customer/vehicle/etc. references a
-- demo staff account (assigned_staff_id, created_by, ...), that reference is
-- set to NULL instead.
-- Lookup tables (makes, models, body types, locations, features) are kept.
-- =============================================================================
begin;

create temp table _demo_customers on commit drop as select id from public.customers where is_demo;
create temp table _demo_vehicles on commit drop as select id from public.vehicles where is_demo;
create temp table _demo_users on commit drop as select id from public.profiles where is_demo;

-- Customer-owned history
delete from public.activity_log where customer_id in (select id from _demo_customers);
delete from public.payments where customer_id in (select id from _demo_customers) or is_demo;
delete from public.shipment_events where customer_id in (select id from _demo_customers);
delete from public.shipments where customer_id in (select id from _demo_customers);
delete from public.documents where customer_id in (select id from _demo_customers) or is_demo;
delete from public.sales where customer_id in (select id from _demo_customers) or vehicle_id in (select id from _demo_vehicles) or is_demo;
delete from public.reservations where customer_id in (select id from _demo_customers) or vehicle_id in (select id from _demo_vehicles) or is_demo;
delete from public.tasks where customer_id in (select id from _demo_customers) or is_demo;
delete from public.offers where customer_id in (select id from _demo_customers) or vehicle_id in (select id from _demo_vehicles);
delete from public.messages where customer_id in (select id from _demo_customers);
delete from public.internal_notes where customer_id in (select id from _demo_customers);
delete from public.inquiries where customer_id in (select id from _demo_customers) or is_demo;
delete from public.favorites where customer_id in (select id from _demo_customers) or vehicle_id in (select id from _demo_vehicles);
update public.customers set merged_into = null where merged_into in (select id from _demo_customers);
delete from public.customers where id in (select id from _demo_customers);

-- Vehicles (translations, media rows, features, private data cascade)
delete from public.inquiries where vehicle_id in (select id from _demo_vehicles);
delete from public.vehicles where id in (select id from _demo_vehicles);

-- Detach real rows from demo staff accounts, then delete the demo logins.
-- Required references (e.g. tasks.assigned_to) move to the real owner account.
do $$
declare
  r record;
  v_hit integer;
  v_owner uuid := (select id from public.profiles
                    where role = 'admin' and is_active and not is_demo
                    order by is_owner desc, created_at limit 1);
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, a.attnotnull as required
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass
  loop
    if r.required then
      -- EXECUTE does not set FOUND, so read the result explicitly.
      execute format('select count(*) from %s where %I in (select id from _demo_users)', r.tbl, r.col) into v_hit;
      if v_hit > 0 and v_owner is null then
        raise exception 'Create/promote a real admin account before purging: % still references demo staff', r.tbl;
      end if;
      execute format('update %s set %I = $1 where %I in (select id from _demo_users)', r.tbl, r.col, r.col) using v_owner;
    else
      execute format('update %s set %I = null where %I in (select id from _demo_users)', r.tbl, r.col, r.col);
    end if;
  end loop;
end $$;

delete from public.activity_log where actor_id in (select id from _demo_users);
delete from auth.users where id in (select id from _demo_users);

commit;

-- Uploaded demo files: seeded demo media use `demo/...` paths that exist only
-- as generated placeholders; nothing needs deleting from Storage.
