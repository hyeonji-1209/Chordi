import { Redirect } from 'expo-router';

// OAuth 딥링크(exp://.../--/auth-callback)가 라우트로 열릴 때 홈으로.
// 세션 처리는 루트 레이아웃의 딥링크 핸들러가 담당한다.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
