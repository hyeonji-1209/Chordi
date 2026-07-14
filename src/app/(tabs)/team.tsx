import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServicePicker } from '@/components/ServicePicker';
import { Avatar, Card, ScreenTitle } from '@/components/ui';
import { C, F } from '@/constants/theme';
import { displayName, signOut } from '@/lib/auth';
import { guessServiceDay } from '@/lib/date';
import { inviteLink, inviteQrUrl } from '@/lib/invite';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { useStore } from '@/store/useStore';

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const teams = useStore((s) => s.teams);
  const currentTeamId = useStore((s) => s.currentTeamId);
  const switchTeam = useStore((s) => s.switchTeam);
  const addTeam = useStore((s) => s.addTeam);
  const joinTeam = useStore((s) => s.joinTeam);
  const resetAll = useStore((s) => s.resetAll);
  const team = useStore((s) => s.currentTeam());
  const songs = useStore((s) => s.songs);
  const setlists = useStore((s) => s.setlists);

  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalDay, setModalDay] = useState<number | undefined>(undefined);
  const [modalDayTouched, setModalDayTouched] = useState(false);
  const [modalTime, setModalTime] = useState('');
  const [account, setAccount] = useState<{ name: string; email: string | null } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAccount({ name: displayName(data.user), email: data.user.email ?? null });
    });
  }, []);

  const songCount = useMemo(
    () => songs.filter((s) => s.teamId === team.id).length,
    [songs, team.id],
  );
  const setlistCount = useMemo(
    () => setlists.filter((s) => s.teamId === team.id).length,
    [setlists, team.id],
  );

  const shareInvite = () => {
    Share.share({
      message: `Chordi 팀 "${team.name}"에 초대해요!\n초대코드: ${team.inviteCode}\n${inviteLink(team.inviteCode)}`,
    });
  };

  const submitModal = () => {
    const text = modalText.trim();
    if (!text) return;
    if (modal === 'create') addTeam(text, modalDay, modalTime);
    if (modal === 'join') joinTeam(text);
    setModal(null);
    setModalText('');
    setModalDay(undefined);
    setModalDayTouched(false);
    setModalTime('');
  };

  const onModalTextChange = (t: string) => {
    setModalText(t);
    if (modal === 'create' && !modalDayTouched) {
      const guessed = guessServiceDay(t);
      if (guessed !== undefined) setModalDay(guessed);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 14,
        paddingHorizontal: 20,
        paddingBottom: 24,
        gap: 14,
      }}
    >
      <ScreenTitle>Team</ScreenTitle>

      {/* current team card */}
      <View style={st.teamCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <View style={[st.dot, { backgroundColor: C.gold }]} />
          <Text style={st.teamName}>{team.name}</Text>
          <Text style={st.roleBadge}>내 역할: {team.myRole}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Text style={st.stat}>
            <Text style={st.statNum}>{team.members.length}</Text> 멤버
          </Text>
          <Text style={st.stat}>
            <Text style={st.statNum}>{songCount}</Text> 곡
          </Text>
          <Text style={st.stat}>
            <Text style={st.statNum}>{setlistCount}</Text> 콘티
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={st.teamBtn} onPress={shareInvite}>
            <Text style={st.teamBtnLabel}>멤버 초대</Text>
          </Pressable>
          <Pressable style={st.teamBtn} onPress={() => setInviteOpen(true)}>
            <Text style={st.teamBtnLabel}>QR·코드 {team.inviteCode}</Text>
          </Pressable>
        </View>
      </View>

      {/* members */}
      <Card style={{ gap: 11, paddingVertical: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={st.cardTitle}>멤버</Text>
        </View>
        {team.members.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Avatar name={m.name} gold={m.leader} />
            <View>
              <Text style={st.memberName}>{m.name}</Text>
              <Text style={st.memberRole}>{m.roles}</Text>
            </View>
            {m.leader && <Text style={st.leaderBadge}>리더</Text>}
          </View>
        ))}
        <Text style={st.more}>초대코드 {team.inviteCode}를 공유해 멤버를 모아보세요</Text>
      </Card>

      {/* my teams */}
      <View style={{ gap: 8 }}>
        <Text style={st.sectionLabel}>내 팀</Text>
        {teams.map((t) => {
          const current = t.id === currentTeamId;
          return (
            <Pressable
              key={t.id}
              onPress={() => switchTeam(t.id)}
              style={({ pressed }) => [st.teamRow, pressed && { borderColor: C.primary }]}
            >
              <View style={[st.dot, { width: 8, height: 8, backgroundColor: t.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={[st.teamRowName, current && { fontFamily: F.sansBold }]}>{t.name}</Text>
                {t.churchName && <Text style={st.teamRowChurch}>{t.churchName}</Text>}
              </View>
              <Text style={[st.teamRowAction, current && { color: C.primary, fontFamily: F.sansBold }]}>
                {current ? '현재' : '전환 ›'}
              </Text>
            </Pressable>
          );
        })}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable style={[st.addTeam, { flex: 1 }]} onPress={() => setModal('create')}>
            <Text style={st.addTeamLabel}>＋ 팀 만들기</Text>
          </Pressable>
          <Pressable style={[st.addTeam, { flex: 1 }]} onPress={() => setModal('join')}>
            <Text style={st.addTeamLabel}>초대코드로 입장</Text>
          </Pressable>
        </View>
        <Pressable
          style={[st.addTeam, { borderColor: C.primary }]}
          onPress={() => router.push('/church-setup')}
        >
          <Text style={[st.addTeamLabel, { color: C.primary }]}>📷 주보로 교회 등록 — 예배별 팀 한 번에</Text>
        </Pressable>
      </View>

      {/* account */}
      {supabaseEnabled && account && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 }}>
          <Avatar name={account.name} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.sansBold, fontSize: 13.5, color: C.ink }}>{account.name}</Text>
            {account.email && (
              <Text style={{ fontFamily: F.sans, fontSize: 11.5, color: C.mut }}>{account.email}</Text>
            )}
          </View>
          <Pressable
            onPress={() =>
              Alert.alert('로그아웃', '로그아웃할까요?', [
                { text: '취소', style: 'cancel' },
                { text: '로그아웃', style: 'destructive', onPress: signOut },
              ])
            }
          >
            <Text style={{ fontFamily: F.sansMedium, fontSize: 12.5, color: C.mut }}>로그아웃</Text>
          </Pressable>
        </Card>
      )}

      {/* dev: reset */}
      <Pressable
        onPress={() =>
          Alert.alert('모든 데이터 초기화', '팀·곡·콘티가 전부 지워져요. 되돌릴 수 없어요.', [
            { text: '취소', style: 'cancel' },
            { text: '초기화', style: 'destructive', onPress: resetAll },
          ])
        }
        style={{ alignItems: 'center', paddingVertical: 10 }}
      >
        <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.faint }}>모든 데이터 초기화</Text>
      </Pressable>

      {/* invite QR modal */}
      <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={st.dim} onPress={() => setInviteOpen(false)} />
        <View style={[st.modalCard, { alignItems: 'center' }]}>
          <Text style={st.modalTitle}>{team.name} 초대</Text>
          <Image
            source={{ uri: inviteQrUrl(team.inviteCode) }}
            style={{ width: 220, height: 220, borderRadius: 12 }}
          />
          <Text style={{ fontFamily: F.sansBold, fontSize: 22, letterSpacing: 6, color: C.primary }}>
            {team.inviteCode}
          </Text>
          <Text style={{ fontFamily: F.sans, fontSize: 12, color: C.mut, textAlign: 'center' }}>
            팀원이 폰 카메라로 QR을 스캔하면 바로 입장돼요{'\n'}(또는 앱에서 초대코드 입력)
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
            <Pressable style={st.modalGhost} onPress={() => setInviteOpen(false)}>
              <Text style={st.modalGhostLabel}>닫기</Text>
            </Pressable>
            <Pressable style={st.modalPrimary} onPress={shareInvite}>
              <Text style={st.modalPrimaryLabel}>공유하기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* create / join modal */}
      <Modal visible={modal !== null} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <Pressable style={st.dim} onPress={() => setModal(null)} />
        <View style={st.modalCard}>
          <Text style={st.modalTitle}>{modal === 'create' ? '새 팀 만들기' : '초대코드로 입장'}</Text>
          <TextInput
            style={st.modalInput}
            placeholder={modal === 'create' ? '팀 이름 (예: 본예배 찬양팀)' : '초대코드 4자리'}
            placeholderTextColor={C.faint}
            value={modalText}
            onChangeText={onModalTextChange}
            autoFocus
            autoCapitalize={modal === 'join' ? 'characters' : 'none'}
            onSubmitEditing={submitModal}
          />
          {modal === 'create' && (
            <ServicePicker
              day={modalDay}
              time={modalTime}
              onChangeDay={(d) => {
                setModalDay(d);
                setModalDayTouched(true);
              }}
              onChangeTime={setModalTime}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={st.modalGhost} onPress={() => setModal(null)}>
              <Text style={st.modalGhostLabel}>취소</Text>
            </Pressable>
            <Pressable style={st.modalPrimary} onPress={submitModal}>
              <Text style={st.modalPrimaryLabel}>{modal === 'create' ? '만들기' : '입장'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  teamCard: { backgroundColor: C.primary, borderRadius: 16, padding: 16, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  teamName: { fontFamily: F.sansBold, fontSize: 16, color: '#fff' },
  roleBadge: {
    marginLeft: 'auto',
    fontFamily: F.sans,
    fontSize: 11,
    color: 'rgba(255,255,255,.7)',
    backgroundColor: 'rgba(255,255,255,.14)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  stat: { fontFamily: F.sans, fontSize: 12, color: 'rgba(255,255,255,.8)' },
  statNum: { fontFamily: F.sansBold, color: '#fff' },
  teamBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,.14)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  teamBtnLabel: { fontFamily: F.sansBold, fontSize: 12.5, color: '#fff' },
  cardTitle: { fontFamily: F.sansBold, fontSize: 13.5, color: C.ink },
  memberName: { fontFamily: F.sansBold, fontSize: 13.5, color: C.ink },
  memberRole: { fontFamily: F.sans, fontSize: 11, color: C.mut },
  leaderBadge: {
    marginLeft: 'auto',
    fontFamily: F.sansBold,
    fontSize: 10.5,
    color: C.goldDark,
    backgroundColor: C.goldBg,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  more: { fontFamily: F.sans, fontSize: 12, color: C.mut },
  sectionLabel: { fontFamily: F.sansBold, fontSize: 13, color: C.mut },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  teamRowName: { fontFamily: F.sansMedium, fontSize: 13.5, color: C.ink },
  teamRowChurch: { fontFamily: F.sans, fontSize: 10.5, color: C.faint },
  teamRowAction: { marginLeft: 'auto', fontFamily: F.sans, fontSize: 12, color: C.mut },
  addTeam: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.faint,
    borderRadius: 13,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addTeamLabel: { fontFamily: F.sansMedium, fontSize: 12.5, color: C.mut },
  dim: { flex: 1, backgroundColor: 'rgba(38,36,31,.45)' },
  modalCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '32%',
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalTitle: { fontFamily: F.serif, fontSize: 16.5, color: C.ink },
  modalInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: F.sans,
    fontSize: 14,
    color: C.ink,
    backgroundColor: C.bg,
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
