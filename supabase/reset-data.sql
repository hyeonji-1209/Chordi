-- ⚠️ 모든 앱 데이터 삭제 (테스트 초기화용 — Supabase SQL Editor에서 실행)
-- 팀을 지우면 멤버·곡·콘티·곡목이 연쇄 삭제된다 (on delete cascade).
-- 계정(로그인)과 프로필은 유지 — 앱을 열면 팀 온보딩부터 다시 시작.

delete from storage.objects where bucket_id = 'sheets'; -- 악보 사진
delete from public.push_tokens;                          -- 푸시 토큰
delete from public.teams;                                -- 팀 → 멤버/곡/콘티 연쇄 삭제

-- ── 계정까지 전부 지우려면 아래 주석을 해제 (프로필도 연쇄 삭제, 재로그인 필요) ──
-- delete from auth.users;
