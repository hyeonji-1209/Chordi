import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BulletinSetup } from '@/components/BulletinSetup';
import { C, F } from '@/constants/theme';
import { joinTeamRemote } from '@/lib/db';
import { useStore } from '@/store/useStore';

type Mode = 'choice' | 'join' | 'bulletin';

/** 첫 로그인 온보딩: 팀 만들기 or 초대코드로 참여 */
export function TeamOnboarding() {
  const [mode, setMode] = useState<Mode>('choice');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      await joinTeamRemote(value);
      await useStore.getState().initFromServer(); // 팀이 생기면 게이트가 자동으로 열림
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류가 발생했어요';
      Alert.alert('입장 실패', msg.includes('초대코드') ? '초대코드가 올바르지 않아요' : msg);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 22, color: C.goldDark }}>✦</Text>
        <Text style={st.title}>
          {mode === 'bulletin' ? '안녕하세요, 관리자님!' : '어느 찬양팀인가요?'}
        </Text>
        <Text style={st.subtitle}>
          {mode === 'bulletin'
            ? '교회의 예배 시간이 담긴 주보를 업로드해 주세요\n예배별 찬양팀을 한 번에 만들어 드려요'
            : '팀 이름이 곧 예배예요 — 주일 1부, 목요예배, 청년부…'}
        </Text>
      </View>

      {mode === 'bulletin' ? (
        <View style={{ width: '100%', gap: 10 }}>
          <BulletinSetup onDone={() => {}} />
          <Pressable onPress={() => setMode('choice')} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.mut }}>‹ 뒤로</Text>
          </Pressable>
        </View>
      ) : mode === 'choice' ? (
        <View style={{ gap: 10, width: '100%' }}>
          <Pressable style={[st.cardBtn, { borderColor: C.primary }]} onPress={() => setMode('bulletin')}>
            <Text style={st.cardTitle}>우리 교회 등록하기</Text>
            <Text style={st.cardDesc}>관리자님이라면 — 주보 사진으로 예배별 찬양팀을 한 번에 만들어요</Text>
          </Pressable>
          <Pressable style={st.cardBtn} onPress={() => setMode('join')}>
            <Text style={st.cardTitle}>초대코드로 참여</Text>
            <Text style={st.cardDesc}>팀원이라면 — 인도자에게 받은 4자리 코드로 입장해요</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10, width: '100%' }}>
          <TextInput
            style={st.input}
            placeholder="초대코드 4자리"
            placeholderTextColor={C.faint}
            value={text}
            onChangeText={setText}
            autoFocus
            autoCapitalize="characters" 
            editable={!busy}
            onSubmitEditing={submit}
          />
          <Pressable
            style={({ pressed }) => [st.primary, pressed && { backgroundColor: C.primaryDark }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={st.primaryLabel}>입장하기</Text>
            )}
          </Pressable>
          <Pressable onPress={() => !busy && setMode('choice')} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.mut }}>‹ 뒤로</Text>
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 36,
  },
  title: { fontFamily: F.serif, fontSize: 26, color: C.ink },
  subtitle: { fontFamily: F.sans, fontSize: 13, color: C.mut, textAlign: 'center' },
  cardBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 18,
    gap: 5,
  },
  cardTitle: { fontFamily: F.sansBold, fontSize: 15.5, color: C.ink },
  cardDesc: { fontFamily: F.sans, fontSize: 12.5, color: C.mut, lineHeight: 19 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontFamily: F.sans,
    fontSize: 15,
    color: C.ink,
  },
  primary: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryLabel: { fontFamily: F.sansBold, fontSize: 15, color: '#fff' },
});
