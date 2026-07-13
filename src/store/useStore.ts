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
  myRole: '리더',
  inviteCode: newInviteCode(),
  members: [{ id: 'me', name: '나', roles: '리더', leader: true }],
};

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

  addSong: (analysis: AiSongAnalysis) => Song;
  setItemKey: (setlistId: string, songId: string, key: string) => void;
  updateSongForm: (songId: string, form: FormChip[]) => void;
  applySetlistEdits: (setlistId: string, edit: AiSetlistEdit) => void;

  setAiImages: (images: AiDraft['images']) => void;
  setAiPrompt: (prompt: string) => void;
  setAiLoading: (loading: boolean) => void;
  setAiResult: (result: AiSetlistResult | null, error?: string | null) => void;
  resolveAiSong: (index: number, title: string) => void;
  confirmAiSetlist: () => string; // returns new setlist id
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
          myRole: '리더',
          inviteCode: newInviteCode(),
          members: [{ id: 'me', name: '나', roles: '리더', leader: true }],
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
          members: [{ id: 'me', name: '나', roles: '멤버' }],
        };
        set((st) => ({ teams: [...st.teams, team], currentTeamId: team.id }));
      },

      addSong: (a) => {
        const st = get();
        const song: Song = {
          id: `song-${Date.now()}`,
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
        };
        set({ songs: [song, ...st.songs] });
        return song;
      },

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

      confirmAiSetlist: () => {
        const st = get();
        const result = st.aiDraft.result;
        if (!result) return '';

        const team = st.currentTeam();
        const leader = team.members.find((m) => m.leader)?.name ?? team.members[0]?.name ?? '';
        const now = Date.now();
        const newSongs: Song[] = [];

        const items = result.songs.map((ai) => {
          const title = ai.title ?? ai.titleGuess ?? `악보 ${ai.index + 1}`;
          let song = st.songs.find((s) => s.teamId === team.id && s.title === title);
          if (!song) {
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

        set({
          songs: [...newSongs, ...st.songs],
          setlists: [setlist, ...st.setlists],
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
