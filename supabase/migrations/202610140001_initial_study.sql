create table if not exists public.study_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.study_progress enable row level security;
revoke all on public.study_progress from anon;
grant select, insert, update on public.study_progress to authenticated;

drop policy if exists "Read own study progress" on public.study_progress;
create policy "Read own study progress" on public.study_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Insert own study progress" on public.study_progress;
create policy "Insert own study progress" on public.study_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Update own study progress" on public.study_progress;
create policy "Update own study progress" on public.study_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.ai_monthly_usage (
  month_start date primary key,
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_monthly_usage enable row level security;
revoke all on public.ai_monthly_usage from anon, authenticated;

create or replace function public.reserve_ai_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  month_key date := date_trunc('month', now())::date;
  current_count integer;
begin
  if auth.uid() is null then return false; end if;
  insert into public.ai_monthly_usage(month_start, request_count)
    values (month_key, 1)
    on conflict (month_start) do update
      set request_count = public.ai_monthly_usage.request_count + 1
      where public.ai_monthly_usage.request_count < 100
    returning request_count into current_count;
  return current_count is not null;
end;
$$;

revoke all on function public.reserve_ai_request() from public, anon;
grant execute on function public.reserve_ai_request() to authenticated;
