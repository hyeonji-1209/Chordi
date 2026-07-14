import { Redirect } from 'expo-router';

// 초대 QR 딥링크(…//join?code=XXXX)가 라우트로 열릴 때 홈으로.
// 입장 처리는 루트 레이아웃의 딥링크 핸들러가 담당한다.
export default function JoinRedirect() {
  return <Redirect href="/" />;
}
