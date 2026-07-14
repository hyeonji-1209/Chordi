import * as Linking from 'expo-linking';

/** 초대 딥링크 — 환경에 맞는 스킴으로 (개발빌드 chordi://, Expo Go exp://) */
export function inviteLink(code: string): string {
  return Linking.createURL('join', { queryParams: { code } });
}

/** QR 이미지 URL (초대 링크 인코딩) */
export function inviteQrUrl(code: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=12&data=${encodeURIComponent(inviteLink(code))}`;
}

/** 딥링크에서 초대코드 추출. join 링크가 아니면 null */
export function parseJoinUrl(url: string | null | undefined): string | null {
  if (!url || !url.includes('join')) return null;
  const parsed = Linking.parse(url);
  const code = parsed.queryParams?.code;
  return typeof code === 'string' && code ? code.toUpperCase() : null;
}

// 로그인 전에 초대 링크로 들어온 경우 — 로그인 완료 후 입장 처리
let pendingJoinCode: string | null = null;
export function setPendingJoin(code: string) {
  pendingJoinCode = code;
}
export function consumePendingJoin(): string | null {
  const c = pendingJoinCode;
  pendingJoinCode = null;
  return c;
}
