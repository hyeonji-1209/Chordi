import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/constants/theme';
import { nextServiceDate, nextServiceLabel } from '@/lib/date';
import { useAiCreditRemote, type AiCredit } from '@/lib/db';
import { normalizeImageType } from '@/lib/media';
import { useStore } from '@/store/useStore';

const PLACEHOLDER =
  '이번주는 이 순서대로 갈꺼고 다 G키로 맞춰줘. 3번째 곡은 후렴 2번 반복하고, 마지막 곡은 브릿지에서 한 키 올려. 4번곡이랑 5번곡은 간주 없이 이어서';

export default function AiInputScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const images = useStore((s) => s.aiDraft.images);
  const prompt = useStore((s) => s.aiDraft.prompt);
  const targetTeamId = useStore((s) => s.aiDraft.targetTeamId);
  const teams = useStore((s) => s.teams);
  const currentTeamId = useStore((s) => s.currentTeamId);
  const setAiImages = useStore((s) => s.setAiImages);
  const setAiPrompt = useStore((s) => s.setAiPrompt);
  const setAiTargetTeam = useStore((s) => s.setAiTargetTeam);

  // 기본 대상 팀 = 현재 팀
  useEffect(() => {
    if (!targetTeamId) setAiTargetTeam(currentTeamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이번 달 AI 생성 잔여 횟수 (교회 전체 기준, 차감 없이 조회)
  const [credit, setCredit] = useState<AiCredit | null>(null);
  useEffect(() => {
    const teamId = targetTeamId ?? currentTeamId;
    if (!teamId) return;
    useAiCreditRemote(teamId, true).then(setCredit);
  }, [targetTeamId, currentTeamId]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85, // 음표 판독을 위해 화질 유지
      base64: true,
    });
    if (result.canceled) return;
    const picked = result.assets
      .filter((a) => a.base64)
      .map((a) => ({
        uri: a.uri,
        base64: a.base64 as string,
        mediaType: normalizeImageType(a.mimeType),
      }));
    setAiImages([...images, ...picked]);
  };

  const removeImage = (uri: string) => setAiImages(images.filter((i) => i.uri !== uri));

  const canSubmit = images.length > 0 && prompt.trim().length > 0;

  const goReview = () => {
    // 이 팀의 다가오는 예배에 이미 콘티가 있으면 AI를 돌리기 전에 확인
    const team = useStore.getState().aiTargetTeam();
    const d = nextServiceDate(team.serviceDay);
    const datePrefix = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const existing = useStore
      .getState()
      .setlists.find((sl) => sl.teamId === team.id && sl.title.startsWith(datePrefix));
    if (existing) {
      Alert.alert(
        '잠깐만요!',
        `이번 ${nextServiceLabel(team.serviceDay)}에는 이미 "${existing.title}" 콘티가 있어요.\n새로 만들면 덮어쓰게 돼요. 계속할까요?`,
        [
          { text: '취소', style: 'cancel' },
          { text: '계속 만들기', style: 'destructive', onPress: () => router.push('/ai-review') },
        ],
      );
      return;
    }
    router.push('/ai-review');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* header */}
        <View style={st.header}>
          <Pressable style={st.back} onPress={() => router.back()}>
            <Text style={{ fontSize: 16, color: C.ink }}>‹</Text>
          </Pressable>
          <Text style={st.headerTitle}>
            <Text style={{ color: C.goldDark }}>✦ </Text>AI로 콘티 만들기
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 18, paddingTop: 6 }}>
          {/* target team (예배) */}
          {teams.length > 1 && (
            <View style={{ gap: 10 }}>
              <Text style={st.stepTitle}>어떤 찬양팀(예배)에 올릴까요?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {teams.map((t) => {
                  const active = t.id === (targetTeamId ?? currentTeamId);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => setAiTargetTeam(t.id)}
                      style={[st.teamChip, active && st.teamChipActive]}
                    >
                      <View style={[st.teamDot, { backgroundColor: t.color }]} />
                      <Text style={[st.teamChipLabel, active && st.teamChipLabelActive]}>
                        {t.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* step 1: images */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={st.stepTitle}>① 악보 사진을 넣으세요</Text>
              {images.length > 0 && <Text style={st.stepSub}>{images.length}장</Text>}
            </View>
            <View style={st.grid}>
              {images.map((img) => (
                <Pressable key={img.uri} style={st.cell} onLongPress={() => removeImage(img.uri)}>
                  <Image source={{ uri: img.uri }} style={st.cellImage} />
                </Pressable>
              ))}
              <Pressable style={[st.cell, st.addCell]} onPress={pickImages}>
                <Text style={{ fontSize: 20, color: C.mut, lineHeight: 24 }}>＋</Text>
                <Text style={{ fontFamily: F.sans, fontSize: 10, color: C.mut }}>추가</Text>
              </Pressable>
            </View>
            <Text style={st.hint}>사진·갤러리 여러 장 한 번에 가능 · 길게 눌러 삭제</Text>
          </View>

          {/* step 2: prompt */}
          <View style={{ gap: 10 }}>
            <Text style={st.stepTitle}>② 하고 싶은 걸 평소 말투로 적으세요</Text>
            <TextInput
              style={st.promptInput}
              multiline
              placeholder={PLACEHOLDER}
              placeholderTextColor={C.faint}
              value={prompt}
              onChangeText={setAiPrompt}
            />
          </View>
        </View>
      </ScrollView>

      {/* submit */}
      <View style={[st.footer, { paddingBottom: insets.bottom + 14 }]}>
        {credit && credit.limit < 100000 && (() => {
          const remain = Math.max(0, credit.limit - credit.used);
          const ratio = credit.used / credit.limit;
          const ringColor = ratio < 0.5 ? '#5E8A6E' : ratio < 0.85 ? C.goldDark : '#8E3E5C';
          return (
            <View style={st.creditRow}>
              <View style={[st.creditRing, { borderColor: ringColor }]}>
                <Text style={[st.creditRingNum, { color: ringColor }]}>{remain}</Text>
              </View>
              <View>
                <Text style={st.creditTitle}>
                  이번 달 AI 생성 {credit.used}/{credit.limit}회
                  {credit.boost && ' · 첫 달 20회 🎁'}
                </Text>
                <Text style={st.creditSub}>
                  {credit.ok
                    ? `${remain}회 남음 · 매달 1일 초기화`
                    : '한도 초과 — 다음 달 1일에 다시 채워져요'}
                </Text>
              </View>
            </View>
          );
        })()}
        <Pressable
          disabled={!canSubmit}
          onPress={goReview}
          style={({ pressed }) => [
            st.submit,
            !canSubmit && { opacity: 0.4 },
            pressed && { backgroundColor: C.primaryDark },
          ]}
        >
          <Text style={st.submitLabel}>
            <Text style={{ color: C.gold }}>✦ </Text>콘티 만들어줘
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  back: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink },
  stepTitle: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  teamChipActive: { borderColor: C.primary, backgroundColor: C.primaryTint },
  teamDot: { width: 8, height: 8, borderRadius: 4 },
  teamChipLabel: { fontFamily: F.sansMedium, fontSize: 12.5, color: C.ink },
  teamChipLabelActive: { fontFamily: F.sansBold, color: C.primary },
  stepSub: { fontFamily: F.sans, fontSize: 12, color: C.mut },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: '23%',
    aspectRatio: 3 / 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    backgroundColor: '#FBFAF7',
  },
  cellImage: { width: '100%', height: '100%' },
  addCell: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.faint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'transparent',
  },
  hint: { fontFamily: F.sans, fontSize: 11.5, color: C.mut },
  promptInput: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 14,
    padding: 14,
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 22,
    color: C.ink,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: C.bg,
  },
  submit: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  submitLabel: { fontFamily: F.sansBold, fontSize: 15.5, color: '#fff' },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  creditRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditRingNum: { fontFamily: F.sansBold, fontSize: 13 },
  creditTitle: { fontFamily: F.sansBold, fontSize: 12.5, color: C.ink },
  creditSub: { fontFamily: F.sans, fontSize: 11, color: C.mut, marginTop: 1 },
});
