-- 원본 악보 사진 (Supabase SQL Editor에서 실행)
-- 버킷은 대시보드 Storage에서 생성: 이름 `sheets`, ★비공개(Public 체크 안 함)★

-- 곡에 원본 악보 저장 경로 목록 추가 (이미 실행했다면 무해)
alter table public.songs add column if not exists image_urls text[] not null default '{}';

-- 기존 공개 정책 제거 후 팀 멤버 전용으로 교체
drop policy if exists "sheets_upload" on storage.objects;
drop policy if exists "sheets_read" on storage.objects;

-- 경로가 "팀ID/곡ID/파일명" 이므로 첫 폴더 = 팀ID → 그 팀 멤버만 접근
create policy "sheets_upload_team" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sheets'
    and public.is_team_member(((storage.foldername(name))[1])::uuid)
  );

create policy "sheets_read_team" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sheets'
    and public.is_team_member(((storage.foldername(name))[1])::uuid)
  );
