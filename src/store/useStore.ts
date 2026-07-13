import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Alert } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  createTeamRemote,
  deleteSetlistRemote,
  deleteSongRemote,
  fetchAll,
  joinTeamRemote,
  patchItemRemote,
  patchSongRemote,
  upsertSetlistRemote,
  upsertSongRemote,
} from '@/lib/db';
import { stringsToForm } from '@/lib/form';
import { supabaseEnabled } from '@/lib/supabase';
import type {
  AiSetlistEdit,
  AiSetlistResult,
  AiSongAnalysis,
  FormChip,
  Setlist,
  Song,
  Team,
} from '@/data/types';

type AiDraft = {
  images: { uri: string; base64: string; mediaType: string }[];
  prompt: string;
  targetTeamId: string | null; // 콘티를 올릴 팀 (예배) — 팀이 여러 개면 선택
  result: AiSetlistResult | null;
  loading: boolean;
  error: string | null;
};

const EMPTY_DRAFT: AiDraft = {
  images: [],
  prompt: '',
  targetTeamId: null,
  result: null,
  loading: false,
  error: null,
};

function newInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const SEED_TEAM: Team = {
  id: 'team-1',
  name: '내 찬양팀',
  color: '#3E4C8E',
  myRole: '인도자',
  inviteCode: newInviteCode(),
  members: [{ id: 'me', name: '나', roles: '인도자', leader: true }],
};

const ME = 'me';

/** 서버 모드면 UUID, 로컬 모드면 접두사 id */
function genId(prefix: string): string {
  return supabaseEnabled ? Crypto.randomUUID() : `${prefix}-${Date.now()}`;
}

/** 서버 반영 (실패는 로그만 — 로컬 상태가 우선) */
function push(work: () => Promise<unknown>) {
  if (!supabaseEnabled) return;
  work().catch((e) => console.warn('서버 반영 실패:', e?.message ?? e));
}

type Store = {
  teams: Team[];
  currentTeamId: string;
  songs: Song[];
  setlists: Setlist[];
  aiDraft: AiDraft;
  currentUserId: string | null; // 로그인 사용자 (서버 모드)
  synced: boolean; // 서버 동기화 완료 여부 (팀 온보딩 판단용)

  setCurrentUser: (userId: string) => void;
  setSynced: (on: boolean) => void;
  initFromServer: () => Promise<void>; // 서버 데이터로 교체
  meId: () => string;

  currentTeam: () => Team;
  songById: (id: string) => Song | undefined;
  setlistById: (id: string) => Setlist | undefined;

  switchTeam: (teamId: string) => void;
  addTeam: (name: string) => void;
  joinTeam: (code: string) => void;

  transcribing: Record<string, boolean>; // songId → 오선보 생성 중 (비영속)

  addSong: (analysis: AiSongAnalysis) => Song;
  updateSong: (songId: string, patch: Partial<Pick<Song, 'title' | 'originalKey'>>) => void;
  deleteSong: (songId: string) => void;
  deleteSetlist: (setlistId: string) => void;
  canEditSong: (songId: string) => boolean; // 올린 사람만 수정·삭제
  setSongAbc: (songId: string, abc: string) => void; // 백그라운드 필사 완료 시 악보 부착
  setTranscribing: (songId: string, on: boolean) => void;
  setItemKey: (setlistId: string, songId: string, key: string) => void;
  updateSongForm: (songId: string, form: FormChip[]) => void;
  applySetlistEdits: (setlistId: string, edit: AiSetlistEdit) => void;

  setAiImages: (images: AiDraft['images']) => void;
  setAiPrompt: (prompt: string) => void;
  setAiTargetTeam: (teamId: string) => void;
  aiTargetTeam: () => Team; // 콘티를 올릴 팀 (미선택 시 현재 팀)
  setAiLoading: (loading: boolean) => void;
  setAiResult: (result: AiSetlistResult | null, error?: string | null) => void;
  resolveAiSong: (index: number, title: string) => void;
  /** 같은 제목(같은 예배) 콘티가 이미 있으면 id 반환 */
  findDuplicateSetlist: () => Setlist | undefined;
  confirmAiSetlist: (replace?: boolean) => string; // returns new setlist id
  resetAll: () => void; // 모든 데이터 초기화 (개발/테스트용)
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      teams: [SEED_TEAM],
      currentTeamId: SEED_TEAM.id,
      songs: [],
      setlists: [],
      aiDraft: EMPTY_DRAFT,
      transcribing: {},
      currentUserId: null,
      synced: false,

      setCurrentUser: (userId) => set({ currentUserId: userId }),
      setSynced: (on) => set({ synced: on }),
      meId: () => get().currentUserId ?? ME,

      initFromServer: async () => {
        if (!supabaseEnabled) return;
        // 로그인 직후 서버 시계 오차(PGRST303 등)로 실패할 수 있어 재시도
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const data = await fetchAll();
            const keepCurrent = data.teams.find((t) => t.id === get().currentTeamId);
            set({
              teams: data.teams,
              songs: data.songs,
              setlists: data.setlists,
              currentTeamId: keepCurrent?.id ?? data.teams[0]?.id ?? '',
              synced: true,
            });
            console.log(`서버 동기화 완료 (팀 ${data.teams.length} · 곡 ${data.songs.length})`);
            return;
          } catch (e) {
            console.warn(`서버 동기화 실패 (${attempt}/4):`, e instanceof Error ? e.message : e);
            if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 2000));
          }
        }
      },

      currentTeam: () => {
        const { teams, currentTeamId } = get();
        return teams.find((t) => t.id === currentTeamId) ?? teams[0];
      },
      songById: (id) => get().songs.find((s) => s.id === id),
      setlistById: (id) => get().setlists.find((s) => s.id === id),

      switchTeam: (teamId) => set({ currentTeamId: teamId }),

      addTeam: (name) => {
        if (supabaseEnabled) {
          (async () => {
            try {
              const id = await createTeamRemote(name);
              await get().initFromServer();
              set({ currentTeamId: id });
            } catch (e) {
              Alert.alert('팀 생성 실패', e instanceof Error ? e.message : '오류가 발생했어요');
            }
          })();
          return;
        }
        const team: Team = {
          id: `team-${Date.now()}`,
          name,
          color: '#B98A2F',
          myRole: '인도자',
          inviteCode: newInviteCode(),
          members: [{ id: ME, name: '나', roles: '인도자', leader: true }],
        };
        set((st) => ({ teams: [...st.teams, team], currentTeamId: team.id }));
      },

      joinTeam: (code) => {
        if (supabaseEnabled) {
          (async () => {
            try {
              const id = await joinTeamRemote(code);
              await get().initFromServer();
              set({ currentTeamId: id });
            } catch (e) {
              Alert.alert(
                '입장 실패',
                e instanceof Error && e.message.includes('초대코드')
                  ? '초대코드가 올바르지 않아요'
                  : '오류가 발생했어요',
              );
            }
          })();
          return;
        }
        const team: Team = {
          id: `team-${Date.now()}`,
          name: `팀 ${code.toUpperCase()}`,
          color: '#8A857A',
          myRole: '멤버',
          inviteCode: code.toUpperCase(),
          members: [{ id: ME, name: '나', roles: '멤버' }],
        };
        set((st) => ({ teams: [...st.teams, team], currentTeamId: team.id }));
      },

      addSong: (a) => {
        const st = get();
        const existing = st.songs.find(
          (s) => s.teamId === st.currentTeamId && s.title === a.title,
        );
        const song: Song = {
          id: existing?.id ?? genId('song'),
          teamId: st.currentTeamId,
          title: a.title,
          originalKey: a.originalKey,
          bpm: a.bpm ?? undefined,
          tags: a.tags,
          source: 'image',
          sourceLabel: a.sections.length
            ? `AI 인식 코드차트 · 이조 가능${a.bpm ? ` · ${a.bpm} BPM` : ''}`
            : '이미지 악보 · 원본 키 표시만',
          form: stringsToForm(a.form),
          sections: a.sections,
          abc: a.abc ?? undefined,
          uploadedBy: existing?.uploadedBy ?? get().meId(),
        };
        set({
          songs: existing
            ? st.songs.map((s) => (s.id === existing.id ? song : s)) // 같은 제목이면 새 분석으로 갱신
            : [song, ...st.songs],
        });
        push(() => upsertSongRemote(song));
        return song;
      },

      updateSong: (songId, patch) => {
        set((st) => ({
          songs: st.songs.map((s) => (s.id === songId ? { ...s, ...patch } : s)),
        }));
        push(() =>
          patchSongRemote(songId, {
            ...(patch.title !== undefined && { title: patch.title }),
            ...(patch.originalKey !== undefined && { original_key: patch.originalKey }),
          }),
        );
      },

      deleteSong: (songId) => {
        set((st) => ({
          songs: st.songs.filter((s) => s.id !== songId),
          // 콘티에서도 해당 곡 제거
          setlists: st.setlists.map((sl) => ({
            ...sl,
            items: sl.items.filter((it) => it.songId !== songId),
          })),
        }));
        push(() => deleteSongRemote(songId));
      },

      deleteSetlist: (setlistId) => {
        set((st) => ({ setlists: st.setlists.filter((sl) => sl.id !== setlistId) }));
        push(() => deleteSetlistRemote(setlistId));
      },

      canEditSong: (songId) => {
        const song = get().songById(songId);
        if (!song) return false;
        return (song.uploadedBy ?? get().meId()) === get().meId(); // 올린 사람만
      },

      setSongAbc: (songId, abc) => {
        set((st) => ({
          songs: st.songs.map((s) => (s.id === songId ? { ...s, abc } : s)),
        }));
        push(() => patchSongRemote(songId, { abc }));
      },

      setTranscribing: (songId, on) =>
        set((st) => {
          const next = { ...st.transcribing };
          if (on) next[songId] = true;
          else delete next[songId];
          return { transcribing: next };
        }),

      setItemKey: (setlistId, songId, key) => {
        set((st) => ({
          setlists: st.setlists.map((sl) =>
            sl.id !== setlistId
              ? sl
              : {
                  ...sl,
                  items: sl.items.map((it) => (it.songId === songId ? { ...it, key } : it)),
                },
          ),
        }));
        push(() => patchItemRemote(setlistId, songId, { key }));
      },

      updateSongForm: (songId, form) => {
        set((st) => ({
          songs: st.songs.map((s) => (s.id === songId ? { ...s, form } : s)),
        }));
        push(() => patchSongRemote(songId, { form }));
      },

      applySetlistEdits: (setlistId, edit) => {
        set((st) => ({
          setlists: st.setlists.map((sl) => {
            if (sl.id !== setlistId) return sl;
            return {
              ...sl,
              items: sl.items.map((it) => {
                const patch = edit.items.find((e) => e.songId === it.songId);
                if (!patch) return it;
                return {
                  ...it,
                  key: patch.key,
                  note: patch.note ?? undefined,
                  linkedToPrev: patch.linkedToPrev,
                };
              }),
            };
          }),
        }));
        push(async () => {
          for (const it of edit.items) {
            await patchItemRemote(setlistId, it.songId, {
              key: it.key,
              note: it.note,
              linked_to_prev: it.linkedToPrev,
            });
          }
        });
      },

      setAiImages: (images) => set((st) => ({ aiDraft: { ...st.aiDraft, images } })),
      setAiPrompt: (prompt) => set((st) => ({ aiDraft: { ...st.aiDraft, prompt } })),
      setAiTargetTeam: (teamId) =>
        set((st) => ({ aiDraft: { ...st.aiDraft, targetTeamId: teamId } })),
      aiTargetTeam: () => {
        const st = get();
        return (
          st.teams.find((t) => t.id === st.aiDraft.targetTeamId) ?? st.currentTeam()
        );
      },
      setAiLoading: (loading) =>
        set((st) => ({ aiDraft: { ...st.aiDraft, loading, error: null } })),
      setAiResult: (result, error = null) =>
        set((st) => ({ aiDraft: { ...st.aiDraft, result, error, loading: false } })),

      resolveAiSong: (index, title) =>
        set((st) => {
          if (!st.aiDraft.result) return st;
          return {
            aiDraft: {
              ...st.aiDraft,
              result: {
                ...st.aiDraft.result,
                songs: st.aiDraft.result.songs.map((s) =>
                  s.index === index ? { ...s, title, uncertain: false, question: null } : s,
                ),
              },
            },
          };
        }),

      findDuplicateSetlist: () => {
        const st = get();
        const title = st.aiDraft.result?.title;
        if (!title) return undefined;
        const team = st.aiTargetTeam();
        return st.setlists.find((sl) => sl.teamId === team.id && sl.title === title);
      },

      confirmAiSetlist: (replace = false) => {
        const st = get();
        const result = st.aiDraft.result;
        if (!result) return '';

        const team = st.aiTargetTeam(); // 콘티를 올릴 팀 (예배)
        const leader = team.members.find((m) => m.leader)?.name ?? team.members[0]?.name ?? '';
        const newSongs: Song[] = [];
        const updatedSongs = new Map<string, Song>();

        const items = result.songs.map((ai) => {
          const title = ai.title ?? ai.titleGuess ?? `악보 ${ai.index + 1}`;
          let song = st.songs.find((s) => s.teamId === team.id && s.title === title);
          if (song) {
            // 같은 제목 곡이 있으면 이번에 새로 읽은 차트/송폼/악보로 갱신
            song = {
              ...song,
              originalKey: ai.originalKey ?? song.originalKey,
              form: ai.form.length ? stringsToForm(ai.form) : song.form,
              sections: ai.sections.length ? ai.sections : song.sections,
              abc: ai.abc ?? song.abc,
            };
            updatedSongs.set(song.id, song);
          } else {
            song = {
              id: genId('song'),
              teamId: team.id,
              title,
              originalKey: ai.originalKey ?? ai.targetKey,
              tags: [],
              source: 'image',
              sourceLabel: ai.sections.length
                ? 'AI 인식 코드차트 · 이조 가능'
                : '이미지 악보 · 원본 키 표시만',
              form: stringsToForm(ai.form),
              sections: ai.sections,
              abc: ai.abc ?? undefined,
              uploadedBy: get().meId(),
            };
            newSongs.push(song);
          }
          return {
            songId: song.id,
            key: ai.targetKey,
            note: ai.notes[0],
            linkedToPrev: ai.linkedToPrev,
          };
        });

        const setlist: Setlist = {
          id: genId('sl'),
          teamId: team.id,
          title: result.title,
          subtitle: `${team.name} · 인도 ${leader} · ${items.length}곡`,
          leader,
          items,
        };

        // 같은 제목(같은 예배) 콘티 교체
        const dup = st.setlists.find((sl) => sl.teamId === team.id && sl.title === setlist.title);
        const remaining = replace ? st.setlists.filter((sl) => sl.id !== dup?.id) : st.setlists;

        set({
          songs: [...newSongs, ...st.songs.map((s) => updatedSongs.get(s.id) ?? s)],
          setlists: [setlist, ...remaining],
          aiDraft: EMPTY_DRAFT,
        });

        const me = get().meId();
        push(async () => {
          for (const song of [...newSongs, ...updatedSongs.values()]) {
            await upsertSongRemote(song);
          }
          await upsertSetlistRemote(setlist, me, replace ? dup?.id : undefined);
        });

        return setlist.id;
      },

      resetAll: () => {
        if (supabaseEnabled) {
          // 서버 모드: 로컬 캐시를 버리고 서버 데이터로 새로 받기
          get().initFromServer();
          return;
        }
        // 로컬 모드: 저장소 파일을 지우고 시드로 리셋
        AsyncStorage.removeItem('chordi-store').catch(() => {});
        set({
          teams: [SEED_TEAM],
          currentTeamId: SEED_TEAM.id,
          songs: [],
          setlists: [],
          aiDraft: EMPTY_DRAFT,
        });
      },
    }),
    {
      name: 'chordi-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (st) => ({
        teams: st.teams,
        currentTeamId: st.currentTeamId,
        songs: st.songs,
        setlists: st.setlists,
      }),
    },
  ),
);
