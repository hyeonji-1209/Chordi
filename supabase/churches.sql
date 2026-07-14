-- 교회 → 예배(팀) 구조 (Supabase SQL Editor에서 실행)
-- 주보 사진을 찍으면 예배별 팀이 일괄 생성된다.

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.teams
  add column if not exists church_id uuid references public.churches(id) on delete set null;

alter table public.churches enable row level security;

-- 그 교회의 어느 팀이라도 속해 있으면 교회 정보 조회 가능
create policy "churches_select" on public.churches for select to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.church_id = id and public.is_team_member(t.id)
    )
  );

-- 주보 파싱 결과로 교회 + 예배별 팀 일괄 생성 (등록자는 모든 팀의 관리자로 합류)
-- services 예: [{"name":"주일예배 1부","day":0,"time":"07:00"}, {"name":"수요예배","day":3,"time":"19:30"}]
create or replace function public.create_church_with_teams(church_name text, services jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  s jsonb;
  tid uuid;
  code text;
begin
  if jsonb_array_length(services) = 0 then
    raise exception '예배 목록이 비어있어요';
  end if;

  insert into public.churches (name, created_by)
  values (church_name, auth.uid())
  returning id into cid;

  for s in select * from jsonb_array_elements(services) loop
    code := upper(substr(md5(random()::text), 1, 4));
    insert into public.teams (name, invite_code, created_by, service_day, service_time, church_id)
    values (
      s->>'name',
      code,
      auth.uid(),
      nullif(s->>'day', '')::int,
      nullif(s->>'time', ''),
      cid
    )
    returning id into tid;

    insert into public.team_members (team_id, user_id, roles, is_leader)
    values (tid, auth.uid(), '관리자', true);
  end loop;

  return cid;
end $$;
