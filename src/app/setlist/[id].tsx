import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '@/constants/theme';
import { editSetlist } from '@/lib/ai';
import type { SetlistItem } from '@/data/types';
import { useStore } from '@/store/useStore';

export default function SetlistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setlist = useStore((s) => s.setlistById(id));
  const songs = useStore((s) => s.songs);
  const songById = useStore((s) => s.songById);
  const applySetlistEdits = useStore((s) => s.applySetlistEdits);
  const updateSetlistItems = useStore((s) => s.updateSetlistItems);

  const [editOpen, setEditOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SetlistItem[] | null>(null); // 수정 모드 (null = 보기)
  const [addOpen, setAddOpen] = useState(false);

  if (!setlist) return null;

  const editMode = draft !== null;

  const startEdit = () => setDraft(setlist.items.map((it) => ({ ...it })));
  const finishEdit = () => {
    if (draft && draft.length > 0) updateSetlistItems(setlist.id, draft);
    else if (draft && draft.length === 0) {
      Alert.alert('확인', '곡이 하나도 없어요. 콘티를 비울 수는 없어요.');
      return;
    }
    setDraft(null);
  };
  const moveItem = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeItem = (i: number) => setDraft((d) => d?.filter((_, k) => k !== i) ?? d);
  const addSongToDraft = (songId: string, key: string) => {
    setDraft((d) => (d ? [...d, { songId, key }] : d));
    setAddOpen(false);
  };

  const share = () => {
    const lines = setlist.items.map((it, i) => {
      const song = songById(it.songId);
      const extra = [it.note, it.linkedToPrev ? '앞 곡과 이어서' : null].filter(Boolean).join(' · ');
      return `${i + 1}. ${song?.title ?? ''} (${it.key})${extra ? ` — ${extra}` : ''}`;
    });
    Share.share({ message: `${setlist.title}\n${setlist.subtitle}\n\n${lines.join('\n')}` });
  };

  const runEdit = async () => {
    const cmd = command.trim();
    if (!cmd) return;
    setEditing(true);
    try {
      const edit = await editSetlist(setlist, songs, cmd);
      applySetlistEdits(setlist.id, edit);
      setEditOpen(false);
      setCommand('');
      Alert.alert('수정 완료', edit.summary);
    } catch (e) {
      Alert.alert('수정 실패', e instanceof Error ? e.message : '알 수 없는 오류가 발생했어요.');
    } finally {
      setEditing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8 }}>
      {/* header */}
      <View style={st.header}>
        <Pressable style={st.back} onPress={() => router.back()}>
          <Text style={{ fontSize: 16, color: C.ink }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>{setlist.title}</Text>
          <Text style={st.headerSub}>{setlist.subtitle}</Text>
        </View>
        <Pressable
          style={[st.shareBtn, editMode && { backgroundColor: C.primary, borderColor: C.primary }]}
          onPress={editMode ? finishEdit : startEdit}
        >
          <Text style={[st.shareLabel, editMode && { color: '#fff', fontFamily: F.sansBold }]}>
            {editMode ? '완료' : '수정'}
          </Text>
        </Pressable>
        {!editMode && (
          <Pressable style={st.shareBtn} onPress={share}>
            <Text style={st.shareLabel}>공유</Text>
          </Pressable>
        )}
      </View>

      {/* AI edit pill */}
      {!editMode && (
      <Pressable style={st.voicePill} onPress={() => setEditOpen(true)}>
        <Text style={{ color: C.goldDark, fontSize: 14 }}>✦</Text>
        <Text style={st.voiceText}>"2번곡 한 키 내려줘" 처럼 말로 수정</Text>
      </Pressable>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}>
        {(editMode ? draft! : setlist.items).map((item, i) => {
          const song = songById(item.songId);
          if (!song) return null;
          return (
            <View key={`${item.songId}-${i}`}>
              {item.linkedToPrev && !editMode && (
                <View style={st.linkRow}>
                  <Text style={st.linkChip}>⛓ 간주 없이 이어서</Text>
                </View>
              )}
              <Pressable
                disabled={editMode}
                onPress={() => router.push(`/sheet/${setlist.id}/${song.id}`)}
                style={({ pressed }) => [
                  st.songCard,
                  i > 0 && (!item.linkedToPrev || editMode) && { marginTop: 8 },
                  pressed && !editMode && { borderColor: C.primary },
                ]}
              >
                {!editMode && <Text style={st.dragHandle}>⠿</Text>}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={st.songTitle}>
                    {i + 1}. {song.title}
                  </Text>
                  {item.subNote && <Text style={st.subNote}>{item.subNote}</Text>}
                  {item.note && <Text style={st.note}>{item.note}</Text>}
                </View>
                {editMode ? (
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <Pressable style={st.editBtn} onPress={() => moveItem(i, -1)}>
                      <Text style={st.editBtnLabel}>↑</Text>
                    </Pressable>
                    <Pressable style={st.editBtn} onPress={() => moveItem(i, 1)}>
                      <Text style={st.editBtnLabel}>↓</Text>
                    </Pressable>
                    <Pressable style={[st.editBtn, { borderColor: '#D08770' }]} onPress={() => removeItem(i)}>
                      <Text style={[st.editBtnLabel, { color: '#C0563C' }]}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={st.key}>{item.key}</Text>
                )}
              </Pressable>
            </View>
          );
        })}
        {editMode && (
          <Pressable style={st.addSongBtn} onPress={() => setAddOpen(true)}>
            <Text style={st.addSongLabel}>＋ 라이브러리에서 곡 추가</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* play mode */}
      {!editMode && (
      <View style={[st.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          onPress={() => router.push(`/sheet/${setlist.id}/${setlist.items[0].songId}`)}
          style={({ pressed }) => [st.playBtn, pressed && { backgroundColor: '#3a372f' }]}
        >
          <Text style={st.playLabel}>▶ 연주 모드</Text>
        </Pressable>
      </View>
      )}

      {/* 곡 추가 모달 */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={st.dim} onPress={() => setAddOpen(false)} />
        <View style={[st.modalCard, { maxHeight: '60%' }]}>
          <Text style={st.modalTitle}>곡 추가</Text>
          <ScrollView contentContainerStyle={{ gap: 6 }}>
            {songs
              .filter((sg) => sg.teamId === setlist.teamId && !draft?.some((it) => it.songId === sg.id))
              .map((sg) => (
                <Pressable
                  key={sg.id}
                  style={st.addRow}
                  onPress={() => addSongToDraft(sg.id, sg.originalKey)}
                >
                  <Text style={st.addRowTitle}>{sg.title}</Text>
                  <Text style={st.addRowKey}>{sg.originalKey}</Text>
                </Pressable>
              ))}
            {songs.filter((sg) => sg.teamId === setlist.teamId && !draft?.some((it) => it.songId === sg.id))
              .length === 0 && (
              <Text style={{ fontFamily: F.sans, fontSize: 12.5, color: C.mut, textAlign: 'center', padding: 16 }}>
                추가할 수 있는 곡이 없어요 — Songs 탭에서 악보를 먼저 올려주세요
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* AI edit modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={st.dim} onPress={() => !editing && setEditOpen(false)} />
        <View style={st.modalCard}>
          <Text style={st.modalTitle}>
            <Text style={{ color: C.goldDark }}>✦ </Text>말로 수정
          </Text>
          <TextInput
            style={st.modalInput}
            placeholder='예: "2번곡 한 키 내려줘", "마지막 곡 후렴 2번 반복"'
            placeholderTextColor={C.faint}
            value={command}
            onChangeText={setCommand}
            autoFocus
            editable={!editing}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={st.modalGhost} disabled={editing} onPress={() => setEditOpen(false)}>
              <Text style={st.modalGhostLabel}>취소</Text>
            </Pressable>
            <Pressable style={st.modalPrimary} disabled={editing} onPress={runEdit}>
              {editing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={st.modalPrimaryLabel}>수정하기</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
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
  shareBtn: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shareLabel: { fontFamily: F.sansMedium, fontSize: 12, color: C.ink },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
    backgroundColor: C.primaryTint,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  voiceText: { fontFamily: F.sans, fontSize: 13, color: C.primaryText },
  linkRow: { alignItems: 'center', marginVertical: 2, zIndex: 1 },
  linkChip: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: C.goldDark,
    backgroundColor: C.goldBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dragHandle: { fontSize: 14, color: '#C9C4B8', letterSpacing: 1 },
  songTitle: { fontFamily: F.sansBold, fontSize: 14.5, color: C.ink },
  subNote: { fontFamily: F.sans, fontSize: 11.5, color: C.mut },
  note: { fontFamily: F.sansBold, fontSize: 11.5, color: C.goldDark },
  key: {
    fontFamily: F.mono,
    fontWeight: '600',
    fontSize: 12,
    backgroundColor: C.primaryTint,
    color: C.primary,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
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
  playBtn: { backgroundColor: C.ink, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnLabel: { fontSize: 14, color: C.ink },
  addSongBtn: {
    marginTop: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.primary,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
  },
  addSongLabel: { fontFamily: F.sansBold, fontSize: 13, color: C.primary },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  addRowTitle: { flex: 1, fontFamily: F.sansMedium, fontSize: 13.5, color: C.ink },
  addRowKey: { fontFamily: F.mono, fontWeight: '600', fontSize: 11.5, color: C.mut },
  playLabel: { fontFamily: F.sansBold, fontSize: 15, color: '#fff' },
  dim: { flex: 1, backgroundColor: 'rgba(38,36,31,.45)' },
  modalCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '28%',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontFamily: F.serif, fontSize: 16.5, color: C.ink },
  modalInput: {
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: F.sans,
    fontSize: 14,
    lineHeight: 21,
    color: C.ink,
    backgroundColor: C.bg,
    minHeight: 66,
    textAlignVertical: 'top',
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
