import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Expo Go(SDK 53+)는 원격 푸시 미지원 — import 자체가 던지므로 지연 로딩 + 감지 스킵
const isExpoGo = Constants.executionEnvironment === 'storeClient';

type NotificationsModule = typeof import('expo-notifications');
let cached: NotificationsModule | null = null;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo || !Device.isDevice) return null;
  if (cached) return cached;
  try {
    const mod = await import('expo-notifications');
    // 포그라운드에서도 알림 표시
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
    return mod;
  } catch (e) {
    console.log('[push] 알림 모듈 사용 불가:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** 이 기기의 푸시 토큰을 발급받아 DB에 등록. 미지원 환경(Expo Go 등)은 조용히 스킵 */
export async function registerPushToken(): Promise<void> {
  if (!supabase) return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '콘티 알림',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    await supabase.from('push_tokens').upsert({
      token,
      user_id: userId,
      updated_at: new Date().toISOString(),
    });
    console.log('[push] 토큰 등록 완료');
  } catch (e) {
    console.log('[push] 토큰 등록 스킵:', e instanceof Error ? e.message : e);
  }
}

/** 팀 멤버들(나 제외)에게 푸시 발송 — Expo Push API 직접 호출이라 어디서든 동작 */
export async function notifyTeamMembers(
  memberIds: string[],
  title: string,
  body: string,
): Promise<void> {
  if (!supabase || memberIds.length === 0) return;
  try {
    const { data: me } = await supabase.auth.getUser();
    const targets = memberIds.filter((id) => id !== me.user?.id);
    if (targets.length === 0) return;

    const { data: rows, error } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', targets);
    if (error || !rows?.length) return;

    const messages = rows.map((r) => ({
      to: r.token,
      title,
      body,
      sound: 'default',
      channelId: 'default',
    }));

    // Expo Push API는 100개 단위 배치
    for (let i = 0; i < messages.length; i += 100) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
    }
    console.log(`[push] ${messages.length}개 기기로 알림 발송`);
  } catch (e) {
    console.warn('[push] 발송 실패:', e instanceof Error ? e.message : e);
  }
}
