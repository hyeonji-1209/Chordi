import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// 포그라운드에서도 알림 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 이 기기의 푸시 토큰을 발급받아 DB에 등록. Expo Go 등 미지원 환경에서는 조용히 스킵 */
export async function registerPushToken(): Promise<void> {
  if (!supabase || !Device.isDevice) return;
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
    // Expo Go(SDK 53+)는 원격 푸시 미지원 — 개발 빌드에서만 동작
    console.log('[push] 토큰 등록 스킵:', e instanceof Error ? e.message : e);
  }
}

/** 팀 멤버들(나 제외)에게 푸시 발송 */
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
    console.log(`[push] ${messages.length}명에게 알림 발송`);
  } catch (e) {
    console.warn('[push] 발송 실패:', e instanceof Error ? e.message : e);
  }
}
