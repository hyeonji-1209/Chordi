import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, F } from '@/constants/theme';

/**
 * 생체인증 잠금 화면.
 * 갤럭시: 지문/얼굴, 아이폰: Face ID — 기기에 등록된 방식을 그대로 사용.
 * 생체인증 미등록 기기는 기기 잠금(PIN 등)으로 폴백, 그것도 없으면 통과.
 */
export function BiometricLock({ onUnlock }: { onUnlock: () => void }) {
  const [failed, setFailed] = useState(false);

  /** 인증 시도. 통과/생체인증 불가 기기면 true, 실패·취소면 false */
  const runAuth = useCallback(async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      onUnlock(); // 생체인증을 쓸 수 없는 기기는 잠그지 않음
      return true;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Chordi 잠금 해제',
      cancelLabel: '취소',
    });
    if (result.success) onUnlock();
    return result.success;
  }, [onUnlock]);

  const tryAuth = useCallback(() => {
    runAuth().then((ok) => setFailed(!ok));
  }, [runAuth]);

  useEffect(() => {
    tryAuth();
  }, [tryAuth]);

  return (
    <View style={st.root}>
      <Text style={{ fontSize: 26, color: C.goldDark }}>✦</Text>
      <Text style={st.title}>Chordi</Text>
      {failed && (
        <Pressable
          style={({ pressed }) => [st.btn, pressed && { backgroundColor: C.primaryDark }]}
          onPress={() => {
            setFailed(false);
            tryAuth();
          }}
        >
          <Text style={st.btnLabel}>잠금 해제</Text>
        </Pressable>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  title: { fontFamily: F.serif, fontSize: 32, color: C.ink },
  btn: {
    marginTop: 20,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 13,
  },
  btnLabel: { fontFamily: F.sansBold, fontSize: 14.5, color: '#fff' },
});
