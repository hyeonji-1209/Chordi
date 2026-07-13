import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoldTag, ScreenTitle, SheetThumb } from '@/components/ui';
import { C, F } from '@/constants/theme';
import { analyzeSong } from '@/lib/ai';
import { useStore } from '@/store/useStore';

const FILTERS = ['전체', '빠른 찬양', '잔잔한', '성가', '키: G'] as const;

export default function SongsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const team = useStore((s) => s.currentTeam());
  const songs = useStore((s) => s.songs);
  const setlists = useStore((s) => s.setlists);
  const addSong = useStore((s) => s.addSong);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('전체');
  const [uploading, setUploading] = useState(false);

  const teamSongs = useMemo(() => songs.filter((s) => s.teamId === team.id), [songs, team.id]);
  const teamSetlist = useMemo(
    () => setlists.find((sl) => sl.teamId === team.id),
    [setlists, team.id],
  );

  const filtered = useMemo(
    () =>
      teamSongs.filter((s) => {
        if (query && !s.title.includes(query)) return false;
        if (filter === '전체') return true;
        if (filter === '키: G') return s.originalKey === 'G';
        return s.tags.includes(filter);
      }),
    [teamSongs, query, filter],
  );

  const upload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.6,
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
      const song = addSong(analysis);
      Alert.alert('악보 등록 완료', `"${song.title}" (${song.originalKey}키)를 라이브러리에 추가했어요.`);
    } catch (e) {
      Alert.alert('분석 실패', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setUploading(false);
    }
  };

  const openSong = (songId: string) => {
    // 콘티에 포함된 곡이면 그 콘티 컨텍스트로, 아니면 단독 보기(첫 콘티 없이도 열리도록 song id만 사용)
    const inSetlist = setlists.find(
      (sl) => sl.teamId === team.id && sl.items.some((it) => it.songId === songId),
    );
    router.push(`/sheet/${inSetlist?.id ?? 'library'}/${songId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 14 }}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <ScreenTitle>Songs</ScreenTitle>
        <View style={st.search}>
          <Ionicons name="search" size={15} color={C.mut} />
          <TextInput
            style={st.searchInput}
            placeholder="곡 제목 · 가사 · 태그 검색"
            placeholderTextColor={C.mut}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[st.filterChip, filter === f && st.filterChipActive]}
            >
              <Text style={[st.filterLabel, filter === f && st.filterLabelActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
          <Text style={st.libLabel}>{team.name} 라이브러리</Text>
          <Text style={st.libSub}>· {teamSongs.length}곡</Text>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 20, paddingTop: 10, gap: 7, paddingBottom: 100 }}
        renderItem={({ item: song }) => (
          <Pressable
            onPress={() => openSong(song.id)}
            style={({ pressed }) => [st.songCard, pressed && { borderColor: C.primary }]}
          >
            <SheetThumb w={36} h={46} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={st.songTitle}>{song.title}</Text>
                {song.tags.includes('성가') && <GoldTag>성가</GoldTag>}
              </View>
              <Text style={st.songMeta}>{song.sourceLabel}</Text>
            </View>
            <Text style={st.songKey}>{song.originalKey}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={st.empty}>
            아직 악보가 없어요.{'\n'}오른쪽 아래 Upload로 악보 사진을 올리면{'\n'}AI가 제목·키·코드차트를 읽어서 정리해요.
          </Text>
        }
      />

      {/* upload FAB */}
      <Pressable style={[st.fab, { bottom: 20 }]} onPress={upload} disabled={uploading}>
        {uploading ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={st.fabLabel}>악보 읽는 중…</Text>
          </>
        ) : (
          <Text style={st.fabLabel}>＋ Upload</Text>
        )}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
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
  filterChip: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  filterLabel: { fontFamily: F.sansMedium, fontSize: 12, color: C.ink },
  filterLabelActive: { fontFamily: F.sansBold, color: '#fff' },
  libLabel: { fontFamily: F.sansBold, fontSize: 12.5, color: C.mut },
  libSub: { fontFamily: F.sans, fontSize: 11.5, color: C.faint },
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
    marginTop: 40,
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
});
