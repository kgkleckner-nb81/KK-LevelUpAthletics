-- Level Up Athletics — Storage bucket for generated avatar face-layer images.
--
-- Public-read bucket: the generate-avatar-face Edge Function (service-role
-- client, bypasses RLS) is the only writer. Public read means the Player
-- Card can just <img src> the stored URL directly, no signed-URL dance —
-- fine here since these are stylized/cartoon renders, not raw selfies, and
-- the URL itself is an unguessable storage path, not enumerable.
insert into storage.buckets (id, name, public)
values ('avatar-faces', 'avatar-faces', true)
on conflict (id) do nothing;
