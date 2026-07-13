// Supabase DB ↔ 앱 타입 매핑 + CRUD
// 전략: 화면은 로컬 스토어를 즉시 갱신(낙관적)하고, 여기 함수들이 서버에 반영한다.
import { supabase } from './supabase';
import type { Setlist, Song, Team } from '@/data/types';

function sb() {
  if (!supabase) throw new Error('Supabase 미설정');
  return supabase;
}

const TEAM_COLORS = ['#3E4C8E', '#B98A2F', '#8A857A', '#5E8A6E', '#8E3E5C'];

// ── 조회: 내 팀/곡/콘티 전체 ──
export async function fetchAll(): Promise<{ teams: Team[]; songs: Song[]; setlists: Setlist[] }> {
  const client = sb();

  const { data: memberships, error: mErr } = await client
    .from('team_members')
    .select('team_id, roles, is_leader, teams(id, name, color, invite_code)');
  if (mErr) throw mErr;

  const teamIds = (memberships ?? []).map((m) => m.team_id);
  if (teamIds.length === 0) return { teams: [], songs: [], setlists: [] };

  const [{ data: allMembers }, { data: songRows }, { data: setlistRows }] = await Promise.all([
    client
      .from('team_members')
      .select('team_id, user_id, roles, is_leader, profiles:user_id(name)')
      .in('team_id', teamIds),
    client.from('songs').select('*').in('team_id', teamIds).order('created_at', { ascending: false }),
    client
      .from('setlists')
      .select('*, setlist_items(*)')
      .in('team_id', teamIds)
      .order('created_at', { ascending: false }),
  ]);

  const teams: Team[] = (memberships ?? []).map((m, i) => {
    const t = m.teams as unknown as { id: string; name: string; color: string; invite_code: string };
    return {
      id: t.id,
      name: t.name,
      color: t.color ?? TEAM_COLORS[i % TEAM_COLORS.length],
      myRole: m.roles,
      inviteCode: t.invite_code,
      members: (allMembers ?? [])
        .filter((mm) => mm.team_id === t.id)
        .map((mm) => ({
          id: mm.user_id,
          name: (mm.profiles as unknown as { name: string } | null)?.name ?? '이름 없음',
          roles: mm.roles,
          leader: mm.is_leader,
        })),
    };
  });

  const songs: Song[] = (songRows ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    title: r.title,
    originalKey: r.original_key,
    bpm: r.bpm ?? undefined,
    tags: r.tags ?? [],
    source: r.source,
    sourceLabel: r.source_label,
    form: r.form ?? [],
    sections: r.sections ?? [],
    abc: r.abc ?? undefined,
    imageUrls: r.image_urls?.length ? r.image_urls : undefined,
    memo: r.memo ?? undefined,
    uploadedBy: r.uploaded_by,
  }));

  const setlists: Setlist[] = (setlistRows ?? []).map((r) => ({
    id: r.id,
    teamId: r.team_id,
    title: r.title,
    subtitle: r.subtitle,
    leader: r.leader,
    items: (r.setlist_items ?? [])
      .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
      .map((it: Record<string, unknown>) => ({
        songId: it.song_id as string,
        key: it.key as string,
        note: (it.note as string) ?? undefined,
        subNote: (it.sub_note as string) ?? undefined,
        linkedToPrev: (it.linked_to_prev as boolean) || undefined,
      })),
  }));

  return { teams, songs, setlists };
}

// ── 팀 ──
export async function createTeamRemote(name: string): Promise<string> {
  const { data, error } = await sb().rpc('create_team', { team_name: name });
  if (error) throw error;
  return data as string;
}

export async function joinTeamRemote(code: string): Promise<string> {
  const { data, error } = await sb().rpc('join_team_by_code', { code });
  if (error) throw error;
  return data as string;
}

// ── 곡 ──
export async function upsertSongRemote(song: Song) {
  const { error } = await sb().from('songs').upsert({
    id: song.id,
    team_id: song.teamId,
    title: song.title,
    original_key: song.originalKey,
    bpm: song.bpm ?? null,
    tags: song.tags,
    source: song.source,
    source_label: song.sourceLabel,
    form: song.form,
    sections: song.sections,
    abc: song.abc ?? null,
    image_urls: song.imageUrls ?? [],
    memo: song.memo ?? null,
    uploaded_by: song.uploadedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function patchSongRemote(songId: string, patch: Record<string, unknown>) {
  const { error } = await sb()
    .from('songs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', songId);
  if (error) throw error;
}

export async function deleteSongRemote(songId: string) {
  const { error } = await sb().from('songs').delete().eq('id', songId);
  if (error) throw error;
}

// ── 콘티 ──
export async function upsertSetlistRemote(setlist: Setlist, createdBy: string, replaceId?: string) {
  const client = sb();
  if (replaceId) {
    await client.from('setlists').delete().eq('id', replaceId);
  }
  const { error } = await client.from('setlists').upsert({
    id: setlist.id,
    team_id: setlist.teamId,
    title: setlist.title,
    subtitle: setlist.subtitle,
    leader: setlist.leader,
    created_by: createdBy,
  });
  if (error) throw error;

  await client.from('setlist_items').delete().eq('setlist_id', setlist.id);
  const { error: iErr } = await client.from('setlist_items').insert(
    setlist.items.map((it, i) => ({
      setlist_id: setlist.id,
      song_id: it.songId,
      position: i,
      key: it.key,
      note: it.note ?? null,
      sub_note: it.subNote ?? null,
      linked_to_prev: it.linkedToPrev ?? false,
    })),
  );
  if (iErr) throw iErr;
}

export async function deleteSetlistRemote(setlistId: string) {
  const { error } = await sb().from('setlists').delete().eq('id', setlistId);
  if (error) throw error;
}

export async function patchItemRemote(
  setlistId: string,
  songId: string,
  patch: { key?: string; note?: string | null; linked_to_prev?: boolean },
) {
  const { error } = await sb()
    .from('setlist_items')
    .update(patch)
    .eq('setlist_id', setlistId)
    .eq('song_id', songId);
  if (error) throw error;
}
