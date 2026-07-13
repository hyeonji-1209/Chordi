-- Chordi DB 스키마 (Supabase SQL Editor에 붙여넣어 실행)
-- 팀(=예배) / 멤버 / 곡 / 콘티 + RLS 권한: 팀 멤버만 조회, 올린 사람만 수정·삭제

-- ── 프로필 (구글/카카오 로그인 사용자) ──
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '이름 없음'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 팀 (팀 이름 = 예배명) ──
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#3E4C8E',
  invite_code text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roles text not null default '멤버',
  is_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ── 곡 ──
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,
  original_key text not null,
  bpm int,
  tags text[] not null default '{}',
  source text not null default 'image',
  source_label text not null default '',
  form jsonb not null default '[]',      -- FormChip[]
  sections jsonb not null default '[]',  -- ChartSection[]
  abc text,                              -- 오선보 ABC (원키 기준)
  memo text,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 콘티 ──
create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  title text not null,           -- "7월 17일 목요예배 찬양팀"
  subtitle text not null default '',
  leader text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (team_id, title)        -- 같은 예배의 콘티는 하나
);

create table public.setlist_items (
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position int not null,
  key text not null,
  note text,
  sub_note text,
  linked_to_prev boolean not null default false,
  primary key (setlist_id, song_id)
);

-- ── 헬퍼: 내가 팀 멤버인지 ──
create or replace function public.is_team_member(tid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.team_members
    where team_id = tid and user_id = auth.uid()
  );
$$;

-- ── RLS ──
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.songs enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_items enable row level security;

-- 프로필: 로그인 사용자 누구나 조회(멤버 이름 표시용), 본인만 수정
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated using (user_id = auth.uid());

-- 팀: 멤버만 조회, 로그인 사용자 생성 가능, 리더만 수정
create policy "teams_select" on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy "teams_insert" on public.teams for insert to authenticated
  with check (created_by = auth.uid());
create policy "teams_update" on public.teams for update to authenticated
  using (exists (select 1 from public.team_members
                 where team_id = id and user_id = auth.uid() and is_leader));

-- 팀 멤버: 같은 팀 멤버 조회, 본인 행만 추가/삭제 (가입은 join_team_by_code 함수로)
create policy "members_select" on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy "members_insert_self" on public.team_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "members_delete_self" on public.team_members for delete to authenticated
  using (user_id = auth.uid());

-- 곡: 팀 멤버 조회/추가, **올린 사람만** 수정·삭제
create policy "songs_select" on public.songs for select to authenticated
  using (public.is_team_member(team_id));
create policy "songs_insert" on public.songs for insert to authenticated
  with check (public.is_team_member(team_id) and uploaded_by = auth.uid());
create policy "songs_update" on public.songs for update to authenticated
  using (uploaded_by = auth.uid());
create policy "songs_delete" on public.songs for delete to authenticated
  using (uploaded_by = auth.uid());

-- 콘티: 팀 멤버 조회/추가, **만든 사람만** 수정·삭제
create policy "setlists_select" on public.setlists for select to authenticated
  using (public.is_team_member(team_id));
create policy "setlists_insert" on public.setlists for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = auth.uid());
create policy "setlists_update" on public.setlists for update to authenticated
  using (created_by = auth.uid());
create policy "setlists_delete" on public.setlists for delete to authenticated
  using (created_by = auth.uid());

-- 콘티 곡목: 부모 콘티 권한을 따름
create policy "items_select" on public.setlist_items for select to authenticated
  using (exists (select 1 from public.setlists sl
                 where sl.id = setlist_id and public.is_team_member(sl.team_id)));
create policy "items_write" on public.setlist_items for all to authenticated
  using (exists (select 1 from public.setlists sl
                 where sl.id = setlist_id and sl.created_by = auth.uid()))
  with check (exists (select 1 from public.setlists sl
                      where sl.id = setlist_id and sl.created_by = auth.uid()));

-- ── 초대코드로 팀 가입 (RLS 우회가 필요해서 함수로) ──
create or replace function public.join_team_by_code(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  select id into tid from public.teams where invite_code = upper(code);
  if tid is null then
    raise exception '초대코드가 올바르지 않아요';
  end if;
  insert into public.team_members (team_id, user_id, roles)
  values (tid, auth.uid(), '멤버')
  on conflict do nothing;
  return tid;
end $$;

-- ── 팀 생성 + 본인을 리더로 (한 번에) ──
create or replace function public.create_team(team_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  tid uuid;
  code text;
begin
  code := upper(substr(md5(random()::text), 1, 4));
  insert into public.teams (name, invite_code, created_by)
  values (team_name, code, auth.uid())
  returning id into tid;
  insert into public.team_members (team_id, user_id, roles, is_leader)
  values (tid, auth.uid(), '인도자', true);
  return tid;
end $$;
