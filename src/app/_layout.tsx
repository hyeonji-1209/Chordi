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
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { BiometricLock } from '@/components/BiometricLock';
import { LoginScreen } from '@/components/LoginScreen';
import { TeamOnboarding } from '@/components/TeamOnboarding';
import { C } from '@/constants/theme';
import { handleAuthUrl } from '@/lib/auth';
import { registerPushToken } from '@/lib/push';
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
  // 앱을 켰을 때 이미 로그인돼 있으면 생체인증으로 잠금 (방금 로그인한 경우는 제외)
  const [unlocked, setUnlocked] = useState(false);
  const needsBioLock = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      needsBioLock.current = !!data.session;
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

  // 로그인되면 서버 데이터로 동기화, 로그아웃하면 동기화 상태 리셋
  useEffect(() => {
    if (session) {
      useStore.getState().setCurrentUser(session.user.id);
      useStore.getState().initFromServer();
      registerPushToken(); // 콘티 알림용 (개발 빌드/정식 앱에서 동작)
    } else {
      useStore.getState().setSynced(false);
    }
  }, [session]);

  const teamCount = useStore((s) => s.teams.length);
  const synced = useStore((s) => s.synced);

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

  // 콜드 스타트에 세션이 있었으면 생체인증(지문/얼굴)으로 잠금 해제
  if (supabaseEnabled && session && needsBioLock.current && !unlocked) {
    return (
      <>
        <StatusBar style="dark" />
        <BiometricLock onUnlock={() => setUnlocked(true)} />
      </>
    );
  }

  // 첫 로그인: 소속 팀이 없으면 팀 만들기 / 초대코드 참여 온보딩
  if (supabaseEnabled && session && synced && teamCount === 0) {
    return (
      <>
        <StatusBar style="dark" />
        <TeamOnboarding />
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
