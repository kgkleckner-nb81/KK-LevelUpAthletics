-- Level Up Athletics — Feedback to Developer box (Coach/Parent Corner).
--
-- Write-only from the client's perspective: any signed-in parent/coach can
-- insert their own feedback, nobody can read it back through the API (not
-- even their own) — the developer reads submissions directly in the
-- Supabase Table Editor / SQL editor with the dashboard's own access,
-- which bypasses RLS. No admin UI needed for a single-developer project.
create table developer_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete set null,
  message text not null,
  page_context text,
  created_at timestamptz not null default now()
);

alter table developer_feedback enable row level security;

create policy developer_feedback_insert on developer_feedback for insert
  with check (profile_id = auth.uid());
-- Deliberately no select/update/delete policy for any client role.
