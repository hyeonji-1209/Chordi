import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetMusic } from '@/components/SheetMusic';
import { C, F } from '@/constants/theme';
import { chipText, formToText, textToForm } from '@/lib/form';
import { semitonesBetween, shiftKey, transposeLine } from '@/lib/transpose';
import { useStore } from '@/store/useStore';
import type { FormChip } from '@/data/types';

export default function SheetScreen() {
  const { setlistId, songId } = useLocalSearchParams<{ setlistId: string; songId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const setlist = useStore((s) => s.setlistById(setlistId));
  const song = useStore((s) => s.songById(songId));
  const songById = useStore((s) => s.songById);
  const setItemKey = useStore((s) => s.setItemKey);
  const updateSongForm = useStore((s) => s.updateSongForm);

  const [editOpen, setEditOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<FormChip[]>([]);
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [formText, setFormText] = useState('');
  const [localKey, setLocalKey] = useState<string | null>(null); // 라이브러리 단독 보기용
  const [viewMode, setViewMode] = useState<'chart' | 'score'>('chart'); // 차트 ⇄ 오선보

  const item = setlist?.items.find((it) => it.songId === songId);
  const index = setlist?.items.findIndex((it) => it.songId === songId) ?? -1;

  const currentKey = useMemo(() => {
    if (item) return item.key.split('→')[0].trim();
    return localKey ?? song?.originalKey ?? 'C';
  }, [item, localKey, song]);

  const semitones = useMemo(
    () => (song ? semitonesBetween(song.originalKey, currentKey) : 0),
    [song, currentKey],
  );
  // 오선보 이조는 가까운 방향으로 (7반음 올림 대신 5반음 내림)
  const scoreTranspose = semitones > 6 ? semitones - 12 : semitones;

  if (!song) return null;

  const prev = setlist && index > 0 ? setlist.items[index - 1] : null;
  const next = setlist && index < setlist.items.length - 1 ? setlist.items[index + 1] : null;
  const prevSong = prev ? songById(prev.songId) : null;
  const nextSong = next ? songById(next.songId) : null;

  const changeKey = (delta: number) => {
    const nk = shiftKey(currentKey, delta);
    if (setlist && item) setItemKey(setlist.id, song.id, nk);
    else setLocalKey(nk);
  };

  const openEdit = () => {
    setDraftForm(song.form.map((c) => ({ ...c })));
    setFormText(formToText(song.form));
    setSelectedChip(null);
    setTextMode(false);
    setEditOpen(true);
  };

  const saveForm = () => {
    updateSongForm(song.id, textMode ? textToForm(formText) : draftForm);
    setEditOpen(false);
  };

  const updateChip = (id: string, patch: Partial<FormChip>) => {
    setDraftForm((f) => {
      const nf = f.map((c) => (c.id === id ? { ...c, ...patch } : c));
      setFormText(formToText(nf));
      return nf;
    });
  };

  const selected = draftForm.find((c) => c.id === selectedChip);

  return (
    <View style={{ flex: 1, backgroundColor: C.card, paddingTop: insets.top + 8 }}>
      {/* header */}
      <View style={st.header}>
        <Pressable style={st.back} onPress={() => router.back()}>
          <Text style={{ fontSize: 15, color: C.ink }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>{song.title}</Text>
          <Text style={st.headerSub}>
            {setlist ? `${index + 1} / ${setlist.items.length} · ${setlist.title}` : '라이브러리'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={st.keyBig}>{currentKey}</Text>
          <Text style={st.origKey}>원키 {song.originalKey}</Text>
        </View>
      </View>

      {/* form strip */}
      <View style={st.formStrip}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 5, alignItems: 'center' }}
        >
          {song.form.length === 0 && (
            <Text style={{ fontFamily: F.sans, fontSize: 11, color: C.faint }}>
              송폼이 없어요 — ✎ 로 추가
            </Text>
          )}
          {song.form.map((c) => {
            const active = !!c.repeat && c.repeat > 1;
            const gold = !!c.keyUp;
            return (
              <Text
                key={c.id}
                style={[st.formChip, active && st.formChipActive, gold && st.formChipGold]}
              >
                {chipText(c)}
              </Text>
            );
          })}
        </ScrollView>
        <Pressable onPress={openEdit} hitSlop={8}>
          <Text style={{ fontSize: 13, color: C.mut }}>✎</Text>
        </Pressable>
      </View>

      {/* score (오선보) */}
      {viewMode === 'score' && song.abc ? (
        <SheetMusic abc={song.abc} transpose={scoreTranspose} />
      ) : (
      /* chord chart */
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 20 }}>
        {song.sections.length === 0 && (
          <Text style={{ fontFamily: F.sans, fontSize: 13, color: C.mut }}>
            이 곡은 아직 코드차트가 없어요. 이미지/PDF 악보로 보관 중입니다.
          </Text>
        )}
        {song.sections.map((sec, si) => (
          <View key={`${sec.name}-${si}`} style={[{ gap: 2 }, sec.highlight && st.highlightSection]}>
            <Text style={[st.sectionName, sec.highlight && { color: C.primary }]}>
              {sec.name}
              {sec.badge ? ` · ${sec.badge}` : ''}
            </Text>
            {sec.lines.map((line, i) => (
              <View key={i}>
                <Text style={st.chords}>{transposeLine(line.chords, semitones, currentKey)}</Text>
                <Text style={st.lyrics}>{line.lyrics}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* memo */}
        {song.memo && (
          <View style={st.memo}>
            <Text style={st.memoLabel}>인도자</Text>
            <Text style={st.memoText}>{song.memo}</Text>
          </View>
        )}
      </ScrollView>
      )}

      {/* bottom toolbar */}
      <View style={[st.toolbar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={st.toolLabel}>KEY</Text>
          <Pressable style={st.keyBtn} onPress={() => changeKey(-1)}>
            <Text style={{ fontSize: 16, color: C.ink }}>−</Text>
          </Pressable>
          <Text style={st.keyCurrent}>{currentKey}</Text>
          <Pressable style={st.keyBtn} onPress={() => changeKey(1)}>
            <Text style={{ fontSize: 16, color: C.ink }}>＋</Text>
          </Pressable>
          {song.abc && (
            <View style={st.viewToggle}>
              <Pressable
                onPress={() => setViewMode('chart')}
                style={[st.viewToggleBtn, viewMode === 'chart' && st.viewToggleBtnActive]}
              >
                <Text style={[st.viewToggleLabel, viewMode === 'chart' && st.viewToggleLabelActive]}>
                  차트
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('score')}
                style={[st.viewToggleBtn, viewMode === 'score' && st.viewToggleBtnActive]}
              >
                <Text style={[st.viewToggleLabel, viewMode === 'score' && st.viewToggleLabelActive]}>
                  ♪ 악보
                </Text>
              </Pressable>
            </View>
          )}
        </View>
        {setlist && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              disabled={!prevSong}
              onPress={() => prevSong && router.replace(`/sheet/${setlist.id}/${prevSong.id}`)}
              style={[st.navBtn, !prevSong && { opacity: 0.4 }]}
            >
              <Text style={st.navBtnLabel} numberOfLines={1}>
                ‹ {prevSong?.title ?? '첫 곡'}
              </Text>
            </Pressable>
            <Pressable
              disabled={!nextSong}
              onPress={() => nextSong && router.replace(`/sheet/${setlist.id}/${nextSong.id}`)}
              style={[st.navBtn, st.navBtnDark, !nextSong && { opacity: 0.4 }]}
            >
              <Text style={[st.navBtnLabel, { color: '#fff' }]} numberOfLines={1}>
                {nextSong?.title ?? '마지막 곡'} ›
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Song Form Edit bottom sheet ── */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <Pressable style={st.dim} onPress={() => setEditOpen(false)} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 26 }]}>
          <View style={st.grabber} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={st.sheetTitle}>Song Form</Text>
            <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.mut }}>{song.title}</Text>
            {/* toggle */}
            <View style={st.toggle}>
              <Pressable onPress={() => setTextMode(false)} style={[st.toggleBtn, !textMode && st.toggleBtnActive]}>
                <Text style={[st.toggleLabel, !textMode && st.toggleLabelActive]}>칩</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setFormText(formToText(draftForm));
                  setTextMode(true);
                }}
                style={[st.toggleBtn, textMode && st.toggleBtnActive]}
              >
                <Text style={[st.toggleLabel, textMode && st.toggleLabelActive]}>텍스트</Text>
              </Pressable>
            </View>
          </View>

          {!textMode ? (
            <>
              {/* chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {draftForm.map((c) => {
                  const isSel = selectedChip === c.id;
                  const gold = !!c.keyUp;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedChip(isSel ? null : c.id)}
                      style={[st.editChip, gold && st.editChipGold, isSel && st.editChipSel]}
                    >
                      <Text style={[st.editChipLabel, gold && { color: C.goldDark }, isSel && { color: '#fff' }]}>
                        {chipText(c)}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={st.addChip}
                  onPress={() => {
                    const nc = { id: `n-${Date.now()}`, label: 'C' };
                    setDraftForm((f) => [...f, nc]);
                    setSelectedChip(nc.id);
                  }}
                >
                  <Text style={{ fontFamily: F.mono, fontSize: 12.5, color: C.mut }}>＋</Text>
                </Pressable>
              </View>
              <Text style={st.sheetHint}>칩을 탭하면 반복(×2)과 키 올림(↑) 설정</Text>

              {/* selected chip options */}
              {selected && (
                <View style={st.chipOptions}>
                  <Text style={st.chipOptionsTitle}>선택됨: {selected.label}</Text>
                  <View style={st.optionRow}>
                    <Text style={st.optionLabel}>반복</Text>
                    <View style={st.segment}>
                      {[1, 2, 3].map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => updateChip(selected.id, { repeat: n === 1 ? undefined : n })}
                          style={[st.segmentBtn, (selected.repeat ?? 1) === n && st.segmentBtnActive]}
                        >
                          <Text style={[st.segmentLabel, (selected.repeat ?? 1) === n && st.segmentLabelActive]}>
                            ×{n}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={st.optionRow}>
                    <Text style={st.optionLabel}>키 올림</Text>
                    <View style={st.segment}>
                      {[0, 1, 2].map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => updateChip(selected.id, { keyUp: n === 0 ? undefined : n })}
                          style={[st.segmentBtn, (selected.keyUp ?? 0) === n && st.segmentBtnActive]}
                        >
                          <Text style={[st.segmentLabel, (selected.keyUp ?? 0) === n && st.segmentLabelActive]}>
                            {n === 0 ? '없음' : `↑${n}`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      style={{ marginLeft: 'auto' }}
                      onPress={() => {
                        setDraftForm((f) => f.filter((c) => c.id !== selected.id));
                        setSelectedChip(null);
                      }}
                    >
                      <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.mut }}>삭제</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={st.textModeBox}>
              <Text style={st.textModeLabel}>텍스트</Text>
              <TextInput
                style={st.textModeInput}
                value={formText}
                onChangeText={(t) => {
                  setFormText(t);
                  setDraftForm(textToForm(t));
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={st.syncLabel}>양방향 동기화</Text>
            </View>
          )}

          <Pressable
            onPress={saveForm}
            style={({ pressed }) => [st.saveBtn, pressed && { backgroundColor: C.primaryDark }]}
          >
            <Text style={st.saveLabel}>저장 — 팀에게도 반영</Text>
          </Pressable>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: F.serif, fontSize: 16.5, color: C.ink },
  headerSub: { fontFamily: F.sans, fontSize: 11, color: C.mut },
  keyBig: {
    fontFamily: F.mono,
    fontWeight: '700',
    fontSize: 13,
    backgroundColor: C.primary,
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
    overflow: 'hidden',
  },
  origKey: { fontFamily: F.sans, fontSize: 11, color: C.mut },
  formStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  formChip: {
    fontFamily: F.mono,
    fontWeight: '600',
    fontSize: 11,
    color: C.mut,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  formChipActive: {
    color: '#fff',
    backgroundColor: C.primary,
    borderColor: C.primary,
    fontWeight: '700',
  },
  formChipGold: { color: C.goldDark, backgroundColor: C.goldBg, borderColor: C.goldBorder },
  sectionName: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: C.mut,
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  highlightSection: {
    backgroundColor: C.primaryTint,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: -12,
  },
  chords: { fontFamily: F.mono, fontWeight: '700', fontSize: 13.5, lineHeight: 20, color: C.primary },
  lyrics: { fontFamily: F.sans, fontSize: 14.5, lineHeight: 22, color: C.ink },
  memo: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: C.goldBg,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  memoLabel: { fontFamily: F.sansBold, fontSize: 11, color: C.goldDark, marginTop: 1 },
  memoText: { flex: 1, fontFamily: F.sans, fontSize: 12.5, lineHeight: 19, color: C.memoText },
  toolbar: {
    borderTopWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  toolLabel: { fontFamily: F.sansBold, fontSize: 12, color: C.mut },
  keyBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyCurrent: {
    fontFamily: F.mono,
    fontWeight: '700',
    fontSize: 16,
    color: C.primary,
    minWidth: 30,
    textAlign: 'center',
  },
  viewToggle: {
    marginLeft: 'auto',
    flexDirection: 'row',
    backgroundColor: '#F0EDE5',
    borderRadius: 999,
    padding: 3,
  },
  viewToggleBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  viewToggleBtnActive: { backgroundColor: C.primary },
  viewToggleLabel: { fontFamily: F.sansMedium, fontSize: 11.5, color: C.mut },
  viewToggleLabelActive: { fontFamily: F.sansBold, color: '#fff' },
  navBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navBtnDark: { backgroundColor: C.ink, borderColor: C.ink },
  navBtnLabel: { fontFamily: F.sansBold, fontSize: 13, color: C.ink },
  // bottom sheet
  dim: { flex: 1, backgroundColor: 'rgba(38,36,31,.45)' },
  sheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  grabber: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: C.dim,
    alignSelf: 'center',
  },
  sheetTitle: { fontFamily: F.serif, fontSize: 17, color: C.ink },
  toggle: {
    marginLeft: 'auto',
    flexDirection: 'row',
    backgroundColor: '#F0EDE5',
    borderRadius: 999,
    padding: 3,
  },
  toggleBtn: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 5 },
  toggleBtnActive: { backgroundColor: C.primary },
  toggleLabel: { fontFamily: F.sansMedium, fontSize: 11.5, color: C.mut },
  toggleLabelActive: { fontFamily: F.sansBold, color: '#fff' },
  editChip: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  editChipGold: { backgroundColor: C.goldBg, borderColor: C.goldBorder },
  editChipSel: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  editChipLabel: { fontFamily: F.mono, fontWeight: '600', fontSize: 12.5, color: C.ink },
  addChip: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.faint,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHint: { fontFamily: F.sans, fontSize: 11.5, lineHeight: 18, color: C.mut },
  chipOptions: {
    backgroundColor: C.primaryTint,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  chipOptionsTitle: { fontFamily: F.sansBold, fontSize: 12.5, color: C.primary },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionLabel: { fontFamily: F.sans, fontSize: 12, color: C.ink, width: 52 },
  segment: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.primaryBorder,
    borderRadius: 999,
    padding: 2,
  },
  segmentBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  segmentBtnActive: { backgroundColor: C.primary },
  segmentLabel: { fontFamily: F.sans, fontSize: 11.5, color: C.mut },
  segmentLabelActive: { fontFamily: F.sansBold, color: '#fff' },
  textModeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: C.bg,
  },
  textModeLabel: { fontFamily: F.sansBold, fontSize: 11, color: C.mut },
  textModeInput: { flex: 1, fontFamily: F.mono, fontWeight: '600', fontSize: 12, color: C.ink, paddingVertical: 8 },
  syncLabel: { fontFamily: F.sansMedium, fontSize: 11, color: C.primary },
  saveBtn: {
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
  saveLabel: { fontFamily: F.sansBold, fontSize: 14.5, color: '#fff' },
});
