-- Level Up Athletics — player-card nickname.
--
-- A short display name for the card, separate from the athlete's real
-- display_name (which still shows underneath the nickname on the card).
-- Frictionless, same as age — not a PIN-gated field.
alter table athletes add column if not exists nickname text;
