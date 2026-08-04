-- Level Up Athletics — replace URL-embedded device tokens with a pairing code.
--
-- The original design (0015_device_tokens.sql) baked a long-lived token
-- into the URL a parent added to a Home Screen icon, relying on iOS
-- capturing that exact URL at "Add to Home Screen" time. In practice this
-- was too fragile to trust across many families' devices — there's real
-- evidence iOS doesn't reliably honor a client-side URL update
-- (history.replaceState) for that purpose, so the token could silently
-- fail to make it into the icon's launch URL with no clear symptom.
--
-- New design: a short, human-typeable pairing code (like pairing a smart
-- TV). The parent adds the plain site to the Home Screen — no special
-- link, nothing that can be "captured wrong." On first launch the icon
-- shows a code-entry field; the parent types the code shown on their own
-- device, once. From then on the icon has its own normal, persistent
-- Supabase session — the same mechanism any browser tab relies on — so
-- there's nothing further for our own code to get wrong on an ongoing
-- basis. device_tokens is now just a labeled, revocable record of that
-- pairing, kept alive by touch_device_token() (below), called
-- periodically by the already-signed-in device using its own normal
-- session — no separate long-lived secret needs to be stored client-side
-- at all.
alter table device_tokens drop column if exists token_hash;
alter table device_tokens add column if not exists pairing_code text;
alter table device_tokens add column if not exists pairing_code_expires_at timestamptz;
create unique index if not exists device_tokens_pairing_code_idx
  on device_tokens(pairing_code) where pairing_code is not null;

-- Called periodically by an already-paired, already-signed-in device
-- (using its own ordinary session — no separate device secret needed) to
-- keep its device_tokens row's expiry sliding forward while actively
-- used. If the row has been revoked (or the id is wrong), this raises —
-- the client responds to that by signing the device out locally, which is
-- what actually gives "Remove this device" real, near-immediate effect.
create or replace function touch_device_token(p_device_token_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update device_tokens set last_used_at = now(), expires_at = now() + interval '90 days'
    where id = p_device_token_id and user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'device not recognized or revoked'; end if;
end $$;

revoke all on function touch_device_token(uuid) from public;
grant execute on function touch_device_token(uuid) to authenticated;
