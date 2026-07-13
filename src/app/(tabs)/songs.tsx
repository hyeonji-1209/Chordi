import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyBadge, ScreenTitle, SheetThumb } from '@/components/ui';
import { C, F } from '@/constants/theme';
import { analyzeSong } from '@/lib/ai';
import { uploadSheetImages } from '@/lib/sheets';
import { formToText } from '@/lib/form';
import { useStore } from '@/store/useStore';
import type { AiSongAnalysis, Song } from '@/data/types';

export default function SongsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const team = useStore((s) => s.currentTeam());
  const songs = useStore((s) => s.songs);
  const setlists = useStore((s) => s.setlists);
  const addSong = useStore((s) => s.addSong);
  const updateSong = useStore((s) => s.updateSong);
  const deleteSong = useStore((s) => s.deleteSong);
  const canEditSong = useStore((s) => s.canEditSong);
  const songById = useStore((s) => s.songById);

  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  // 업로드 확인 모달 상태
  const [pendingUpload, setPendingUpload] = useState<{
    analysis: AiSongAnalysis;
    images: { base64: string; mediaType: string }[];
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftKey, setDraftKey] = useState('');

  // 곡 수정 모달 상태
  const [editSong, setEditSong] = useState<Song | null>(null);

  const teamSongs = useMemo(() => songs.filter((s) => s.teamId === team.id), [songs, team.id]);
  const thisWeek = useMemo(
    () => setlists.find((sl) => sl.teamId === team.id),
    [setlists, team.id],
  );

  const filtered = useMemo(
    () => teamSongs.filter((s) => !query || s.title.includes(query)),
    [teamSongs, query],
  );

  const pickAndAnalyze = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85, // 음표 판독을 위해 화질 유지
      base64: true,
    });
    if (result.canceled) return;
    const images = result.assets
      .filter((a) => a.base64)
      .map((a) => ({ base64: a.base64 as string, mediaType: a.mimeType ?? 'image/jpeg' }));
    if (images.length === 0) return;

    setUploading(true);
    try {
      const analysis = await analyzeSong(images);
      // 바로 저장하지 않고 확인 모달로
      setDraftTitle(analysis.title);
      setDraftKey(analysis.originalKey);
      setPendingUpload({ analysis, images });
    } catch (e) {
      Alert.alert('분석 실패', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setUploading(false);
    }
  };

  const confirmUpload = () => {
    if (!pendingUpload) return;
    const song = addSong({
      ...pendingUpload.analysis,
      title: draftTitle.trim() || pendingUpload.analysis.title,
      originalKey: draftKey.trim() || pendingUpload.analysis.originalKey,
    });
    // 원본 악보 사진을 Storage에 올려 곡에 부착 (백그라운드, 팀 공유)
    uploadSheetImages(song.teamId, song.id, pendingUpload.images).then((urls) => {
      if (urls.length) useStore.getState().setSongImages(song.id, urls);
    });
    // 오선보 자동 생성(필사)은 정확도 이슈로 보류 — 원본 악보 보기로 대체
    // useStore.getState().setTranscribing(song.id, true);
    // transcribeSheet(pendingUpload.images)
    //   .then((abc) => { if (abc) useStore.getState().setSongAbc(song.id, abc); })
    //   .finally(() => useStore.getState().setTranscribing(song.id, false));
    setPendingUpload(null);
  };

  const openSong = (songId: string) => {
    const inSetlist = setlists.find(
      (sl) => sl.teamId === team.id && sl.items.some((it) => it.songId === songId),
    );
    router.push(`/sheet/${inSetlist?.id ?? 'library'}/${songId}`);
  };

  const onLongPressSong = (song: Song) => {
    if (!canEditSong(song.id)) {
      Alert.alert('권한 없음', '이 곡은 올린 사람만 수정·삭제할 수 있어요.');
      return;
    }
    Alert.alert(song.title, undefined, [
      { text: '취소', style: 'cancel' },
      {
        text: '수정',
        onPress: () => {
          setDraftTitle(song.title);
          setDraftKey(song.originalKey);
          setEditSong(song);
        },
      },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () =>
          Alert.alert('곡 삭제', `"${song.title}"을(를) 삭제할까요?\n콘티에서도 빠져요.`, [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: () => deleteSong(song.id) },
          ]),
      },
    ]);
  };

  const saveEdit = () => {
    if (!editSong) return;
    updateSong(editSong.id, {
      title: draftTitle.trim() || editSong.title,
      originalKey: draftKey.trim() || editSong.originalKey,
    });
    setEditSong(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 14 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <ScreenTitle>Songs</ScreenTitle>

          {/* ── 핵심: 이번 주 찬양 + 송폼 ── */}
          {thisWeek ? (
            <View style={st.weekCard}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={st.weekTitle}>이번 주 찬양</Text>
                <Text style={st.weekSub}>{thisWeek.title}</Text>
                <Pressable style={{ marginLeft: 'auto' }} onPress={() => router.push(`/setlist/${thisWeek.id}`)}>
                  <Text style={st.link}>콘티 ›</Text>
                </Pressable>
              </View>
              {thisWeek.items.map((item, i) => {
                const song = songById(item.songId);
                if (!song) return null;
                const form = formToText(song.form);
                return (
                  <Pressable
                    key={item.songId}
                    onPress={() => router.push(`/sheet/${thisWeek.id}/${song.id}`)}
                    onLongPress={() => onLongPressSong(song)}
                    style={({ pressed }) => [st.weekRow, pressed && { borderColor: C.primary }]}
                  >
                    <Text style={st.weekIdx}>{i + 1}</Text>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={st.weekSong}>{song.title}</Text>
                      <Text style={st.weekForm} numberOfLines={1}>
                        {form ? `송폼  ${form}` : '송폼 없음 — 연주 모드 ✎에서 추가'}
                      </Text>
                    </View>
                    <KeyBadge k={item.key} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={st.weekCard}>
              <Text style={st.weekTitle}>이번 주 찬양</Text>
              <Text style={st.weekEmpty}>
                아직 콘티가 없어요. Home에서 AI로 콘티를 만들면 여기에 이번 주 찬양과 송폼이 떠요.
              </Text>
            </View>
          )}

          {/* ── 라이브러리 ── */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <Text style={st.libLabel}>라이브러리</Text>
            <Text style={st.libSub}>· {teamSongs.length}곡 · 길게 눌러 수정/삭제</Text>
          </View>
          <View style={st.search}>
            <Ionicons name="search" size={15} color={C.mut} />
            <TextInput
              style={st.searchInput}
              placeholder="곡 제목 검색"
              placeholderTextColor={C.mut}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View style={{ gap: 7 }}>
            {filtered.map((song) => (
              <Pressable
                key={song.id}
                onPress={() => openSong(song.id)}
                onLongPress={() => onLongPressSong(song)}
                style={({ pressed }) => [st.songCard, pressed && { borderColor: C.primary }]}
              >
                <SheetThumb w={36} h={46} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.songTitle}>{song.title}</Text>
                  <Text style={st.songMeta}>{song.sourceLabel}</Text>
                </View>
                <Text style={st.songKey}>{song.originalKey}</Text>
              </Pressable>
            ))}
            {filtered.length === 0 && (
              <Text style={st.empty}>
                {query ? '검색 결과가 없어요.' : '아직 악보가 없어요.\nUpload로 악보 사진을 올려보세요.'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* upload FAB */}
      <Pressable style={[st.fab, { bottom: 20 }]} onPress={pickAndAnalyze} disabled={uploading}>
        {uploading ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={st.fabLabel}>악보 읽는 중…</Text>
          </>
        ) : (
          <Text style={st.fabLabel}>＋ Upload</Text>
        )}
      </Pressable>

      {/* ── 업로드 확인 / 곡 수정 모달 ── */}
      <Modal
        visible={pendingUpload !== null || editSong !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPendingUpload(null);
          setEditSong(null);
        }}
      >
        <Pressable
          style={st.dim}
          onPress={() => {
            setPendingUpload(null);
            setEditSong(null);
          }}
        />
        <View style={st.modalCard}>
          <Text style={st.modalTitle}>{pendingUpload ? '이대로 올릴까요?' : '곡 수정'}</Text>
          {pendingUpload && (
            <Text style={st.modalSub}>
              AI가 읽은 내용이에요. 틀린 곳은 고쳐주세요.
              {pendingUpload.analysis.bpm ? ` · ${pendingUpload.analysis.bpm} BPM` : ''}
            </Text>
          )}
          <View style={{ gap: 8 }}>
            <Text style={st.fieldLabel}>곡 제목</Text>
            <TextInput
              style={st.modalInput}
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="곡 제목"
              placeholderTextColor={C.faint}
            />
            <Text style={st.fieldLabel}>원키</Text>
            <TextInput
              style={[st.modalInput, { width: 90 }]}
              value={draftKey}
              onChangeText={setDraftKey}
              placeholder="G"
              placeholderTextColor={C.faint}
              autoCapitalize="characters"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={st.modalGhost}
              onPress={() => {
                setPendingUpload(null);
                setEditSong(null);
              }}
            >
              <Text style={st.modalGhostLabel}>취소</Text>
            </Pressable>
            <Pressable style={st.modalPrimary} onPress={pendingUpload ? confirmUpload : saveEdit}>
              <Text style={st.modalPrimaryLabel}>{pendingUpload ? '올리기' : '저장'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  weekCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  weekTitle: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  weekSub: { fontFamily: F.sans, fontSize: 12, color: C.mut, flexShrink: 1 },
  weekEmpty: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: C.mut },
  link: { fontFamily: F.sansMedium, fontSize: 12, color: C.primary },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weekIdx: { width: 18, fontFamily: F.sans, fontSize: 12, color: C.mut, textAlign: 'center' },
  weekSong: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  weekForm: { fontFamily: F.mono, fontWeight: '600', fontSize: 11, color: C.goldDark },
  libLabel: { fontFamily: F.sansBold, fontSize: 13, color: C.mut },
  libSub: { fontFamily: F.sans, fontSize: 11.5, color: C.faint },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  searchInput: { flex: 1, fontFamily: F.sans, fontSize: 13.5, color: C.ink, paddingVertical: 8 },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  songTitle: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  songMeta: { fontFamily: F.sans, fontSize: 11.5, color: C.mut },
  songKey: { fontFamily: F.mono, fontWeight: '600', fontSize: 11.5, color: C.mut },
  empty: {
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 21,
    color: C.mut,
    textAlign: 'center',
    marginVertical: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 19,
    paddingVertical: 13,
    shadowColor: C.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  fabLabel: { fontFamily: F.sansBold, fontSize: 14, color: '#fff' },
  dim: { flex: 1, backgroundColor: 'rgba(38,36,31,.45)' },
  modalCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '24%',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontFamily: F.serif, fontSize: 16.5, color: C.ink },
  modalSub: { fontFamily: F.sans, fontSize: 12, color: C.mut },
  fieldLabel: { fontFamily: F.sansBold, fontSize: 11.5, color: C.mut },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: F.sans,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
  },
  modalGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalGhostLabel: { fontFamily: F.sansMedium, fontSize: 13.5, color: C.ink },
  modalPrimary: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalPrimaryLabel: { fontFamily: F.sansBold, fontSize: 13.5, color: '#fff' },
});
