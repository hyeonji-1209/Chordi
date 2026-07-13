# Chordi

찬양팀을 위한 콘티(예배 곡 순서) 관리 앱. 악보 사진을 넣고 평소 말투로 요청하면 AI가 키·순서·반복·코드차트까지 세팅해 준다.

디자인: [Chordi Hi-fi (claude.ai/design)](https://claude.ai/design/p/3cf4be82-1795-4c8e-b1ca-9e4ecd1a687d?file=Chordi+Hi-fi.dc.html)

## 기능

- **AI로 콘티 만들기** — 악보 사진 여러 장 + "하고 싶은 말" → Claude가 곡 제목·원키를 읽고 요청(키 통일, 후렴 반복, 간주 없이 이어서 등)을 곡별로 해석. 애매한 곡은 되물어봄.
- **검수 화면** — 곡마다 판단 근거(사용자 문장 인용) 확인, 못 읽은 제목은 추측 확인/직접 입력.
- **연주 모드** — 코드차트 + 송폼 스트립 + KEY ±(실시간 이조) + 인도자 메모 + 이전/다음 곡.
- **송폼 편집** — 칩 배열 ⇄ 텍스트 입력 양방향 토글, 반복(×2)·키 올림(↑) 설정.
- **말로 수정** — 콘티 화면에서 "2번곡 한 키 내려줘" 같은 자연어로 수정.
- **곡 업로드** — Songs 탭에서 악보 사진 업로드 → AI가 제목·키·BPM·송폼·코드차트 추출.
- **팀** — 팀 만들기/전환/초대코드 공유. 데이터는 팀별로 분리.
- 모든 데이터는 기기에 저장(AsyncStorage). 앱을 껐다 켜도 유지.

## 실행

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_ANTHROPIC_API_KEY에 Anthropic API 키 입력
npx expo start         # iPhone에서 Expo Go로 QR 스캔, 또는 i(iOS 시뮬레이터)
```

> ⚠️ 프로토타입이라 API 키를 앱에서 직접 사용한다(`EXPO_PUBLIC_` 환경변수는 번들에 포함됨). 배포 전에는 서버 프록시로 옮길 것.

## 구조

```
src/
  app/                # expo-router 화면
    (tabs)/           # Home · Songs · Setlists · Team
    ai-input.tsx      # 악보 사진 + 요청 입력
    ai-review.tsx     # AI 해석 결과 검수
    setlist/[id].tsx  # 콘티 상세 (말로 수정)
    sheet/[setlistId]/[songId].tsx  # 연주 모드 + 송폼 편집 시트
  lib/ai.ts           # Claude API (콘티 생성 · 곡 분석 · 말로 수정)
  lib/transpose.ts    # 코드 이조
  store/useStore.ts   # zustand + AsyncStorage 영속화
  constants/theme.ts  # 디자인 토큰 (Chordi Hi-fi)
```

기술: Expo SDK 57 · expo-router · TypeScript · zustand · @anthropic-ai/sdk (claude-opus-4-8, 구조화 출력)
