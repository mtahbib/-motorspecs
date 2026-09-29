-- =============================================================================
-- Remote procedures for multi-step operations.
-- SECURITY INVOKER unless the operation must touch rows the caller cannot see
-- directly; definer functions re-check the caller's rights explicitly.
-- =============================================================================

-- Customer: open an inquiry (optionally with a price offer). If an open
-- conversation about the same vehicle exists, the message is added to it.
create or replace function public.create_inquiry(
  p_vehicle_id uuid,
  p_subject text,
  p_message text,
  p_offer_amount numeric default null,
  p_destination_port text default null
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_customer uuid := public.current_customer_id();
  v_id uuid;
begin
  if v_customer is null then
    raise exception 'only signed-in customers can send inquiries' using errcode = '42501';
  end if;
  if p_vehicle_id is not null and not public.vehicle_visible_to_me(p_vehicle_id) then
    raise exception 'vehicle not found' using errcode = '23503';
  end if;
  if (select count(*) from public.inquiries i
      where i.customer_id = v_customer and i.created_at > now() - interval '1 day') >= 20 then
    raise exception 'daily inquiry limit reached, please contact us directly' using errcode = '54000';
  end if;

  select i.id into v_id from public.inquiries i
   where i.customer_id = v_customer
     and i.vehicle_id is not distinct from p_vehicle_id
     and i.status not in ('won', 'lost', 'closed')
   order by i.created_at desc
   limit 1;

  if v_id is null then
    insert into public.inquiries (customer_id, vehicle_id, kind, subject, destination_port)
    values (
      v_customer, p_vehicle_id,
      case when p_offer_amount is null then 'inquiry' else 'offer' end,
      left(coalesce(nullif(trim(p_subject), ''), 'Vehicle inquiry'), 200),
      nullif(trim(p_destination_port), '')
    )
    returning id into v_id;
  end if;

  insert into public.messages (inquiry_id, customer_id, sender_role, body)
  values (v_id, v_customer, 'customer', p_message);

  if p_offer_amount is not null then
    insert into public.offers (inquiry_id, customer_id, vehicle_id, kind, amount_usd, destination_port)
    values (v_id, v_customer, p_vehicle_id, 'customer_offer', p_offer_amount, nullif(trim(p_destination_port), ''));
  end if;

  return v_id;
end;
$$;

-- Customer: accept or decline a quotation / counter offer addressed to them.
create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  o public.offers%rowtype;
  v_status text := case when p_accept then 'accepted' else 'declined' end;
begin
  select * into o from public.offers where id = p_offer_id for update;
  if not found or o.customer_id is distinct from public.current_customer_id() then
    raise exception 'offer not found' using errcode = '42501';
  end if;
  if o.kind = 'customer_offer' then
    raise exception 'you cannot respond to your own offer' using errcode = '42501';
  end if;
  if o.status <> 'pending' then
    raise exception 'this offer is no longer open' using errcode = '23514';
  end if;
  if o.valid_until is not null and o.valid_until < current_date then
    update public.offers set status = 'expired' where id = o.id;
    return 'expired';
  end if;

  update public.offers
     set status = v_status, responded_at = now(), responded_by = auth.uid()
   where id = o.id;

  insert into public.messages (inquiry_id, customer_id, sender_id, sender_role, body)
  values (
    o.inquiry_id, o.customer_id, auth.uid(), 'system',
    format('Customer %s the %s of USD %s (%s).',
      v_status, replace(o.kind, '_', ' '), to_char(o.amount_usd, 'FM999,999,990.00'), o.incoterm)
  );
  return v_status;
end;
$$;

-- Staff: issue a one-time code that lets the customer link their login to this
-- existing record. Returns the plain code once; only its hash is stored.
create or replace function public.create_customer_invite(p_customer_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  c public.customers%rowtype;
  v_code text;
begin
  if not public.can_access_customer(p_customer_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into c from public.customers where id = p_customer_id;
  if c.auth_user_id is not null then
    raise exception 'this customer already has a portal login' using errcode = '23514';
  end if;
  if c.status = 'merged' then
    raise exception 'this record was merged into another customer' using errcode = '23514';
  end if;

  update public.customer_invites set revoked_at = now()
   where customer_id = p_customer_id and used_at is null and revoked_at is null;

  v_code := upper(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4) || '-' ||
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)
  );

  insert into public.customer_invites (customer_id, code_hash, code_hint, created_by)
  values (p_customer_id, encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), right(v_code, 4), auth.uid());

  perform public.log_activity('invite_created', 'customer', p_customer_id::text, p_customer_id,
    'Portal link code issued (ends ' || right(v_code, 4) || ')');
  return v_code;
end;
$$;

-- Customer: claim a staff-created record with a one-time code.
-- Returns {ok, customer_id} or {ok:false, error}. Failures are logged and
-- throttled (5 per hour per login). Matching email/phone alone never links.
create or replace function public.redeem_customer_invite(p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text := encode(sha256(convert_to(upper(trim(coalesce(p_code, ''))), 'UTF8')), 'hex');
  inv public.customer_invites%rowtype;
  v_target public.customers%rowtype;
  v_current uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_signed_in');
  end if;
  if public.current_app_role() is distinct from 'customer' then
    return jsonb_build_object('ok', false, 'error', 'not_a_customer');
  end if;
  if (select count(*) from public.activity_log a
      where a.actor_id = auth.uid() and a.action = 'invite_redeem_failed'
        and a.occurred_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select * into inv from public.customer_invites where code_hash = v_hash for update;
  if not found or inv.used_at is not null or inv.revoked_at is not null or inv.expires_at < now() then
    perform public.log_activity('invite_redeem_failed', 'customer_invite', null, null, 'Invalid or expired link code');
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  select * into v_target from public.customers where id = inv.customer_id for update;
  if v_target.auth_user_id is not null or v_target.status = 'merged' then
    return jsonb_build_object('ok', false, 'error', 'already_linked');
  end if;

  v_current := public.current_customer_id();
  if v_current is not null and v_current <> v_target.id then
    if exists (select 1 from public.reservations r where r.customer_id = v_current)
       or exists (select 1 from public.sales s where s.customer_id = v_current) then
      return jsonb_build_object('ok', false, 'error', 'needs_staff_merge');
    end if;
    -- Carry the self-service activity of the new login over to the master record.
    insert into public.favorites (customer_id, vehicle_id, created_at)
      select v_target.id, f.vehicle_id, f.created_at from public.favorites f where f.customer_id = v_current
      on conflict do nothing;
    delete from public.favorites where customer_id = v_current;
    update public.inquiries set customer_id = v_target.id where customer_id = v_current;
    update public.messages set customer_id = v_target.id where customer_id = v_current;
    update public.offers set customer_id = v_target.id where customer_id = v_current;
    update public.internal_notes set customer_id = v_target.id where customer_id = v_current;
    update public.tasks set customer_id = v_target.id where customer_id = v_current;
    update public.customers
       set status = 'merged', merged_into = v_target.id, auth_user_id = null
     where id = v_current;
  end if;

  update public.customers
     set auth_user_id = auth.uid(),
         email = coalesce(email, (select u.email from auth.users u where u.id = auth.uid())),
         status = case when status = 'lead' then 'active' else status end
   where id = v_target.id;

  update public.customer_invites set used_at = now(), used_by = auth.uid() where id = inv.id;

  perform public.log_activity('invite_redeemed', 'customer', v_target.id::text, v_target.id,
    'Customer linked their portal login to this record',
    jsonb_build_object('merged_from', v_current));
  return jsonb_build_object('ok', true, 'customer_id', v_target.id);
end;
$$;

-- Admin: assign/reassign a customer. History is kept in customer_assignments;
-- all inquiries, deals and documents stay attached to the customer.
create or replace function public.reassign_customer(p_customer_id uuid, p_staff_id uuid, p_reason text default null)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can assign customers' using errcode = '42501';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff_directory s where s.id = p_staff_id
  ) then
    raise exception 'unknown or inactive staff member' using errcode = '23503';
  end if;

  perform set_config('app.assignment_reason', coalesce(p_reason, ''), true);
  update public.customers set assigned_staff_id = p_staff_id where id = p_customer_id;
  if not found then
    raise exception 'customer not found' using errcode = '23503';
  end if;
  if p_staff_id is not null then
    update public.tasks set assigned_to = p_staff_id
     where customer_id = p_customer_id and status = 'open';
  end if;
  perform set_config('app.assignment_reason', '', true);
end;
$$;

-- Admin: promote an existing login to staff (they sign up first, which keeps
-- the service-role key out of the application entirely).
create or replace function public.set_staff_role(p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  v_customer uuid;
begin
  if not public.is_admin() then
    raise exception 'only an admin can manage staff' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'sales') then
    raise exception 'role must be admin or sales' using errcode = '22023';
  end if;
  select * into p from public.profiles where lower(email) = lower(trim(p_email));
  if not found then
    raise exception 'no account uses that email yet; ask them to register first' using errcode = '23503';
  end if;
  if p.is_owner and p_role <> 'admin' then
    raise exception 'the owner account cannot be demoted' using errcode = '42501';
  end if;

  update public.profiles set role = p_role, is_active = true where id = p.id;

  -- Remove the automatic customer record of a brand-new signup; if the person
  -- was a real customer before, keep the record (and its history) but unlink it.
  select c.id into v_customer from public.customers c where c.auth_user_id = p.id;
  if v_customer is not null then
    if not exists (select 1 from public.inquiries where customer_id = v_customer)
       and not exists (select 1 from public.favorites where customer_id = v_customer)
       and not exists (select 1 from public.sales where customer_id = v_customer)
       and not exists (select 1 from public.reservations where customer_id = v_customer)
       and not exists (select 1 from public.documents where customer_id = v_customer)
       and not exists (select 1 from public.customer_assignments where customer_id = v_customer) then
      delete from public.customers where id = v_customer;
    else
      update public.customers set auth_user_id = null, status = 'inactive' where id = v_customer;
    end if;
  end if;

  perform public.log_activity('staff_role_set', 'staff_user', p.id::text, null,
    format('%s set as %s', coalesce(p.display_name, p.email), p_role));
  return p.id;
end;
$$;

-- Staff: convert an active reservation into a sale in one step.
create or replace function public.convert_reservation_to_sale(
  p_reservation_id uuid,
  p_price_usd numeric,
  p_incoterm text default 'FOB',
  p_freight_usd numeric default 0,
  p_insurance_usd numeric default 0,
  p_other_usd numeric default 0,
  p_notes text default null
)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  r public.reservations%rowtype;
  v_sale uuid;
begin
  select * into r from public.reservations where id = p_reservation_id;
  if not found then
    raise exception 'reservation not found' using errcode = '42501';
  end if;
  if r.status <> 'active' then
    raise exception 'only an active reservation can be converted' using errcode = '23514';
  end if;

  insert into public.sales (vehicle_id, customer_id, reservation_id, inquiry_id, incoterm,
                            price_usd, freight_usd, insurance_usd, other_charges_usd, notes)
  values (r.vehicle_id, r.customer_id, r.id, r.inquiry_id, coalesce(p_incoterm, 'FOB'),
          p_price_usd, coalesce(p_freight_usd, 0), coalesce(p_insurance_usd, 0), coalesce(p_other_usd, 0), p_notes)
  returning id into v_sale;
  return v_sale;
end;
$$;

-- Staff: mark reservations past their hold date as expired. Safe to run from
-- a scheduled job (pg_cron on Pro, or a Vercel/GitHub cron calling the app).
create or replace function public.expire_reservations()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not (public.is_staff() or public.is_trusted_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.reservations set status = 'expired', release_reason = 'Hold period ended'
   where status = 'active' and reserved_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.create_inquiry(uuid, text, text, numeric, text) from public, anon;
revoke execute on function public.respond_to_offer(uuid, boolean) from public, anon;
revoke execute on function public.create_customer_invite(uuid) from public, anon;
revoke execute on function public.redeem_customer_invite(text) from public, anon;
revoke execute on function public.reassign_customer(uuid, uuid, text) from public, anon;
revoke execute on function public.set_staff_role(text, text) from public, anon;
revoke execute on function public.convert_reservation_to_sale(uuid, numeric, text, numeric, numeric, numeric, text) from public, anon;
revoke execute on function public.expire_reservations() from public, anon;

grant execute on function public.create_inquiry(uuid, text, text, numeric, text) to authenticated;
grant execute on function public.respond_to_offer(uuid, boolean) to authenticated;
grant execute on function public.create_customer_invite(uuid) to authenticated;
grant execute on function public.redeem_customer_invite(text) to authenticated;
grant execute on function public.reassign_customer(uuid, uuid, text) to authenticated;
grant execute on function public.set_staff_role(text, text) to authenticated;
grant execute on function public.convert_reservation_to_sale(uuid, numeric, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.expire_reservations() to authenticated;
