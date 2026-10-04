-- Level Up Athletics — PIN security hardening.
--
-- Background: a paired kid device runs on the PARENT's own session (that's
-- how Home Screen pairing works), so the approval PIN is the only thing
-- standing between a kid and parent-only actions (awarding XP, claiming
-- rewards, approving combine tests, team setup...). Testing the existing
-- setup against a replica of this database found four ways around it:
--
--   A. set_approval_pin() overwrote an existing PIN without knowing the old
--      one. (0006 added "change requires the old PIN" but set_approval_pin
--      itself never refused to replace one.)
--   B. profiles has a self-UPDATE policy and nothing stopped the client
--      writing approval_pin_hash directly.
--   C. The column-level REVOKEs in 0006 (select approval_pin_hash) and 0014
--      (insert/update coach_approved) did nothing: in Postgres a column
--      REVOKE cannot undo a table-wide GRANT, and Supabase grants every
--      public table to anon/authenticated by default. The hash was readable
--      and coach_approved / is_coach were self-editable.
--   D. No limit on wrong guesses, so a 4-digit PIN fell in seconds.
--
-- Part 1 fixes B and C, part 2 fixes A, part 3 fixes D.

-- ====================================================================
-- 1. profiles: table-level privileges instead of (ineffective) column revokes
-- ====================================================================
-- The client only ever reads PROFILE_COLUMNS and inserts its own row at
-- sign-up (data.js fetchProfile/createProfile); it never UPDATEs profiles.
-- Every PIN write goes through the SECURITY DEFINER functions below, which
-- run as the table owner and are unaffected by this.
-- NOTE for future migrations: any NEW profiles column the client must read
-- needs its own `grant select (col)` — nothing is granted by default now.
revoke all on profiles from anon;
revoke all on profiles from authenticated;
grant select (id, display_name, is_parent, is_coach, coach_approved, created_at) on profiles to authenticated;
grant insert (id, display_name, is_parent, is_coach) on profiles to authenticated;
-- With no UPDATE privilege the policy can never apply; drop it so nobody
-- re-grants UPDATE later and silently re-opens the hole.
drop policy if exists profiles_self_update on profiles;

-- ====================================================================
-- 2. set_approval_pin: first-time setup only
-- ====================================================================
create or replace function set_approval_pin(p_pin text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_pin !~ '^[0-9]{4,6}$' then raise exception 'PIN must be 4-6 digits'; end if;
  if exists (select 1 from profiles where id = auth.uid() and approval_pin_hash is not null) then
    raise exception 'PIN already set — use Change PIN';
  end if;
  update profiles set approval_pin_hash = crypt(p_pin, gen_salt('bf')) where id = auth.uid();
end $$;

-- ====================================================================
-- 3. Guess limiting: attempt_approval_pin() + short-lived approval token
-- ====================================================================
-- Why a token instead of just counting failures inside verify_approval_pin:
-- every gated function does `if not verify_approval_pin(p_pin) then raise
-- exception`, and a raised exception rolls back everything the function did
-- — including any failed-attempt counter it had just bumped. A counter kept
-- there would never persist, so guesses made through the gated functions
-- would be unlimited. Instead:
--   * attempt_approval_pin(pin) is the ONLY place a real PIN is ever
--     compared. It never raises on a wrong PIN, so its bookkeeping commits.
--     5 wrong guesses lock approvals for 15 minutes.
--   * On success it returns a random single-person token valid for 3
--     minutes. The client passes that token in the existing p_pin argument
--     of every gated function, and verify_approval_pin() now checks the
--     token (128 bits, unguessable) instead of a PIN. So gated functions
--     can no longer be used to guess the PIN at all, and nobody watching a
--     parent approve something can reuse anything but a 3-minute token they
--     never saw.
create table if not exists pin_attempts (
  profile_id uuid primary key references profiles(id) on delete cascade,
  failed_attempts int not null default 0,
  last_failed_at timestamptz,
  locked_until timestamptz,
  grant_token text,
  grant_until timestamptz
);
alter table pin_attempts enable row level security;
-- No policies and no grants for API roles: only the SECURITY DEFINER
-- functions below touch this table (same pattern as team_challenges).
revoke all on pin_attempts from anon, authenticated;

create or replace function attempt_approval_pin(p_pin text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_row pin_attempts%rowtype;
  v_fails int;
  v_max_attempts constant int := 5;
  v_lock constant interval := interval '15 minutes';
  v_grant constant interval := interval '3 minutes';
  v_decay constant interval := interval '1 hour';
  v_token text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select approval_pin_hash into v_hash from profiles where id = v_uid;
  if v_hash is null then return jsonb_build_object('ok', false, 'no_pin', true); end if;

  insert into pin_attempts(profile_id) values (v_uid) on conflict (profile_id) do nothing;
  -- Row lock serializes concurrent attempts, so a burst of parallel guesses
  -- can't all read the same low counter and slip past the limit.
  select * into v_row from pin_attempts where profile_id = v_uid for update;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked', true,
      'retry_after_seconds', ceil(extract(epoch from (v_row.locked_until - now())))::int);
  end if;

  if p_pin is not null and p_pin ~ '^[0-9]{4,6}$' and v_hash = crypt(p_pin, v_hash) then
    v_token := gen_random_uuid()::text;
    update pin_attempts
       set failed_attempts = 0, last_failed_at = null, locked_until = null,
           grant_token = v_token, grant_until = now() + v_grant
     where profile_id = v_uid;
    return jsonb_build_object('ok', true, 'token', v_token);
  end if;

  -- Wrong (or malformed) PIN. Old failures decay so a few honest typos
  -- spread over weeks never add up to a lockout.
  v_fails := case when v_row.last_failed_at is null or v_row.last_failed_at < now() - v_decay
                  then 1 else v_row.failed_attempts + 1 end;
  if v_fails >= v_max_attempts then
    update pin_attempts
       set failed_attempts = 0, last_failed_at = now(), locked_until = now() + v_lock,
           grant_token = null, grant_until = null
     where profile_id = v_uid;
    return jsonb_build_object('ok', false, 'locked', true,
      'retry_after_seconds', extract(epoch from v_lock)::int);
  end if;
  -- A wrong guess also revokes any live approval token.
  update pin_attempts
     set failed_attempts = v_fails, last_failed_at = now(),
         grant_token = null, grant_until = null
   where profile_id = v_uid;
  return jsonb_build_object('ok', false, 'attempts_left', v_max_attempts - v_fails);
end $$;

revoke all on function attempt_approval_pin(text) from public, anon;
grant execute on function attempt_approval_pin(text) to authenticated;

-- Now validates the approval TOKEN from attempt_approval_pin() (passed in
-- the unchanged p_pin argument), not a PIN. Every gated function already
-- calls this as its first line, so none of them needed to change.
create or replace function verify_approval_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare v_token text; v_until timestamptz; v_locked timestamptz;
begin
  if auth.uid() is null or p_pin is null then return false; end if;
  select grant_token, grant_until, locked_until into v_token, v_until, v_locked
    from pin_attempts where profile_id = auth.uid();
  if v_token is null or v_until is null or v_until <= now() then return false; end if;
  if v_locked is not null and v_locked > now() then return false; end if;
  return v_token = p_pin;
end $$;

-- Changing a PIN requires a fresh approval token for the OLD pin (the
-- client now obtains it via attempt_approval_pin first). Same function as
-- 0006 plus: the live token is revoked once the PIN changes.
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
  update pin_attempts set grant_token = null, grant_until = null where profile_id = auth.uid();
end $$;

-- ====================================================================
-- Operational note: forgotten PIN
-- ====================================================================
-- set_approval_pin() is now first-time-only (part 2), so a parent who
-- forgets their PIN has no in-app way to replace it. There is no UI for
-- recovery yet; until there is, an admin can clear it from the SQL editor
-- and the parent then creates a new one in Settings:
--
--   update profiles set approval_pin_hash = null
--     where id = (select id from auth.users where email = 'parent@example.com');
--   delete from pin_attempts
--     where profile_id = (select id from auth.users where email = 'parent@example.com');
