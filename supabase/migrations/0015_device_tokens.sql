-- Level Up Athletics — Home Screen device tokens.
--
-- Backs the installed-icon login flow: a long-lived, revocable, per-device
-- credential embedded in the URL a parent adds to their iPad's Home
-- Screen, so the icon can sign itself back in without depending on
-- Safari's isolated storage or a fresh magic-link email every time.
--
-- The raw token is generated and returned exactly once by the
-- mint-device-token Edge Function and never stored — only its hash lives
-- here, same pattern as profiles.approval_pin_hash (0006_pin_hardening.sql).
-- Rows are written exclusively by the two Edge Functions (service role,
-- bypasses RLS entirely) and by revoke_device_token() below — there is no
-- insert or update policy for `authenticated` at all, only select.
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  device_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index device_tokens_user_idx on device_tokens(user_id);

alter table device_tokens enable row level security;

-- Lets the "Your Devices" settings panel list a user's own devices via a
-- plain client-side select (same pattern as xp_ledger/quest_completions
-- etc.) — hidden/revoked rows are filtered client-side on revoked_at.
create policy device_tokens_self_select on device_tokens for select using (user_id = auth.uid());

-- token_hash is never selectable by the client, hashed or not — same
-- column-level treatment as approval_pin_hash (0006_pin_hardening.sql).
revoke select (token_hash) on device_tokens from authenticated;

-- Coach/parent-facing "Remove this device". Not PIN-gated — same tier as
-- decide_team_join()/remove_team_member(), an account-housekeeping action
-- rather than an XP/approval action. SECURITY DEFINER so it can update a
-- row despite there being no update policy for `authenticated` above.
create or replace function revoke_device_token(p_token_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update device_tokens set revoked_at = now()
    where id = p_token_id and user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'not authorized or device not found'; end if;
end $$;

revoke all on function revoke_device_token(uuid) from public;
grant execute on function revoke_device_token(uuid) to authenticated;
