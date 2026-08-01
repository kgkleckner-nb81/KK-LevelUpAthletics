-- Level Up Athletics — remove coach grades from the rating system,
-- and stop trying to replicate the rating engine server-side.
--
-- Part 1: coach grades removed. The optional per-axis 1-10 coach grade
-- (originally ~28% of each axis's rating) is gone. It was opaque to
-- parents (the Player Card never explains its own math), added a
-- per-test chore for coaches, and baked subjective judgment invisibly
-- into a number presented as objective performance. A coach's input is
-- now the explicit "Coach's Boost" bonus (award_bonus_xp) instead —
-- visible, one-off, not a hidden multiplier.
--
-- Part 2: compute_overall_rating() is dropped entirely. It was a stub
-- for a full SQL port of the client-side rating engine — on reflection,
-- unnecessary and risky: the checkpoint's "overall rating" snapshot was
-- ALREADY always computed client-side in the original app (the same
-- ratings() function that paints the Player Card), never server-side.
-- record_combine_checkpoint() now takes that client-computed value
-- directly as a parameter instead of trying to recompute it — same
-- architecture the app already had, just persisted server-side now.
-- Traded off deliberately: a technically sophisticated user could in
-- theory submit a forged rating via direct API calls to fake a tier
-- promotion. Low-stakes for a family/team app (no money or credentials
-- involved); revisit if this ever scales beyond that.
--
-- Safe to run even though none of this had shipped to the client yet
-- (Phase D hadn't wired these functions into app.js before either
-- decision was made) — no real data exists to lose.

drop function if exists update_coach_grades(uuid, jsonb, text);
drop function if exists submit_combine_test(uuid, text, text, text, jsonb, jsonb, text);
drop function if exists verify_combine_test(uuid, jsonb, text);
drop function if exists record_combine_checkpoint(uuid, uuid);
drop function if exists compute_overall_rating(uuid);

alter table combine_tests drop column if exists coach_grades;

create or replace function submit_combine_test(
  p_athlete_id uuid, p_week text, p_program_id text, p_program_name text,
  p_metrics jsonb, p_pin text
) returns table(id uuid, status text) language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_verified boolean := false;
begin
  if not exists (select 1 from athletes where athletes.id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if p_pin is not null and verify_approval_pin(p_pin) then v_verified := true; end if;
  insert into combine_tests(athlete_id, week, program_id, program_name, metrics, status, verified_by, verified_at)
  values (p_athlete_id, p_week, p_program_id, p_program_name, p_metrics,
          case when v_verified then 'verified' else 'pending' end,
          case when v_verified then auth.uid() else null end,
          case when v_verified then now() else null end)
  returning combine_tests.id into v_id;
  if v_verified then
    insert into xp_ledger(athlete_id, source, amount, note, ref_id) values (p_athlete_id, 'combine_verified', 75, p_program_name, v_id);
  end if;
  return query select v_id, case when v_verified then 'verified' else 'pending' end;
end $$;

create or replace function verify_combine_test(p_combine_test_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public as $$
declare v_athlete_id uuid; v_program_name text;
begin
  if not verify_approval_pin(p_pin) then raise exception 'incorrect PIN'; end if;
  select athlete_id, program_name into v_athlete_id, v_program_name from combine_tests
    where id = p_combine_test_id and status = 'pending'
    and athlete_id in (select id from athletes where parent_profile_id = auth.uid());
  if v_athlete_id is null then raise exception 'not authorized or test not pending'; end if;
  update combine_tests set status = 'verified', verified_by = auth.uid(), verified_at = now()
    where id = p_combine_test_id;
  insert into xp_ledger(athlete_id, source, amount, note, ref_id)
  values (v_athlete_id, 'combine_verified', 75, v_program_name, p_combine_test_id)
  on conflict (source, ref_id) do nothing;
end $$;

-- Snapshots a CLIENT-COMPUTED overall rating (see note above) against this
-- verified Combine, then tags all prior unattached attribute_points_ledger
-- rows with this checkpoint id so future completion-score queries (WHERE
-- checkpoint_id IS NULL) only see points earned since this moment. Called
-- by the client right after it refreshes state and computes ratings().overall
-- with the newly-verified test already included.
create or replace function record_combine_checkpoint(p_athlete_id uuid, p_combine_test_id uuid, p_overall_rating int)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_checkpoint_id uuid;
begin
  if not exists (select 1 from athletes where id = p_athlete_id and parent_profile_id = auth.uid()) then
    raise exception 'not authorized for this athlete';
  end if;
  if not exists (select 1 from combine_tests where id = p_combine_test_id and athlete_id = p_athlete_id and status = 'verified') then
    raise exception 'combine test not found or not verified';
  end if;
  insert into combine_checkpoints(athlete_id, combine_test_id, overall_rating)
  values (p_athlete_id, p_combine_test_id, p_overall_rating) returning id into v_checkpoint_id;
  update attribute_points_ledger set checkpoint_id = v_checkpoint_id
    where athlete_id = p_athlete_id and checkpoint_id is null;
  return v_checkpoint_id;
end $$;

revoke all on function submit_combine_test(uuid, text, text, text, jsonb, text) from public;
revoke all on function verify_combine_test(uuid, text) from public;
revoke all on function record_combine_checkpoint(uuid, uuid, int) from public;
grant execute on function submit_combine_test(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function verify_combine_test(uuid, text) to authenticated;
grant execute on function record_combine_checkpoint(uuid, uuid, int) to authenticated;
