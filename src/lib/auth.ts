import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'google' | 'kakao';

/** 구글/카카오 OAuth 로그인 (브라우저 → 딥링크 복귀 → 세션 교환) */
export async function signInWithProvider(provider: Provider): Promise<boolean> {
  if (!supabase) throw new Error('Supabase가 설정되지 않았어요 (.env 확인)');

  const redirectTo = Linking.createURL('auth-callback');
  console.log('[auth] redirectTo (Supabase Redirect URLs에 등록 필요):', redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('로그인 URL을 만들지 못했어요');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  console.log('[auth] 브라우저 결과:', result.type, 'url' in result ? result.url : '');
  if (result.type !== 'success') return false; // 사용자가 취소

  const url = new URL(result.url);

  // PKCE: ?code=... → 세션 교환
  const code = url.searchParams.get('code');
  if (code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) {
      console.log('[auth] 세션 교환 실패:', JSON.stringify(exErr));
      throw new Error(exErr.message ?? '세션 교환에 실패했어요');
    }
    return true;
  }

  // 폴백: #access_token=... (implicit)
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sErr) throw sErr;
    return true;
  }

  const errDesc =
    url.searchParams.get('error_description') ?? url.searchParams.get('error');
  console.log('[auth] 응답 해석 실패. 전체 URL:', result.url);
  throw new Error(errDesc ?? '로그인 응답을 해석하지 못했어요');
}

/**
 * 딥링크로 들어온 인증 콜백 처리.
 * Expo Go에서는 exp:// 리다이렉트가 앱을 리로드시켜 openAuthSessionAsync가
 * dismiss로 끝나므로, (재)시작 시 초기 URL과 url 이벤트에서 코드를 주워 세션을 완성한다.
 */
export async function handleAuthUrl(url: string | null | undefined): Promise<void> {
  if (!supabase || !url || !url.includes('auth-callback')) return;
  console.log('[auth] 딥링크 콜백 수신:', url);
  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code;
  if (typeof code === 'string' && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.warn('[auth] 딥링크 세션 교환 실패:', error.message);
    return;
  }
  // implicit 폴백 (#access_token=...)
  const hash = url.split('#')[1];
  if (hash) {
    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** 세션 사용자의 표시 이름 */
export function displayName(user: { user_metadata?: Record<string, unknown> } | null): string {
  const m = user?.user_metadata ?? {};
  return (
    (m.name as string) ??
    (m.full_name as string) ??
    (m.preferred_username as string) ??
    '나'
  );
}
