import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
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
import { C, F } from '@/constants/theme';
import { normalizeImageType } from '@/lib/media';
import { parseBulletin } from '@/lib/ai';
import { createChurchWithTeamsRemote } from '@/lib/db';
import { useStore } from '@/store/useStore';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

type ServiceRow = {
  name: string;
  day: number | null;
  time: string | null;
  selected: boolean;
};

/** 주보 사진 → 교회 + 예배별 팀 일괄 생성 */
export function BulletinSetup({ onDone }: { onDone: () => void }) {
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [churchName, setChurchName] = useState('');
  const [rows, setRows] = useState<ServiceRow[] | null>(null);

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      base64: true,
    });
    if (result.canceled) return;
    const images = result.assets
      .filter((a) => a.base64)
      .map((a) => ({ base64: a.base64 as string, mediaType: normalizeImageType(a.mimeType) }));
    if (!images.length) return;

    setParsing(true);
    try {
      const parsed = await parseBulletin(images);
      setChurchName(parsed.churchName);
      setRows(parsed.services.map((s) => ({ ...s, selected: true })));
    } catch (e) {
      Alert.alert('주보 인식 실패', e instanceof Error ? e.message : '오류가 발생했어요');
    } finally {
      setParsing(false);
    }
  };

  const create = async () => {
    const selected = rows?.filter((r) => r.selected && r.name.trim()) ?? [];
    const name = churchName.trim();
    if (!name || selected.length === 0) {
      Alert.alert('확인', '교회 이름과 예배를 하나 이상 선택해 주세요');
      return;
    }
    setCreating(true);
    try {
      await createChurchWithTeamsRemote(
        name,
        selected.map((r) => ({ name: r.name.trim(), day: r.day, time: r.time?.trim() || null })),
      );
      await useStore.getState().initFromServer();
      onDone();
    } catch (e) {
      Alert.alert('등록 실패', e instanceof Error ? e.message : '오류가 발생했어요');
      setCreating(false);
    }
  };

  if (!rows) {
    return (
      <View style={{ gap: 10, width: '100%' }}>
        <Pressable style={st.pickBtn} onPress={pick} disabled={parsing}>
          {parsing ? (
            <>
              <ActivityIndicator size="small" color={C.primary} />
              <Text style={st.pickLabel}>주보를 읽고 있어요…</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, color: C.primary }}>✦</Text>
              <Text style={st.pickLabel}>주보 사진 선택</Text>
              <Text style={st.pickDesc}>예배 목록을 읽어서 예배별 팀을 한 번에 만들어요</Text>
            </>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', maxHeight: 460 }}>
      <Text style={st.fieldLabel}>교회 이름</Text>
      <TextInput
        style={st.churchInput}
        value={churchName}
        onChangeText={setChurchName}
        placeholder="교회 이름"
        placeholderTextColor={C.faint}
      />
      <Text style={[st.fieldLabel, { marginTop: 10 }]}>
        만들 예배(팀) 선택 — {rows.filter((r) => r.selected).length}개
      </Text>
      <ScrollView style={{ maxHeight: 240 }} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
        {rows.map((row, i) => (
          <Pressable
            key={i}
            onPress={() =>
              setRows((rs) => rs!.map((r, j) => (j === i ? { ...r, selected: !r.selected } : r)))
            }
            style={[st.row, row.selected && st.rowSelected]}
          >
            <Text style={[st.check, row.selected && { color: C.primary }]}>
              {row.selected ? '☑' : '☐'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={st.rowName}>{row.name}</Text>
              <Text style={st.rowMeta}>
                {row.day !== null ? `${DAY_NAMES[row.day]}요일` : '요일 미정'}
                {row.time ? ` · ${row.time}` : ''}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Pressable style={st.ghost} onPress={() => setRows(null)} disabled={creating}>
          <Text style={st.ghostLabel}>다시 찍기</Text>
        </Pressable>
        <Pressable style={st.primary} onPress={create} disabled={creating}>
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={st.primaryLabel}>교회 등록</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  pickBtn: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: 16,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 6,
  },
  pickLabel: { fontFamily: F.sansBold, fontSize: 15, color: C.primary },
  pickDesc: { fontFamily: F.sans, fontSize: 12, color: C.mut },
  fieldLabel: { fontFamily: F.sansBold, fontSize: 11.5, color: C.mut, marginBottom: 6 },
  churchInput: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontFamily: F.sansBold,
    fontSize: 15,
    color: C.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowSelected: { borderColor: C.primary, backgroundColor: C.primaryTint },
  check: { fontSize: 16, color: C.faint },
  rowName: { fontFamily: F.sansBold, fontSize: 13.5, color: C.ink },
  rowMeta: { fontFamily: F.sans, fontSize: 11.5, color: C.mut },
  ghost: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ghostLabel: { fontFamily: F.sansMedium, fontSize: 13.5, color: C.ink },
  primary: {
    flex: 2,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: { fontFamily: F.sansBold, fontSize: 13.5, color: '#fff' },
});
