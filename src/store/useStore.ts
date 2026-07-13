import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { stringsToForm } from '@/lib/form';
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
  result: AiSetlistResult | null;
  loading: boolean;
  error: string | null;
};

const EMPTY_DRAFT: AiDraft = { images: [], prompt: '', result: null, loading: false, error: null };

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

type Store = {
  teams: Team[];
  currentTeamId: string;
  songs: Song[];
  setlists: Setlist[];
  aiDraft: AiDraft;

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

      currentTeam: () => {
        const { teams, currentTeamId } = get();
        return teams.find((t) => t.id === currentTeamId) ?? teams[0];
      },
      songById: (id) => get().songs.find((s) => s.id === id),
      setlistById: (id) => get().setlists.find((s) => s.id === id),

      switchTeam: (teamId) => set({ currentTeamId: teamId }),

      addTeam: (name) => {
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
          id: existing?.id ?? `song-${Date.now()}`,
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
          uploadedBy: existing?.uploadedBy ?? ME,
        };
        set({
          songs: existing
            ? st.songs.map((s) => (s.id === existing.id ? song : s)) // 같은 제목이면 새 분석으로 갱신
            : [song, ...st.songs],
        });
        return song;
      },

      updateSong: (songId, patch) =>
        set((st) => ({
          songs: st.songs.map((s) => (s.id === songId ? { ...s, ...patch } : s)),
        })),

      deleteSong: (songId) =>
        set((st) => ({
          songs: st.songs.filter((s) => s.id !== songId),
          // 콘티에서도 해당 곡 제거
          setlists: st.setlists.map((sl) => ({
            ...sl,
            items: sl.items.filter((it) => it.songId !== songId),
          })),
        })),

      deleteSetlist: (setlistId) =>
        set((st) => ({ setlists: st.setlists.filter((sl) => sl.id !== setlistId) })),

      canEditSong: (songId) => {
        const song = get().songById(songId);
        if (!song) return false;
        return (song.uploadedBy ?? ME) === ME; // 올린 사람만 (예전 데이터는 내가 올린 것으로 간주)
      },

      setSongAbc: (songId, abc) =>
        set((st) => ({
          songs: st.songs.map((s) => (s.id === songId ? { ...s, abc } : s)),
        })),

      setTranscribing: (songId, on) =>
        set((st) => {
          const next = { ...st.transcribing };
          if (on) next[songId] = true;
          else delete next[songId];
          return { transcribing: next };
        }),

      setItemKey: (setlistId, songId, key) =>
        set((st) => ({
          setlists: st.setlists.map((sl) =>
            sl.id !== setlistId
              ? sl
              : {
                  ...sl,
                  items: sl.items.map((it) => (it.songId === songId ? { ...it, key } : it)),
                },
          ),
        })),

      updateSongForm: (songId, form) =>
        set((st) => ({
          songs: st.songs.map((s) => (s.id === songId ? { ...s, form } : s)),
        })),

      applySetlistEdits: (setlistId, edit) =>
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
        })),

      setAiImages: (images) => set((st) => ({ aiDraft: { ...st.aiDraft, images } })),
      setAiPrompt: (prompt) => set((st) => ({ aiDraft: { ...st.aiDraft, prompt } })),
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
        return st.setlists.find((sl) => sl.teamId === st.currentTeamId && sl.title === title);
      },

      confirmAiSetlist: (replace = false) => {
        const st = get();
        const result = st.aiDraft.result;
        if (!result) return '';

        const team = st.currentTeam();
        const leader = team.members.find((m) => m.leader)?.name ?? team.members[0]?.name ?? '';
        const now = Date.now();
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
              id: `song-${now}-${ai.index}`,
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
              uploadedBy: ME,
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
          id: `sl-${now}`,
          teamId: team.id,
          title: result.title,
          subtitle: `${team.name} · 인도 ${leader} · ${items.length}곡`,
          leader,
          items,
        };

        // 같은 제목(같은 예배) 콘티 교체
        const remaining = replace
          ? st.setlists.filter((sl) => !(sl.teamId === team.id && sl.title === setlist.title))
          : st.setlists;

        set({
          songs: [...newSongs, ...st.songs.map((s) => updatedSongs.get(s.id) ?? s)],
          setlists: [setlist, ...remaining],
          aiDraft: EMPTY_DRAFT,
        });
        return setlist.id;
      },

      resetAll: () => {
        // 저장소 파일을 지우고 메모리 상태도 시드로 리셋
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
