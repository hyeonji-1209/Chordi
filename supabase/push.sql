-- 푸시 토큰 (Supabase SQL Editor에서 실행 — schema.sql 이후 추가분)
create table public.push_tokens (
  token text primary key,          -- Expo push token
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

-- 내 토큰은 내가 등록/갱신/삭제
create policy "push_upsert_own" on public.push_tokens for insert to authenticated
  with check (user_id = auth.uid());
create policy "push_update_own" on public.push_tokens for update to authenticated
  using (user_id = auth.uid());
create policy "push_delete_own" on public.push_tokens for delete to authenticated
  using (user_id = auth.uid());

-- 같은 팀 멤버의 토큰은 조회 가능 (콘티 알림 발송용)
create policy "push_select_teammates" on public.push_tokens for select to authenticated
  using (
    exists (
      select 1
      from public.team_members mine
      join public.team_members theirs on mine.team_id = theirs.team_id
      where mine.user_id = auth.uid()
        and theirs.user_id = push_tokens.user_id
    )
  );
