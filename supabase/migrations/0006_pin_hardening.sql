-- Level Up Athletics — Phase D: PIN infrastructure hardening
--
-- profiles_self_select (0002_rls_policies.sql) is a ROW-level policy — it
-- lets a user read their own profile row, which today includes
-- approval_pin_hash. RLS has no concept of "except this column," so even
-- though the hash is bcrypt (not plaintext), a user could currently select
-- their own hash value directly. Column-level REVOKE closes that: the
-- client can never read the column at all, hashed or not, only the
-- SECURITY DEFINER functions (which run as postgres, not through this
-- grant) can touch it.
revoke select (approval_pin_hash) on profiles from authenticated;

-- Changing an existing PIN requires proving you know the old one first —
-- set_approval_pin() (0004_functions.sql) is "first time setup," not
-- "replace," so it doesn't ask.
-- search_path includes "extensions" — see the matching note on
-- set_approval_pin/verify_approval_pin in 0004_functions.sql; crypt()
-- lives there in a default Supabase project, not in public.
create or replace function change_approval_pin(p_old_pin text, p_new_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_approval_pin(p_old_pin) then
    raise exception 'incorrect current PIN';
  end if;
  if p_new_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be 4-6 digits';
  end if;
  update profiles set approval_pin_hash = crypt(p_new_pin, gen_salt('bf')) where id = auth.uid();
end $$;

revoke all on function change_approval_pin(text, text) from public;
grant execute on function change_approval_pin(text, text) to authenticated;

-- has_approval_pin(): lets the client show "set up your PIN" vs. "change
-- your PIN" without ever selecting approval_pin_hash itself.
create or replace function has_approval_pin()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  select approval_pin_hash into v_hash from profiles where id = auth.uid();
  return v_hash is not null;
end $$;

revoke all on function has_approval_pin() from public;
grant execute on function has_approval_pin() to authenticated;
