-- 플랜 + AI 사용량 한도 (Supabase SQL Editor에서 실행)
--
-- 플랜별 월 AI 콘티 생성 한도 (교회 전체 합산):
--   free     4회  (기본) — 단, 가입 첫 달은 20회 웰컴 부스트
--   starter  20회 (월 19,000원)
--   standard 60회 (월 49,000원)
--   church   무제한 (월 99,000원)
-- 플랜 변경(추후 RevenueCat 연동 전 수동):
--   update churches set plan = 'standard' where name = '은혜중앙교회';

alter table churches add column if not exists plan text not null default 'free';

create table if not exists ai_usage (
  scope_id uuid not null, -- church_id (교회 없는 팀은 team_id)
  ym text not null,       -- '2026-07'
  count int not null default 0,
  primary key (scope_id, ym)
);
alter table ai_usage enable row level security; -- 직접 접근 차단 (RPC로만)

-- AI 생성 1회 사용 (p_dry_run=true면 차감 없이 잔여만 확인)
create or replace function use_ai_credit(p_team_id uuid, p_dry_run boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_church uuid;
  v_plan text := 'free';
  v_scope uuid;
  v_ym text := to_char(now(), 'YYYY-MM');
  v_limit int;
  v_count int := 0;
  v_created timestamptz;
  v_boost boolean := false;
begin
  if not exists (
    select 1 from team_members where team_id = p_team_id and user_id = auth.uid()
  ) then
    raise exception '팀 멤버가 아니에요';
  end if;

  select church_id into v_church from teams where id = p_team_id;
  if v_church is not null then
    select coalesce(plan, 'free') into v_plan from churches where id = v_church;
    v_scope := v_church;
  else
    v_scope := p_team_id;
  end if;

  v_limit := case v_plan
    when 'starter' then 20
    when 'standard' then 60
    when 'church' then 100000
    else 4
  end;

  -- 무료 플랜 첫 달 웰컴 부스트: 가입한 달에는 20회
  if v_plan = 'free' then
    if v_church is not null then
      select created_at into v_created from churches where id = v_church;
    else
      select created_at into v_created from teams where id = p_team_id;
    end if;
    if v_created is not null and to_char(v_created, 'YYYY-MM') = v_ym then
      v_limit := 20;
      v_boost := true;
    end if;
  end if;

  select au.count into v_count from ai_usage au
    where au.scope_id = v_scope and au.ym = v_ym;
  v_count := coalesce(v_count, 0);

  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'used', v_count, 'limit', v_limit, 'plan', v_plan, 'boost', v_boost);
  end if;

  if not p_dry_run then
    insert into ai_usage (scope_id, ym, count) values (v_scope, v_ym, 1)
      on conflict (scope_id, ym) do update set count = ai_usage.count + 1;
    v_count := v_count + 1;
  end if;

  return jsonb_build_object('ok', true, 'used', v_count, 'limit', v_limit, 'plan', v_plan, 'boost', v_boost);
end
$$;

grant execute on function use_ai_credit(uuid, boolean) to authenticated;
