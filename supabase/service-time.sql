-- 팀(예배) 요일·시간 설정 (Supabase SQL Editor에서 실행)

alter table public.teams
  add column if not exists service_day int,     -- 0=일요일 … 6=토요일
  add column if not exists service_time text;   -- "19:30" 등 (선택)

-- create_team을 요일/시간 받는 버전으로 교체 (기존 1-인자 버전은 제거해 중복 방지)
drop function if exists public.create_team(text);

create or replace function public.create_team(
  team_name text,
  p_service_day int default null,
  p_service_time text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  tid uuid;
  code text;
begin
  code := upper(substr(md5(random()::text), 1, 4));
  insert into public.teams (name, invite_code, created_by, service_day, service_time)
  values (team_name, code, auth.uid(), p_service_day, p_service_time)
  returning id into tid;
  insert into public.team_members (team_id, user_id, roles, is_leader)
  values (tid, auth.uid(), '인도자', true);
  return tid;
end $$;
