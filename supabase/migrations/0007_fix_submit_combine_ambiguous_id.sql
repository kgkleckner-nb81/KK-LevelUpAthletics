-- Fix "column reference "id" is ambiguous" when saving a combine test.
--
-- submit_combine_test() declares `returns table(id uuid, status text)`,
-- which creates an implicit PL/pgSQL output variable named `id`. The
-- authorization check below queried `athletes` with a bare `id`, which
-- Postgres can't resolve between that output variable and athletes.id.
-- Same bug class as the earlier request_team_join/join_league fix —
-- qualify the column explicitly.

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
