import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'google' | 'kakao';

/** 구글/카카오 OAuth 로그인 (브라우저 → 딥링크 복귀 → 세션 교환) */
export async function signInWithProvider(provider: Provider): Promise<boolean> {
  if (!supabase) throw new Error('Supabase가 설정되지 않았어요 (.env 확인)');

  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('로그인 URL을 만들지 못했어요');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false; // 사용자가 취소

  const url = new URL(result.url);

  // PKCE: ?code=... → 세션 교환
  const code = url.searchParams.get('code');
  if (code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
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

  const errDesc = url.searchParams.get('error_description');
  throw new Error(errDesc ?? '로그인 응답을 해석하지 못했어요');
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
