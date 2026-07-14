import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BulletinSetup } from '@/components/BulletinSetup';
import { C, F } from '@/constants/theme';

/** 주보 사진으로 교회 + 예배별 팀 일괄 등록 */
export default function ChurchSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
      <View style={st.header}>
        <Pressable style={st.back} onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: C.ink }}>‹</Text>
        </Pressable>
        <View>
          <Text style={st.title}>안녕하세요, 관리자님!</Text>
          <Text style={st.sub}>교회의 예배 시간 주보를 업로드해 주세요 — 예배별 팀을 한 번에 만들어요</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, flex: 1 }}>
        <BulletinSetup onDone={() => router.back()} />
      </View>
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
  title: { fontFamily: F.serif, fontSize: 18, color: C.ink },
  sub: { fontFamily: F.sans, fontSize: 12, color: C.mut },
});
