import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { signInWithProvider, type Provider } from '@/lib/auth';
import { C, F } from '@/constants/theme';

export function LoginScreen() {
  const [busy, setBusy] = useState<Provider | null>(null);

  const login = async (provider: Provider) => {
    setBusy(provider);
    try {
      await signInWithProvider(provider);
      // 성공 시 onAuthStateChange가 화면을 전환한다
    } catch (e) {
      Alert.alert('로그인 실패', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={st.root}>
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Text style={st.mark}>✦</Text>
        <Text style={st.title}>Chordi</Text>
        <Text style={st.subtitle}>찬양팀의 콘티, 악보, 그리고 팀</Text>
      </View>

      <View style={{ gap: 10, width: '100%' }}>
        <Pressable
          style={({ pressed }) => [st.btn, st.kakao, pressed && { opacity: 0.85 }]}
          onPress={() => login('kakao')}
          disabled={busy !== null}
        >
          {busy === 'kakao' ? (
            <ActivityIndicator size="small" color="#191919" />
          ) : (
            <Text style={[st.btnLabel, { color: '#191919' }]}>카카오로 시작하기</Text>
          )}
        </Pressable>
        <Pressable
          style={({ pressed }) => [st.btn, st.google, pressed && { opacity: 0.85 }]}
          onPress={() => login('google')}
          disabled={busy !== null}
        >
          {busy === 'google' ? (
            <ActivityIndicator size="small" color={C.ink} />
          ) : (
            <Text style={[st.btnLabel, { color: C.ink }]}>Google로 시작하기</Text>
          )}
        </Pressable>
      </View>

      <Text style={st.footer}>로그인하면 팀원들과 콘티·악보가 실시간으로 공유돼요</Text>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 48,
  },
  mark: { fontSize: 28, color: C.goldDark },
  title: { fontFamily: F.serif, fontSize: 40, color: C.ink },
  subtitle: { fontFamily: F.sans, fontSize: 14, color: C.mut },
  btn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kakao: { backgroundColor: '#FEE500' },
  google: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border },
  btnLabel: { fontFamily: F.sansBold, fontSize: 15 },
  footer: { fontFamily: F.sans, fontSize: 12, color: C.faint, textAlign: 'center' },
});
