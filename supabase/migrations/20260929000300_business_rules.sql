-- =============================================================================
-- Business rules enforced in the database (triggers).
-- These hold no matter which client performs the write.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger vehicle_private_updated_at before update on public.vehicle_private
  for each row execute function public.set_updated_at();
create trigger vehicle_translations_updated_at before update on public.vehicle_translations
  for each row execute function public.set_updated_at();
create trigger inquiries_updated_at before update on public.inquiries
  for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();
create trigger sales_updated_at before update on public.sales
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger shipments_updated_at before update on public.shipments
  for each row execute function public.set_updated_at();
create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- New auth user -> profile + (for self sign-ups) a fresh customer record.
-- Never links to an existing customer by email or phone: historical records are
-- only linked through public.redeem_customer_invite().
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'Customer'), '@', 1)
  );
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'en');
begin
  if v_locale not in ('en', 'ja', 'ar') then
    v_locale := 'en';
  end if;

  insert into public.profiles (id, role, display_name, email, locale)
  values (new.id, 'customer', left(v_name, 120), new.email, v_locale)
  on conflict (id) do nothing;

  -- Staff accounts are created as customers and promoted by an admin with
  -- public.set_staff_role(); the promotion removes this empty customer row.
  insert into public.customers (auth_user_id, full_name, email, preferred_language, source)
  values (new.id, left(v_name, 160), new.email, v_locale, 'website')
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Profiles: only admins change role/active/MFA flags; nobody demotes the owner.
-- -----------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;

  if new.id <> old.id or new.email is distinct from old.email or new.is_demo <> old.is_demo then
    raise exception 'profile identity fields are read-only' using errcode = '42501';
  end if;

  if new.is_owner <> old.is_owner then
    raise exception 'owner flag can only be changed by the database administrator' using errcode = '42501';
  end if;

  if (new.role, new.is_active, new.mfa_required) is distinct from (old.role, old.is_active, old.mfa_required) then
    if not public.is_admin() then
      raise exception 'only an admin can change roles or account status' using errcode = '42501';
    end if;
    if old.is_owner and (new.role <> 'admin' or not new.is_active) then
      raise exception 'the owner account cannot be demoted or deactivated' using errcode = '42501';
    end if;
    if new.role = 'customer' and old.role <> 'customer' then
      raise exception 'staff accounts cannot be converted into customer accounts' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create trigger profiles_audit after update of role, is_active, mfa_required on public.profiles
  for each row execute function public.audit_row_change('staff_user');

-- -----------------------------------------------------------------------------
-- Customers
-- -----------------------------------------------------------------------------
create or replace function public.guard_customer_write()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Staff-created records are never pre-linked to a login.
    new.auth_user_id := null;
    new.status := case when new.status in ('lead', 'active') then new.status else 'active' end;
    new.merged_into := null;
    new.created_by := auth.uid();
    new.source := case when new.source = 'website' then 'staff' else new.source end;
    if not public.is_admin() then
      -- Salespeople create customers for themselves.
      new.assigned_staff_id := auth.uid();
    end if;
    return new;
  end if;

  -- UPDATE
  if (new.id, new.customer_code, new.auth_user_id, new.merged_into, new.is_demo, new.created_by, new.created_at)
     is distinct from
     (old.id, old.customer_code, old.auth_user_id, old.merged_into, old.is_demo, old.created_by, old.created_at) then
    raise exception 'customer identity fields are read-only' using errcode = '42501';
  end if;

  if new.assigned_staff_id is distinct from old.assigned_staff_id and not public.is_admin() then
    raise exception 'only an admin can assign or reassign customers' using errcode = '42501';
  end if;

  if not public.is_staff() then
    -- Customer editing their own record: only profile fields may change.
    if (new.status, new.email, new.verification_status, new.verified_name, new.verified_company,
        new.verified_at, new.verified_by, new.source, new.tags)
       is distinct from
       (old.status, old.email, old.verification_status, old.verified_name, old.verified_company,
        old.verified_at, old.verified_by, old.source, old.tags) then
      raise exception 'this field is managed by MotorSpecs staff' using errcode = '42501';
    end if;
  else
    if new.verification_status = 'verified' and old.verification_status <> 'verified' then
      new.verified_at := now();
      new.verified_by := auth.uid();
    end if;
  end if;

  return new;
end;
$$;

create trigger customers_guard before insert or update on public.customers
  for each row execute function public.guard_customer_write();

create or replace function public.record_customer_assignment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.assigned_staff_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assigned_staff_id is not distinct from old.assigned_staff_id then
    return new;
  end if;

  insert into public.customer_assignments (customer_id, from_staff_id, to_staff_id, assigned_by, reason)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.assigned_staff_id end,
    new.assigned_staff_id,
    auth.uid(),
    nullif(current_setting('app.assignment_reason', true), '')
  );
  return new;
end;
$$;

create trigger customers_assignment_history
  after insert or update of assigned_staff_id on public.customers
  for each row execute function public.record_customer_assignment();

create trigger customers_audit after insert or update on public.customers
  for each row execute function public.audit_row_change('customer');

-- -----------------------------------------------------------------------------
-- Child rows inherit customer_id from their parent (never trusted from input).
-- -----------------------------------------------------------------------------
create or replace function public.inherit_customer_from_inquiry()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.inquiry_id is not null then
    select i.customer_id into new.customer_id from public.inquiries i where i.id = new.inquiry_id;
    if new.customer_id is null then
      raise exception 'inquiry not found' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_customer before insert on public.messages
  for each row execute function public.inherit_customer_from_inquiry();
create trigger internal_notes_customer before insert on public.internal_notes
  for each row execute function public.inherit_customer_from_inquiry();
create trigger offers_customer before insert on public.offers
  for each row execute function public.inherit_customer_from_inquiry();

create or replace function public.inherit_customer_from_sale()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.sale_id is not null then
    select s.customer_id into new.customer_id from public.sales s where s.id = new.sale_id;
  end if;
  return new;
end;
$$;

create trigger payments_customer before insert on public.payments
  for each row execute function public.inherit_customer_from_sale();
create trigger shipments_customer before insert on public.shipments
  for each row execute function public.inherit_customer_from_sale();

create or replace function public.inherit_customer_from_shipment()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select s.customer_id into new.customer_id from public.shipments s where s.id = new.shipment_id;
  return new;
end;
$$;

create trigger shipment_events_customer before insert on public.shipment_events
  for each row execute function public.inherit_customer_from_shipment();

-- Documents attached to a sale/inquiry must belong to the same customer.
create or replace function public.check_document_parent()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.sale_id is not null and not exists (
    select 1 from public.sales s where s.id = new.sale_id and s.customer_id = new.customer_id
  ) then
    raise exception 'sale belongs to a different customer' using errcode = '23514';
  end if;
  if new.inquiry_id is not null and not exists (
    select 1 from public.inquiries i where i.id = new.inquiry_id and i.customer_id = new.customer_id
  ) then
    raise exception 'inquiry belongs to a different customer' using errcode = '23514';
  end if;
  if new.storage_path not like new.customer_id::text || '/%' then
    raise exception 'document path must start with the customer id' using errcode = '23514';
  end if;
  if new.shared_with_customer and (tg_op = 'INSERT' or not old.shared_with_customer) then
    new.shared_at := now();
  end if;
  return new;
end;
$$;

create trigger documents_parent before insert or update on public.documents
  for each row execute function public.check_document_parent();

create trigger documents_audit after insert or update on public.documents
  for each row execute function public.audit_row_change('document');

-- -----------------------------------------------------------------------------
-- Inquiries & messages
-- -----------------------------------------------------------------------------
create or replace function public.guard_inquiry_write()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if not public.is_staff() then
      new.status := 'new';
      new.follow_up_at := null;
      new.closed_reason := null;
      new.is_demo := false;
    end if;
  elsif new.customer_id <> old.customer_id then
    raise exception 'an inquiry cannot be moved to another customer' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger inquiries_guard before insert or update on public.inquiries
  for each row execute function public.guard_inquiry_write();

create trigger inquiries_audit after insert or update of status, follow_up_at on public.inquiries
  for each row execute function public.audit_row_change('inquiry');

create or replace function public.after_message_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.inquiries
     set last_message_at = new.created_at,
         status = case
           when new.sender_role in ('admin', 'sales') and status = 'new' then 'open'
           else status
         end
   where id = new.inquiry_id;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.after_message_insert();

create or replace function public.guard_message_insert()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;
  new.sender_id := auth.uid();
  new.sender_role := coalesce(public.current_app_role(), 'customer');
  new.read_at := null;
  return new;
end;
$$;

create trigger messages_guard before insert on public.messages
  for each row execute function public.guard_message_insert();

create or replace function public.guard_author_insert()
returns trigger
language plpgsql
as $$
begin
  if not public.is_trusted_context() then
    new.author_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger internal_notes_guard before insert on public.internal_notes
  for each row execute function public.guard_author_insert();

-- -----------------------------------------------------------------------------
-- Offers
-- -----------------------------------------------------------------------------
create or replace function public.guard_offer_write()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.status := 'pending';
    new.responded_at := null;
    new.responded_by := null;
    if public.is_staff() then
      if new.kind = 'customer_offer' then
        raise exception 'staff create quotations or counter offers' using errcode = '42501';
      end if;
    else
      new.kind := 'customer_offer';
    end if;
    -- A new offer supersedes earlier pending offers in the same conversation.
    update public.offers set status = 'superseded'
     where inquiry_id = new.inquiry_id and status = 'pending';
    update public.inquiries
       set status = case
             when new.kind = 'quotation' and status in ('new', 'open') then 'quoted'
             when status in ('new', 'open', 'quoted') then 'negotiating'
             else status end
     where id = new.inquiry_id;
  else
    if (new.inquiry_id, new.customer_id, new.vehicle_id, new.kind, new.amount_usd, new.incoterm,
        new.freight_usd, new.insurance_usd, new.inspection_usd, new.created_by, new.created_at)
       is distinct from
       (old.inquiry_id, old.customer_id, old.vehicle_id, old.kind, old.amount_usd, old.incoterm,
        old.freight_usd, old.insurance_usd, old.inspection_usd, old.created_by, old.created_at) then
      raise exception 'offers are immutable; create a new quotation instead' using errcode = '42501';
    end if;
    if old.status <> 'pending' and new.status <> old.status then
      raise exception 'offer is already closed' using errcode = '23514';
    end if;
    if new.status <> old.status then
      new.responded_at := now();
      new.responded_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger offers_guard before insert or update on public.offers
  for each row execute function public.guard_offer_write();

create trigger offers_audit after insert or update of status on public.offers
  for each row execute function public.audit_row_change('offer');

-- -----------------------------------------------------------------------------
-- Vehicles
-- -----------------------------------------------------------------------------

-- Reasons a vehicle cannot be published yet. Empty array = ready.
-- SECURITY INVOKER: callers only learn about vehicles they can already read.
create or replace function public.vehicle_blockers_for_row(v public.vehicles)
returns text[]
language plpgsql stable
as $$
declare
  v_blockers text[] := '{}';
begin
  if v.make_id is null then v_blockers := array_append(v_blockers, 'make'); end if;
  if v.model_id is null then v_blockers := array_append(v_blockers, 'model'); end if;
  if v.body_type is null then v_blockers := array_append(v_blockers, 'body_type'); end if;
  if v.reg_year is null and v.manufacture_year is null then v_blockers := array_append(v_blockers, 'year'); end if;
  if v.mileage_km is null and v.operating_hours is null then v_blockers := array_append(v_blockers, 'mileage'); end if;
  if v.price_visibility = 'public' and v.fob_price_usd is null then v_blockers := array_append(v_blockers, 'price'); end if;
  if not exists (
    select 1 from public.vehicle_translations t
    where t.vehicle_id = v.id and t.locale = 'en' and coalesce(trim(t.title), '') <> ''
  ) then
    v_blockers := array_append(v_blockers, 'title_en');
  end if;
  if not exists (
    select 1 from public.vehicle_media m where m.vehicle_id = v.id and m.kind = 'photo' and m.is_public
  ) then
    v_blockers := array_append(v_blockers, 'photo');
  end if;
  return v_blockers;
end;
$$;

create or replace function public.vehicle_publish_blockers(p_vehicle_id uuid)
returns text[]
language sql stable
as $$
  select public.vehicle_blockers_for_row(v) from public.vehicles v where v.id = p_vehicle_id
$$;

create or replace function public.guard_vehicle_write()
returns trigger
language plpgsql
as $$
declare
  v_blockers text[];
begin
  if tg_op = 'INSERT' then
    if not public.is_trusted_context() then
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
      -- New vehicles always start as drafts; publishing is a separate step
      -- that runs the completeness check below.
      if new.status <> 'draft' then
        raise exception 'new vehicles must be saved as a draft first' using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if not public.is_trusted_context() then
    new.updated_by := auth.uid();
    if new.is_demo <> old.is_demo or new.created_by is distinct from old.created_by then
      raise exception 'read-only vehicle field' using errcode = '42501';
    end if;
    -- Reserved/sold are driven by reservations and sales (via the definer
    -- function sync_vehicle_status), never set by hand.
    if new.status <> old.status and (new.status in ('reserved', 'sold') or old.status in ('reserved', 'sold')) then
      raise exception 'reserved/sold status is managed through reservations and sales' using errcode = '23514';
    end if;
  end if;

  if new.status = 'published' and old.status in ('draft', 'archived') then
    v_blockers := public.vehicle_blockers_for_row(new);
    if cardinality(v_blockers) > 0 then
      raise exception 'vehicle is not ready to publish: %', array_to_string(v_blockers, ', ')
        using errcode = '23514';
    end if;
  end if;
  if new.status = 'published' and old.status <> 'published' then
    new.published_at := coalesce(old.published_at, now());
  end if;

  return new;
end;
$$;

create trigger vehicles_guard before insert or update on public.vehicles
  for each row execute function public.guard_vehicle_write();

create or replace function public.record_vehicle_history()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.vehicle_status_history (vehicle_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
    if new.fob_price_usd is not null then
      insert into public.vehicle_price_history (vehicle_id, old_price_usd, new_price_usd, old_visibility, new_visibility, changed_by)
      values (new.id, null, new.fob_price_usd, null, new.price_visibility, auth.uid());
    end if;
    return new;
  end if;

  if new.status <> old.status then
    insert into public.vehicle_status_history (vehicle_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  if new.fob_price_usd is distinct from old.fob_price_usd or new.price_visibility <> old.price_visibility then
    insert into public.vehicle_price_history (vehicle_id, old_price_usd, new_price_usd, old_visibility, new_visibility, changed_by)
    values (new.id, old.fob_price_usd, new.fob_price_usd, old.price_visibility, new.price_visibility, auth.uid());
  end if;
  return new;
end;
$$;

create trigger vehicles_history after insert or update on public.vehicles
  for each row execute function public.record_vehicle_history();

create trigger vehicles_audit after update of status, fob_price_usd, price_visibility, is_featured on public.vehicles
  for each row execute function public.audit_row_change('vehicle');

create trigger vehicle_private_audit after insert or update on public.vehicle_private
  for each row execute function public.audit_row_change('vehicle_private');

-- Internal helper for the reservation/sale triggers below.
create or replace function public.sync_vehicle_status(p_vehicle_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.vehicles set status = p_status where id = p_vehicle_id and status <> p_status;
end;
$$;

revoke execute on function public.sync_vehicle_status(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reservations: one active per vehicle, never on a sold vehicle.
-- -----------------------------------------------------------------------------
create or replace function public.before_reservation_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
begin
  -- Serialise concurrent reservation/sale attempts on the same vehicle.
  select status into v_status from public.vehicles where id = new.vehicle_id for update;
  if v_status is null then
    raise exception 'vehicle not found' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if not public.is_trusted_context() then
      new.reserved_by := auth.uid();
    end if;
    new.status := 'active';
    if v_status in ('draft', 'archived') then
      raise exception 'only listed vehicles can be reserved' using errcode = '23514';
    end if;
    if exists (select 1 from public.sales s where s.vehicle_id = new.vehicle_id and s.status <> 'cancelled') then
      raise exception 'vehicle is already sold' using errcode = '23505';
    end if;
    if exists (select 1 from public.reservations r where r.vehicle_id = new.vehicle_id and r.status = 'active') then
      raise exception 'vehicle already has an active reservation' using errcode = '23505';
    end if;
    if new.inquiry_id is not null and not exists (
      select 1 from public.inquiries i where i.id = new.inquiry_id and i.customer_id = new.customer_id
    ) then
      raise exception 'inquiry belongs to a different customer' using errcode = '23514';
    end if;
  else
    if new.vehicle_id <> old.vehicle_id or new.customer_id <> old.customer_id then
      raise exception 'reservation vehicle/customer cannot be changed' using errcode = '42501';
    end if;
    if old.status <> 'active' and new.status <> old.status then
      raise exception 'reservation is closed' using errcode = '23514';
    end if;
    if new.status in ('released', 'expired') and old.status = 'active' then
      new.released_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger reservations_before before insert or update on public.reservations
  for each row execute function public.before_reservation_write();

create or replace function public.after_reservation_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_vehicle_status(new.vehicle_id, 'reserved');
    if new.inquiry_id is not null then
      update public.inquiries set status = 'reserved' where id = new.inquiry_id and status not in ('won', 'lost', 'closed');
    end if;
  elsif new.status in ('released', 'expired') and old.status = 'active' then
    if not exists (select 1 from public.sales s where s.vehicle_id = new.vehicle_id and s.status <> 'cancelled') then
      perform public.sync_vehicle_status(new.vehicle_id, 'published');
    end if;
    if new.inquiry_id is not null then
      update public.inquiries set status = 'negotiating' where id = new.inquiry_id and status = 'reserved';
    end if;
  end if;
  return new;
end;
$$;

create trigger reservations_after after insert or update on public.reservations
  for each row execute function public.after_reservation_write();

create trigger reservations_audit after insert or update on public.reservations
  for each row execute function public.audit_row_change('reservation');

-- -----------------------------------------------------------------------------
-- Sales: one live sale per vehicle; converts the customer's reservation.
-- -----------------------------------------------------------------------------
create or replace function public.before_sale_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_status text;
  v_res public.reservations%rowtype;
begin
  select status into v_status from public.vehicles where id = new.vehicle_id for update;
  if v_status is null then
    raise exception 'vehicle not found' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if not public.is_trusted_context() then
      new.created_by := auth.uid();
      new.staff_id := coalesce(new.staff_id, auth.uid());
    end if;
    new.status := 'awaiting_payment';
    if exists (select 1 from public.sales s where s.vehicle_id = new.vehicle_id and s.status <> 'cancelled') then
      raise exception 'vehicle is already sold' using errcode = '23505';
    end if;
    select * into v_res from public.reservations r where r.vehicle_id = new.vehicle_id and r.status = 'active';
    if found then
      if v_res.customer_id <> new.customer_id then
        raise exception 'vehicle is reserved for another customer' using errcode = '23505';
      end if;
      new.reservation_id := v_res.id;
      new.inquiry_id := coalesce(new.inquiry_id, v_res.inquiry_id);
    elsif v_status in ('draft', 'archived') then
      raise exception 'only listed vehicles can be sold' using errcode = '23514';
    end if;
  else
    if new.vehicle_id <> old.vehicle_id or new.customer_id <> old.customer_id then
      raise exception 'sale vehicle/customer cannot be changed' using errcode = '42501';
    end if;
    if old.status = 'cancelled' and new.status <> 'cancelled' then
      raise exception 'a cancelled sale cannot be reopened' using errcode = '23514';
    end if;
    if new.status = 'cancelled' and old.status <> 'cancelled' then
      new.cancelled_at := now();
    end if;
    if new.status = 'completed' and old.status <> 'completed' then
      new.completed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger sales_before before insert or update on public.sales
  for each row execute function public.before_sale_write();

create or replace function public.after_sale_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.reservation_id is not null then
      update public.reservations set status = 'converted' where id = new.reservation_id;
    end if;
    perform public.sync_vehicle_status(new.vehicle_id, 'sold');
    insert into public.shipments (sale_id, customer_id) values (new.id, new.customer_id);
    if new.inquiry_id is not null then
      update public.inquiries set status = 'won' where id = new.inquiry_id;
    end if;
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.sync_vehicle_status(new.vehicle_id, 'published');
  end if;
  return new;
end;
$$;

create trigger sales_after after insert or update on public.sales
  for each row execute function public.after_sale_write();

create trigger sales_audit after insert or update on public.sales
  for each row execute function public.audit_row_change('sale');

-- -----------------------------------------------------------------------------
-- Payments: salespeople record; only admins verify or void. Never deleted.
-- Sale payment status follows the non-void payments.
-- -----------------------------------------------------------------------------
create or replace function public.guard_payment_write()
returns trigger
language plpgsql
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.recorded_by := auth.uid();
    new.status := 'recorded';
    new.verified_by := null;
    new.verified_at := null;
    if exists (select 1 from public.sales s where s.id = new.sale_id and s.status = 'cancelled') then
      raise exception 'cannot record a payment on a cancelled sale' using errcode = '23514';
    end if;
    return new;
  end if;

  if not public.is_admin() then
    raise exception 'only an admin can change a payment record' using errcode = '42501';
  end if;
  if (new.sale_id, new.customer_id, new.amount_usd, new.recorded_by, new.created_at)
     is distinct from (old.sale_id, old.customer_id, old.amount_usd, old.recorded_by, old.created_at) then
    raise exception 'payment amounts are immutable; void and re-record instead' using errcode = '42501';
  end if;
  if old.status = 'void' and new.status <> 'void' then
    raise exception 'a void payment cannot be restored' using errcode = '23514';
  end if;
  if new.status = 'verified' and old.status <> 'verified' then
    new.verified_by := auth.uid();
    new.verified_at := now();
  end if;
  if new.status = 'void' and coalesce(trim(new.void_reason), '') = '' then
    raise exception 'a reason is required to void a payment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger payments_guard before insert or update on public.payments
  for each row execute function public.guard_payment_write();

create or replace function public.refresh_sale_payment_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_paid numeric;
  v_total numeric;
  v_status text;
begin
  select total_usd, status into v_total, v_status from public.sales where id = new.sale_id;
  if v_status not in ('awaiting_payment', 'partially_paid', 'paid') then
    return new;
  end if;
  select coalesce(sum(amount_usd), 0) into v_paid
    from public.payments where sale_id = new.sale_id and status <> 'void';
  update public.sales
     set status = case
       when v_paid >= v_total then 'paid'
       when v_paid > 0 then 'partially_paid'
       else 'awaiting_payment' end
   where id = new.sale_id;
  return new;
end;
$$;

create trigger payments_refresh_sale after insert or update on public.payments
  for each row execute function public.refresh_sale_payment_status();

create trigger payments_audit after insert or update on public.payments
  for each row execute function public.audit_row_change('payment');

-- -----------------------------------------------------------------------------
-- Shipping: every status change becomes a timestamped event.
-- -----------------------------------------------------------------------------
create or replace function public.after_shipment_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status <> old.status then
    insert into public.shipment_events (shipment_id, customer_id, status, note, created_by)
    values (new.id, new.customer_id, new.status, nullif(current_setting('app.shipment_note', true), ''), auth.uid());
    if new.status in ('in_transit', 'arrived') then
      update public.sales set status = 'shipping'
       where id = new.sale_id and status in ('paid', 'partially_paid', 'awaiting_payment');
    elsif new.status = 'released' then
      update public.sales set status = 'delivered' where id = new.sale_id and status <> 'cancelled';
    end if;
  end if;
  return new;
end;
$$;

create trigger shipments_after_update after update on public.shipments
  for each row execute function public.after_shipment_update();

create trigger shipments_audit after update on public.shipments
  for each row execute function public.audit_row_change('shipment');

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
create or replace function public.guard_task_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and not public.is_trusted_context() then
    new.created_by := auth.uid();
    if not public.is_admin() then
      new.assigned_to := auth.uid();
    end if;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  end if;
  if new.inquiry_id is not null and new.customer_id is null then
    select customer_id into new.customer_id from public.inquiries where id = new.inquiry_id;
  end if;
  return new;
end;
$$;

create trigger tasks_guard before insert or update on public.tasks
  for each row execute function public.guard_task_write();

-- Keep the inquiry's follow-up date in sync with its earliest open task.
create or replace function public.sync_inquiry_follow_up()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_inquiry uuid := coalesce(new.inquiry_id, old.inquiry_id);
begin
  if v_inquiry is not null then
    update public.inquiries
       set follow_up_at = (select min(t.due_at) from public.tasks t where t.inquiry_id = v_inquiry and t.status = 'open')
     where id = v_inquiry;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger tasks_follow_up after insert or update or delete on public.tasks
  for each row execute function public.sync_inquiry_follow_up();
