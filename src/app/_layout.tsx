import {
  GowunBatang_400Regular,
  GowunBatang_700Bold,
} from '@expo-google-fonts/gowun-batang';
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_700Bold,
} from '@expo-google-fonts/noto-sans-kr';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { LoginScreen } from '@/components/LoginScreen';
import { C } from '@/constants/theme';
import { handleAuthUrl } from '@/lib/auth';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    GowunBatang_400Regular,
    GowunBatang_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_700Bold,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabaseEnabled);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    // Expo Go: 인증 리다이렉트가 앱 리로드로 이어지므로 딥링크에서 세션 복구
    Linking.getInitialURL().then(handleAuthUrl);
    const linkSub = Linking.addEventListener('url', (e) => handleAuthUrl(e.url));

    return () => {
      sub.subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  // 로그인되면 서버 데이터로 동기화
  useEffect(() => {
    if (session) {
      useStore.getState().setCurrentUser(session.user.id);
      useStore.getState().initFromServer();
    }
  }, [session]);

  useEffect(() => {
    if (loaded && authReady) SplashScreen.hideAsync();
  }, [loaded, authReady]);

  if (!loaded || !authReady) return null;

  // Supabase 연결 시 로그인 필수 (미설정이면 기존 로컬 모드)
  if (supabaseEnabled && !session) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="ai-input" />
        <Stack.Screen name="ai-review" />
        <Stack.Screen name="setlist/[id]" />
        <Stack.Screen name="sheet/[setlistId]/[songId]" />
      </Stack>
    </>
  );
}
