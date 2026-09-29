-- =============================================================================
-- Authorization helpers used by RLS policies, triggers and RPCs.
--
-- All helpers are SECURITY DEFINER with an empty search_path so that they can
-- read `profiles`/`customers` without recursing into those tables' policies,
-- and cannot be hijacked by objects in other schemas.
-- =============================================================================

-- Role of the signed-in user, or null (anonymous / inactive).
create or replace function public.current_app_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

-- Staff = active admin or salesperson. When the profile has mfa_required, the
-- session must have completed authenticator-app MFA (aal2); otherwise the user
-- has no staff privileges at all, even if the UI were bypassed.
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role in ('admin', 'sales')
      and (not p.mfa_required or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role = 'admin'
      and (not p.mfa_required or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
  )
$$;

-- The customer record linked to the signed-in login (null for staff/anon).
create or replace function public.current_customer_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.customers c
  where c.auth_user_id = auth.uid() and c.status <> 'merged'
  limit 1
$$;

-- Staff access to a customer: admins see everyone; salespeople see the
-- customers currently assigned to them.
create or replace function public.can_access_customer(p_customer_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
    or (
      public.is_staff()
      and exists (
        select 1 from public.customers c
        where c.id = p_customer_id and c.assigned_staff_id = auth.uid()
      )
    )
$$;

-- Vehicles visible outside the staff workspace: listed ones, plus any vehicle
-- the signed-in customer has a relationship with (so a purchased vehicle stays
-- visible in the portal after the listing is archived).
create or replace function public.vehicle_visible_to_me(p_vehicle_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id
      and (
        v.status in ('published', 'reserved', 'sold')
        or public.is_staff()
        or exists (select 1 from public.inquiries i where i.vehicle_id = v.id and i.customer_id = public.current_customer_id())
        or exists (select 1 from public.reservations r where r.vehicle_id = v.id and r.customer_id = public.current_customer_id())
        or exists (select 1 from public.sales s where s.vehicle_id = v.id and s.customer_id = public.current_customer_id())
        or exists (select 1 from public.favorites f where f.vehicle_id = v.id and f.customer_id = public.current_customer_id())
      )
  )
$$;

-- Trusted context = migrations, seed scripts and service_role (no end-user JWT
-- role in effect). Guard triggers skip their checks in that context.
create or replace function public.is_trusted_context()
returns boolean
language sql stable
as $$
  select current_user not in ('anon', 'authenticated')
$$;

-- Parses a uuid without raising on bad input (used on storage object paths).
create or replace function public.try_uuid(p_value text)
returns uuid
language plpgsql immutable
as $$
begin
  return p_value::uuid;
exception when others then
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Activity log writer
-- -----------------------------------------------------------------------------
create or replace function public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_customer_id uuid,
  p_summary text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.activity_log (actor_id, actor_role, action, entity_type, entity_id, customer_id, summary, details)
  values (
    auth.uid(),
    coalesce(public.current_app_role(), case when auth.uid() is null then 'system' end),
    p_action, p_entity_type, p_entity_id, p_customer_id, p_summary, coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- Only callable from other definer functions/triggers; not from clients.
revoke execute on function public.log_activity(text, text, text, uuid, text, jsonb) from public, anon, authenticated;

-- Returns {column: {old, new}} for columns that changed, minus noisy ones.
create or replace function public.jsonb_diff(p_old jsonb, p_new jsonb)
returns jsonb
language sql immutable
as $$
  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', p_old -> n.key, 'new', n.value)), '{}'::jsonb)
  from jsonb_each(p_new) n
  where n.key not in ('updated_at', 'created_at', 'last_message_at')
    and (p_old -> n.key) is distinct from n.value
$$;

-- Generic audit trigger. TG_ARGV[0] = entity type label.
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_diff jsonb;
  v_customer uuid;
begin
  if tg_op = 'UPDATE' then
    v_diff := public.jsonb_diff(v_old, v_new);
    if v_diff = '{}'::jsonb then
      return new;
    end if;
  end if;

  v_customer := case
    when tg_table_name = 'customers' then (v_row ->> 'id')::uuid
    when v_row ? 'customer_id' then (v_row ->> 'customer_id')::uuid
  end;

  perform public.log_activity(
    lower(tg_op),
    tg_argv[0],
    coalesce(v_row ->> 'id', v_row ->> 'vehicle_id'),
    v_customer,
    null,
    case tg_op when 'UPDATE' then jsonb_build_object('changes', v_diff) else '{}'::jsonb end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
