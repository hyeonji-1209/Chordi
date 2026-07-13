import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyBadge, GoldTag, SheetThumb } from '@/components/ui';
import { C, F } from '@/constants/theme';
import { generateSetlist } from '@/lib/ai';
import { useStore } from '@/store/useStore';

export default function AiReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { images, prompt, result, loading, error } = useStore((s) => s.aiDraft);
  const setAiLoading = useStore((s) => s.setAiLoading);
  const setAiResult = useStore((s) => s.setAiResult);
  const resolveAiSong = useStore((s) => s.resolveAiSong);
  const confirmAiSetlist = useStore((s) => s.confirmAiSetlist);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const run = useCallback(async () => {
    setAiLoading(true);
    try {
      const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      const res = await generateSetlist(
        images.map(({ base64, mediaType }) => ({ base64, mediaType })),
        prompt,
        today,
      );
      setAiResult(res);
    } catch (e) {
      setAiResult(null, e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, prompt]);

  useEffect(() => {
    if (!result && !loading && !error) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = () => {
    if (result?.songs.some((s) => s.uncertain)) {
      Alert.alert('확인이 필요해요', '아직 확인하지 않은 곡이 있어요. 그래도 저장할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '저장', onPress: save },
      ]);
      return;
    }
    save();
  };

  const save = () => {
    const id = confirmAiSetlist();
    if (id) router.replace(`/setlist/${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
      {/* header */}
      <View style={st.header}>
        <Pressable style={st.back} onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: C.ink }}>‹</Text>
        </Pressable>
        <View>
          <Text style={st.headerTitle}>이렇게 이해했어요</Text>
          {result && <Text style={st.headerSub}>{result.summary}</Text>}
        </View>
      </View>

      {loading && (
        <View style={st.center}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={st.loadingText}>
            <Text style={{ color: C.goldDark }}>✦ </Text>악보 {images.length}장을 읽고 있어요…
          </Text>
        </View>
      )}

      {error && !loading && (
        <View style={st.center}>
          <Text style={st.errorText}>{error}</Text>
          <Pressable style={st.retryBtn} onPress={run}>
            <Text style={st.retryLabel}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {result && !loading && (
        <>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 9, paddingBottom: 120 }}>
            {result.songs.map((song) => {
              const title = song.title ?? song.titleGuess;
              if (song.uncertain) {
                return (
                  <View key={song.index} style={st.ambCard}>
                    <SheetThumb />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={st.songTitle}>
                        {song.title ?? `악보 ${song.index + 1}의 제목을 못 읽었어요`}
                      </Text>
                      {song.question && <Text style={st.ambQuestion}>{song.question}</Text>}
                      {editing === song.index ? (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TextInput
                            style={st.editInput}
                            value={editText}
                            onChangeText={setEditText}
                            placeholder="곡 제목"
                            placeholderTextColor={C.faint}
                            autoFocus
                          />
                          <Pressable
                            style={st.ambPrimaryBtn}
                            onPress={() => {
                              if (editText.trim()) resolveAiSong(song.index, editText.trim());
                              setEditing(null);
                              setEditText('');
                            }}
                          >
                            <Text style={st.ambPrimaryLabel}>확인</Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {song.titleGuess && (
                            <Pressable
                              style={st.ambPrimaryBtn}
                              onPress={() => resolveAiSong(song.index, song.titleGuess!)}
                            >
                              <Text style={st.ambPrimaryLabel}>맞아요</Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={st.ambGhostBtn}
                            onPress={() => {
                              setEditing(song.index);
                              setEditText(song.titleGuess ?? '');
                            }}
                          >
                            <Text style={st.ambGhostLabel}>직접 입력</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }
              return (
                <View key={song.index} style={st.songCard}>
                  <SheetThumb />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={st.songTitle}>
                      {song.index + 1}. {title}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                      {song.originalKey && song.originalKey !== song.targetKey && (
                        <>
                          <Text style={st.oldKey}>{song.originalKey}</Text>
                          <Text style={{ fontSize: 11, color: C.mut }}>→</Text>
                        </>
                      )}
                      <KeyBadge k={song.targetKey} />
                      {song.notes.map((n) => (
                        <GoldTag key={n}>{n}</GoldTag>
                      ))}
                      {song.linkedToPrev && <GoldTag>앞 곡과 이어서</GoldTag>}
                    </View>
                    {song.evidence && <Text style={st.evidence}>"{song.evidence}" ← 적으신 말</Text>}
                  </View>
                  <View style={st.check}>
                    <Text style={{ fontSize: 12, color: C.primary, fontWeight: '700' }}>✓</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[st.footer, { paddingBottom: insets.bottom + 14 }]}>
            <Pressable style={st.retryGhost} onPress={() => router.back()}>
              <Text style={st.retryGhostLabel}>다시 요청</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [st.confirmBtn, pressed && { backgroundColor: C.primaryDark }]}
              onPress={confirm}
            >
              <Text style={st.confirmLabel}>확인 완료 → 콘티 저장</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
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
  headerSub: { fontFamily: F.sans, fontSize: 12, color: C.mut },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 },
  loadingText: { fontFamily: F.sansMedium, fontSize: 14, color: C.memoText },
  errorText: { fontFamily: F.sans, fontSize: 13.5, color: C.memoText, textAlign: 'center', lineHeight: 21 },
  retryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  retryLabel: { fontFamily: F.sansBold, fontSize: 13.5, color: '#fff' },
  songCard: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
  },
  ambCard: {
    flexDirection: 'row',
    gap: 11,
    backgroundColor: '#FDF6EC',
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    borderRadius: 14,
    padding: 12,
  },
  songTitle: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  oldKey: {
    fontFamily: F.mono,
    fontWeight: '600',
    fontSize: 11,
    color: C.mut,
    textDecorationLine: 'line-through',
  },
  evidence: { fontFamily: F.sans, fontSize: 11, color: C.mut },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambQuestion: { fontFamily: F.sans, fontSize: 12.5, color: C.memoText },
  ambPrimaryBtn: {
    backgroundColor: C.goldDark,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  ambPrimaryLabel: { fontFamily: F.sansBold, fontSize: 12.5, color: '#fff' },
  ambGhostBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  ambGhostLabel: { fontFamily: F.sansMedium, fontSize: 12.5, color: C.memoText },
  editInput: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: F.sans,
    fontSize: 13,
    color: C.ink,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: C.bg,
  },
  retryGhost: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryGhostLabel: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  confirmBtn: {
    flex: 2,
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  confirmLabel: { fontFamily: F.sansBold, fontSize: 14, color: '#fff' },
});
