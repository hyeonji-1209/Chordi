export type FormChip = {
  id: string;
  label: string; // Intro, V1, PC, C, V2, B ...
  repeat?: number; // ×2, ×3
  keyUp?: number; // ↑1, ↑2
};

export type ChartLine = { chords: string; lyrics: string };

export type ChartSection = {
  name: string; // VERSE 1, CHORUS ...
  lines: ChartLine[];
  highlight?: boolean; // 강조 구간
  badge?: string; // "반복 ×2" 등
};

export type Song = {
  id: string;
  teamId: string;
  title: string;
  originalKey: string;
  bpm?: number;
  tags: string[];
  source: 'chart' | 'image' | 'pdf';
  sourceLabel: string; // "코드차트 · 이조 가능 · 72 BPM"
  form: FormChip[];
  sections: ChartSection[];
  memo?: string; // 인도자 메모
  abc?: string; // 악보(멜로디+코드+가사) ABC 표기 — 오선보 렌더링용, 원키 기준
  uploadedBy: string; // 올린 멤버 id ('me' 등) — 수정·삭제 권한 기준
};

export type SetlistItem = {
  songId: string;
  key: string; // 연주 키 (예: "G", "G→A")
  note?: string; // "후렴 ×2", "브릿지에서 ↑1키"
  subNote?: string; // "Verse부터 · 조용히 시작"
  linkedToPrev?: boolean; // ⛓ 간주 없이 이어서
};

export type Setlist = {
  id: string;
  teamId: string;
  title: string; // "7월 19일 주일 1부"
  subtitle: string; // "본예배 찬양팀 · 인도 김하준 · 6곡"
  leader: string;
  items: SetlistItem[];
};

export type Member = {
  id: string;
  name: string;
  roles: string; // "인도 · 어쿠스틱"
  leader?: boolean;
};

export type Team = {
  id: string;
  name: string;
  color: string;
  myRole: string; // "인도자"
  members: Member[];
  inviteCode: string;
};

// ── AI 콘티 생성 결과 ──
export type AiChartSection = {
  name: string;
  lines: ChartLine[];
};

export type AiSongResult = {
  index: number;
  title: string | null; // 인식한 제목 (못 읽으면 null)
  titleGuess: string | null; // 추측 제목
  originalKey: string | null;
  targetKey: string;
  notes: string[]; // ["후렴 ×2"], ["브릿지에서 ↑1키"]
  linkedToPrev: boolean;
  evidence: string | null; // 사용자가 적은 말 인용
  uncertain: boolean;
  question: string | null; // 되물을 질문
  form: string[]; // ["In", "V1", "C×2", "B", "C↑"]
  sections: AiChartSection[]; // 악보에서 추출한 코드차트 (원키 기준)
  abc: string | null; // 멜로디 ABC 표기 (원키 기준). 못 읽으면 null
};

export type AiSetlistResult = {
  title: string;
  summary: string;
  songs: AiSongResult[];
};

// ── 곡 단독 업로드 분석 결과 ──
export type AiSongAnalysis = {
  title: string;
  originalKey: string;
  bpm: number | null;
  tags: string[];
  form: string[];
  sections: AiChartSection[];
  abc: string | null;
};

// ── "말로 수정" 결과 ──
export type AiSetlistEdit = {
  summary: string; // 무엇을 바꿨는지 한 줄
  items: {
    songId: string;
    key: string;
    note: string | null;
    linkedToPrev: boolean;
  }[];
};
