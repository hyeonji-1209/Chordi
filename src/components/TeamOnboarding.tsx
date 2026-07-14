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
import { ServicePicker } from '@/components/ServicePicker';
import { C, F } from '@/constants/theme';
import { guessServiceDay } from '@/lib/date';
import { createTeamRemote, joinTeamRemote } from '@/lib/db';
import { useStore } from '@/store/useStore';

type Mode = 'choice' | 'create' | 'join' | 'bulletin';

/** 첫 로그인 온보딩: 팀 만들기 or 초대코드로 참여 */
export function TeamOnboarding() {
  const [mode, setMode] = useState<Mode>('choice');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [day, setDay] = useState<number | undefined>(undefined);
  const [dayTouched, setDayTouched] = useState(false); // 직접 고른 뒤엔 자동 추측 안 함
  const [time, setTime] = useState('');

  const onNameChange = (t: string) => {
    setText(t);
    if (mode === 'create' && !dayTouched) {
      const guessed = guessServiceDay(t);
      if (guessed !== undefined) setDay(guessed);
    }
  };

  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    try {
      if (mode === 'create') await createTeamRemote(value, day, time);
      else await joinTeamRemote(value);
      await useStore.getState().initFromServer(); // 팀이 생기면 게이트가 자동으로 열림
    } catch (e) {
      const msg = e instanceof Error ? e.message : '오류가 발생했어요';
      Alert.alert(
        mode === 'create' ? '팀 생성 실패' : '입장 실패',
        msg.includes('초대코드') ? '초대코드가 올바르지 않아요' : msg,
      );
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
        <Text style={st.title}>어느 찬양팀인가요?</Text>
        <Text style={st.subtitle}>팀 이름이 곧 예배예요 — 주일 1부, 목요예배, 청년부…</Text>
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
            <Text style={st.cardTitle}>📷 주보로 교회 등록</Text>
            <Text style={st.cardDesc}>주보 사진을 찍으면 예배별 찬양팀이 한 번에 만들어져요</Text>
          </Pressable>
          <Pressable style={st.cardBtn} onPress={() => setMode('create')}>
            <Text style={st.cardTitle}>새 팀 만들기</Text>
            <Text style={st.cardDesc}>내가 인도자예요. 팀 하나만 만들고 팀원을 초대할게요</Text>
          </Pressable>
          <Pressable style={st.cardBtn} onPress={() => setMode('join')}>
            <Text style={st.cardTitle}>초대코드로 참여</Text>
            <Text style={st.cardDesc}>인도자에게 받은 4자리 코드로 입장할게요</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10, width: '100%' }}>
          <TextInput
            style={st.input}
            placeholder={mode === 'create' ? '팀 이름 (예: 목요예배 찬양팀)' : '초대코드 4자리'}
            placeholderTextColor={C.faint}
            value={text}
            onChangeText={onNameChange}
            autoFocus
            autoCapitalize={mode === 'join' ? 'characters' : 'none'}
            editable={!busy}
            onSubmitEditing={submit}
          />
          {mode === 'create' && (
            <ServicePicker
              day={day}
              time={time}
              onChangeDay={(d) => {
                setDay(d);
                setDayTouched(true);
              }}
              onChangeTime={setTime}
            />
          )}
          <Pressable
            style={({ pressed }) => [st.primary, pressed && { backgroundColor: C.primaryDark }]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={st.primaryLabel}>{mode === 'create' ? '팀 만들기' : '입장하기'}</Text>
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
