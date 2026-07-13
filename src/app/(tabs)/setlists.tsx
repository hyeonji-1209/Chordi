import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ScreenTitle } from '@/components/ui';
import { C, F } from '@/constants/theme';
import { useStore } from '@/store/useStore';

export default function SetlistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setlists = useStore((s) => s.setlists);
  const songById = useStore((s) => s.songById);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 14 }}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <ScreenTitle>Setlists</ScreenTitle>
      </View>
      <FlatList
        data={setlists}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 20, paddingTop: 14, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/setlist/${item.id}`)}>
            {({ pressed }) => (
              <Card style={[{ gap: 8 }, pressed && { borderColor: C.primary }]}>
                <Text style={st.title}>{item.title}</Text>
                <Text style={st.sub}>{item.subtitle}</Text>
                <Text style={st.songs} numberOfLines={1}>
                  {item.items
                    .map((it) => songById(it.songId)?.title)
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Card>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={{ fontFamily: F.sans, color: C.mut, textAlign: 'center', marginTop: 40 }}>
            아직 콘티가 없어요. Home에서 AI로 만들어 보세요.
          </Text>
        }
      />
    </View>
  );
}

const st = StyleSheet.create({
  title: { fontFamily: F.serif, fontSize: 16.5, color: C.ink },
  sub: { fontFamily: F.sans, fontSize: 12, color: C.mut },
  songs: { fontFamily: F.sans, fontSize: 12.5, color: C.memoText },
});
