import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card, GoldTag, KeyBadge } from '@/components/ui';
import { C, F } from '@/constants/theme';
import { nextServiceLabel } from '@/lib/date';
import { useStore } from '@/store/useStore';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const team = useStore((s) => s.currentTeam());
  const setlists = useStore((s) => s.setlists);
  const songs = useStore((s) => s.songs);
  const songById = useStore((s) => s.songById);

  const setlist = useMemo(
    () => setlists.find((sl) => sl.teamId === team.id),
    [setlists, team.id],
  );
  const recent = useMemo(
    () => songs.filter((s) => s.teamId === team.id).slice(0, 2),
    [songs, team.id],
  );
  const meId = useStore((s) => s.meId());
  const me = team.members.find((m) => m.id === meId) ?? team.members[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}
    >
      {/* team switcher */}
      <View style={st.topRow}>
        <Pressable style={st.teamPill} onPress={() => router.navigate('/team')}>
          <View style={[st.dot, { backgroundColor: team.color }]} />
          <Text style={st.teamPillLabel}>{team.name}</Text>
          <Text style={{ color: C.mut, fontSize: 11 }}>▾</Text>
        </Pressable>
        <Avatar name={me?.name ?? '나'} size={36} />
      </View>

      <View style={{ paddingHorizontal: 20, gap: 14, paddingTop: 14 }}>
        <Text style={st.greeting}>{nextServiceLabel(team.serviceDay)}{team.serviceTime ? ` ${team.serviceTime}` : ''},{'\n'}은혜로운 예배 되세요</Text>

        {/* AI CTA */}
        <Pressable
          onPress={() => router.push('/ai-input')}
          style={({ pressed }) => [st.aiCta, pressed && { backgroundColor: C.primaryDark }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.gold, fontSize: 16 }}>✦</Text>
            <Text style={st.aiCtaTitle}>AI로 콘티 만들기</Text>
          </View>
          <Text style={st.aiCtaDesc}>
            악보 사진을 넣고 하고 싶은 말을 적으면{'\n'}키·순서·반복까지 알아서 세팅해 드려요
          </Text>
        </Pressable>

        {/* this week */}
        {setlist ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={st.cardTitle}>최근 콘티</Text>
              <Text style={st.cardSub}>{setlist.title} · 인도 {setlist.leader}</Text>
              <Pressable style={{ marginLeft: 'auto' }} onPress={() => router.push(`/setlist/${setlist.id}`)}>
                <Text style={st.link}>전체 ›</Text>
              </Pressable>
            </View>
            <View style={{ gap: 8 }}>
              {setlist.items.slice(0, 4).map((item, i) => {
                const song = songById(item.songId);
                if (!song) return null;
                return (
                  <View key={item.songId} style={st.songRow}>
                    <Text style={st.songIdx}>{i + 1}</Text>
                    <Text style={st.songName}>{song.title}</Text>
                    <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      {item.note && <GoldTag>{item.note}</GoldTag>}
                      <KeyBadge k={item.key} />
                    </View>
                  </View>
                );
              })}
            </View>
            <Pressable
              onPress={() => router.push(`/sheet/${setlist.id}/${setlist.items[0].songId}`)}
              style={({ pressed }) => [st.playBtn, pressed && { backgroundColor: C.primaryTint }]}
            >
              <Text style={st.playBtnLabel}>▶ 연주 모드로 열기</Text>
            </Pressable>
          </Card>
        ) : (
          <Card style={{ gap: 6, alignItems: 'center', paddingVertical: 26 }}>
            <Text style={st.emptyTitle}>아직 콘티가 없어요</Text>
            <Text style={st.emptyDesc}>
              위의 <Text style={{ color: C.primary, fontFamily: F.sansBold }}>AI로 콘티 만들기</Text>로
              첫 콘티를 만들어 보세요
            </Text>
          </Card>
        )}

        {/* recent */}
        {recent.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text style={st.sectionLabel}>최근 올린 악보</Text>
            {recent.map((song) => (
              <View key={song.id} style={st.recentRow}>
                <Text style={st.recentName}>{song.title}</Text>
                <Text style={st.recentTeam}>{team.name}</Text>
                <Text style={st.recentKey}>{song.originalKey}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    justifyContent: 'space-between',
  },
  teamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  teamPillLabel: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  dot: { width: 8, height: 8, borderRadius: 4 },
  greeting: { fontFamily: F.serif, fontSize: 23, lineHeight: 32, color: C.ink },
  aiCta: {
    backgroundColor: C.primary,
    borderRadius: 16,
    padding: 18,
    gap: 6,
    shadowColor: C.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  aiCtaTitle: { fontFamily: F.sansBold, fontSize: 16, color: '#fff' },
  aiCtaDesc: { fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: 'rgba(255,255,255,.75)' },
  cardTitle: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  cardSub: { fontFamily: F.sans, fontSize: 12, color: C.mut, flexShrink: 1 },
  link: { fontFamily: F.sansMedium, fontSize: 12, color: C.primary },
  songRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  songIdx: { width: 20, fontFamily: F.sans, fontSize: 12, color: C.mut, textAlign: 'center' },
  songName: { fontFamily: F.sansMedium, fontSize: 14, color: C.ink },
  playBtn: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  playBtnLabel: { fontFamily: F.sansBold, fontSize: 13.5, color: C.primary },
  emptyTitle: { fontFamily: F.sansBold, fontSize: 14, color: C.ink },
  emptyDesc: { fontFamily: F.sans, fontSize: 12.5, color: C.mut, textAlign: 'center', lineHeight: 19 },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 13, color: C.mut },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  recentName: { fontFamily: F.sansMedium, fontSize: 13.5, color: C.ink },
  recentTeam: { fontFamily: F.sans, fontSize: 11.5, color: C.mut },
  recentKey: { marginLeft: 'auto', fontFamily: F.mono, fontWeight: '600', fontSize: 11, color: C.mut },
});
