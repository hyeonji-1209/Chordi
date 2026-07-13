-- 원본 악보 사진 (Supabase SQL Editor에서 실행)

-- 곡에 원본 악보 이미지 URL 목록 추가
alter table public.songs add column if not exists image_urls text[] not null default '{}';

-- 악보 사진 저장용 공개 버킷
insert into storage.buckets (id, name, public)
values ('sheets', 'sheets', true)
on conflict (id) do nothing;

-- 로그인 사용자는 업로드 가능, 읽기는 공개(public 버킷)
create policy "sheets_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sheets');

create policy "sheets_read" on storage.objects
  for select
  using (bucket_id = 'sheets');
