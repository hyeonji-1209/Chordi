import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { z } from 'zod';
import type {
  AiSetlistEdit,
  AiSetlistResult,
  AiSongAnalysis,
  Setlist,
  Song,
} from '@/data/types';

const ChartSectionSchema = z.object({
  name: z.string().describe('구간 이름. 예: "VERSE 1", "PRE-CHORUS", "CHORUS", "BRIDGE"'),
  lines: z.array(
    z.object({
      chords: z
        .string()
        .describe('가사 윗줄의 코드 라인. 공백으로 코드 위치를 가사에 맞춰 정렬. 예: "G        D/F#      Em7"'),
      lyrics: z.string().describe('해당 줄 가사'),
    }),
  ),
});

const FORM_DESC = '송폼 토큰 배열. 예: ["In","V1","PC","C×2","V2","B","C↑"]. 반복은 ×숫자, 키올림은 ↑';

const ABC_DESC =
  '악보 전체를 ABC 표기법으로. 헤더(X,T,M,L,Q,K) + 멜로디 음표 + 코드("G" 따옴표) + 가사(w:) 포함. 원키 기준. 멜로디를 못 읽으면 null';

const AiSongSchema = z.object({
  index: z.number().describe('악보 순서 (0부터)'),
  title: z.string().nullable().describe('악보에서 확실히 읽은 곡 제목. 못 읽었으면 null'),
  titleGuess: z.string().nullable().describe('제목을 못 읽었을 때의 추측. 확실하면 null'),
  originalKey: z.string().nullable().describe('악보의 원키 (예: "A"). 못 읽었으면 null'),
  targetKey: z.string().describe('사용자 요청을 반영한 연주 키 (예: "G")'),
  notes: z.array(z.string()).describe('연주 지시 태그. 예: "후렴 ×2", "브릿지에서 ↑1키"'),
  linkedToPrev: z.boolean().describe('앞 곡과 간주 없이 이어서 연주하는지'),
  evidence: z.string().nullable().describe('이 판단의 근거가 된 사용자 문장 인용. 없으면 null'),
  uncertain: z.boolean().describe('사용자에게 되물어야 할 만큼 애매한지'),
  question: z.string().nullable().describe('uncertain일 때 사용자에게 물을 질문'),
  form: z.array(z.string()).describe(FORM_DESC),
  sections: z.array(ChartSectionSchema).describe('악보에서 추출한 코드차트. 코드는 악보 원키 기준 그대로'),
  abc: z.string().nullable().describe(ABC_DESC),
});

const AiSetlistSchema = z.object({
  title: z.string().describe('콘티 제목. 예: "7월 19일 주일 1부"'),
  summary: z.string().describe('한 줄 요약. 예: "악보 6장 인식 · 제목과 원키를 읽었어요"'),
  songs: z.array(AiSongSchema),
});

const AiSongAnalysisSchema = z.object({
  title: z.string().describe('곡 제목 (최선의 판단으로 반드시 채움)'),
  originalKey: z.string().describe('악보의 원키. 예: "A". 판단 불가면 "C"'),
  bpm: z.number().nullable().describe('BPM. 악보에 없으면 null'),
  tags: z.array(z.string()).describe('분위기 태그 1~2개. "빠른 찬양" | "잔잔한" | "성가" 중에서'),
  form: z.array(z.string()).describe(FORM_DESC),
  sections: z.array(ChartSectionSchema).describe('악보에서 추출한 코드차트. 원키 기준'),
  abc: z.string().nullable().describe(ABC_DESC),
});

const AiSetlistEditSchema = z.object({
  summary: z.string().describe('무엇을 바꿨는지 한 줄. 예: "2번곡을 F키로 내렸어요"'),
  items: z.array(
    z.object({
      songId: z.string().describe('반드시 입력으로 받은 songId 그대로'),
      key: z.string().describe('수정 반영 후의 연주 키'),
      note: z.string().nullable().describe('수정 반영 후의 연주 지시 태그. 없으면 null'),
      linkedToPrev: z.boolean(),
    }),
  ),
});

const CHART_RULES = `코드차트 추출 규칙:
- 악보 이미지에서 가사와 코드를 최대한 읽어 sections로 만든다. 구간(VERSE/CHORUS 등)별로 나눈다.
- chords는 가사 윗줄에 오는 코드 라인이며, 공백 개수로 코드가 가사의 어느 음절 위에 오는지 맞춘다.
- sections의 코드는 악보 원키 기준 그대로 적는다 (이조는 앱이 한다).
- 악보가 흐릿하거나 코드를 못 읽으면 sections를 빈 배열로 두어도 된다. 지어내지 않는다.

악보(ABC) 추출 규칙:
- 오선보의 멜로디 음표·리듬·마디를 ABC 표기법으로 옮긴다. abcjs로 렌더링된다.
- 헤더: X:1, T:곡제목, M:박자(예 4/4), L:1/8, Q:템포(있으면), K:원키.
- 코드는 음표 앞에 "G"처럼 따옴표로, 가사는 각 줄 아래 w: 로 음절을 -와 공백으로 음표에 맞춘다.
- 구간 경계는 %%text VERSE 같은 주석 대신 마디 내 P:V, P:C 파트 표기나 [P:...]를 쓰지 말고,
  각 구간 첫 줄 위에 "^VERSE" 같은 텍스트 주석(annotation)으로 표시한다.
- 음이 확실하지 않은 부분은 대충 짓지 말고, 그 구간을 생략한다. 전체를 못 읽겠으면 abc를 null로.`;

const SETLIST_SYSTEM = `너는 한국 교회 찬양팀을 위한 콘티(예배 곡 순서) 도우미다.
사용자가 악보 사진 여러 장과 "하고 싶은 말"(평소 말투의 요청)을 보낸다.

해야 할 일:
1. 각 악보 이미지에서 곡 제목과 원키를 읽는다.
2. 사용자의 요청("다 G키로", "3번째 곡 후렴 2번 반복", "4번곡이랑 5번곡은 간주 없이 이어서" 등)을 곡별로 해석해 targetKey / notes / linkedToPrev 에 반영한다.
3. 요청 해석의 근거가 된 사용자 문장을 evidence 에 그대로 인용한다.
4. 제목을 못 읽었거나 해석이 애매한 곡은 uncertain=true 로 표시하고, 사용자에게 물을 질문(question)과 추측(titleGuess)을 함께 준다. 억지로 확정하지 않는다.
5. 악보에서 송폼(form)과 코드차트(sections)를 추출한다.
6. 오늘 날짜와 맥락을 참고해 콘티 제목(title)을 짓는다.

곡 순서는 악보가 주어진 순서를 따르되, 사용자가 순서를 명시하면 그것을 따른다.
키는 "G", "A", "Bb" 같은 표기를 쓴다. 키 올림이 곡 중간에 있으면 targetKey는 시작 키로 두고 notes에 "브릿지에서 ↑1키"처럼 적는다.

${CHART_RULES}`;

const SONG_SYSTEM = `너는 한국 교회 찬양팀의 악보 정리 도우미다.
사용자가 곡 하나의 악보 사진(여러 장일 수 있음)을 보낸다.
제목·원키·BPM·분위기 태그·송폼·코드차트를 추출한다.

${CHART_RULES}`;

const EDIT_SYSTEM = `너는 찬양팀 콘티 수정 도우미다.
현재 콘티(JSON)와 사용자의 자연어 수정 요청을 받는다.
요청을 해석해 각 곡의 key / note / linkedToPrev 를 수정한 전체 목록을 돌려준다.

규칙:
- 입력으로 받은 songId를 그대로 쓴다. 곡을 추가/삭제/순서 변경하지 않는다.
- "2번곡"은 목록의 2번째 곡이다. "한 키 내려줘"는 반음 1개 내림이다 (예: G→F#).
- 수정 요청과 무관한 곡은 원래 값 그대로 돌려준다.
- 키는 "G", "F#", "Bb" 표기를 쓴다.`;

let client: Anthropic | null = null;

/** Metro 개발 서버 호스트(맥)에서 프록시 주소를 유도. 예: "192.168.0.5:8081" → "http://192.168.0.5:8787" */
function proxyBaseUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  const host = hostUri.split(':')[0];
  return `http://${host}:8787`;
}

function getClient(): Anthropic {
  if (client) return client;

  // RN 기본 fetch는 응답 스트리밍을 지원하지 않으므로 expo/fetch를 사용
  const fetchImpl = expoFetch as unknown as typeof globalThis.fetch;

  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (apiKey) {
    // API 키가 있으면 직접 호출 (프로토타입 전용 — 배포 시 서버 프록시로)
    client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, fetch: fetchImpl });
    return client;
  }

  // 키가 없으면 맥에서 도는 로컬 프록시(npm run proxy)를 사용.
  // 프록시가 ant 로컬 OAuth 프로필로 인증을 처리한다.
  const baseURL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? proxyBaseUrl();
  if (!baseURL) {
    throw new Error(
      'AI 연결이 없어요. 맥에서 `npm run proxy`를 실행하거나 .env에 EXPO_PUBLIC_ANTHROPIC_API_KEY를 넣어주세요.',
    );
  }
  client = new Anthropic({
    apiKey: 'chordi-local-proxy',
    baseURL,
    dangerouslyAllowBrowser: true,
    fetch: fetchImpl,
  });
  return client;
}

/** 스트리밍 + 구조화 출력 공통 호출 (긴 생성은 API가 스트리밍을 요구함) */
async function callStructured<S extends z.ZodTypeAny>(opts: {
  system: string;
  content: Anthropic.ContentBlockParam[] | string;
  schema: S;
  maxTokens: number;
}): Promise<z.infer<S>> {
  const stream = getClient().messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: 'user', content: opts.content }],
    output_config: { format: zodOutputFormat(opts.schema) },
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === 'refusal') {
    throw new Error('요청이 거절되었어요. 다른 사진이나 문구로 다시 시도해 주세요.');
  }
  if (msg.stop_reason === 'max_tokens') {
    throw new Error('응답이 너무 길어 잘렸어요. 사진 수를 줄여 다시 시도해 주세요.');
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  try {
    return opts.schema.parse(JSON.parse(text));
  } catch {
    throw new Error('AI 응답을 해석하지 못했어요. 다시 시도해 주세요.');
  }
}

type ImageInput = { base64: string; mediaType: string };

function imageBlocks(images: ImageInput[]): Anthropic.ImageBlockParam[] {
  return images.map((img) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      data: img.base64,
    },
  }));
}

export async function generateSetlist(
  images: ImageInput[],
  userPrompt: string,
  today: string,
): Promise<AiSetlistResult> {
  return callStructured({
    system: SETLIST_SYSTEM,
    maxTokens: 32000,
    schema: AiSetlistSchema,
    content: [
      ...imageBlocks(images),
      {
        type: 'text',
        text: `오늘 날짜: ${today}\n악보 ${images.length}장을 보냈어.\n\n하고 싶은 말:\n${userPrompt}`,
      },
    ],
  });
}

export async function analyzeSong(images: ImageInput[]): Promise<AiSongAnalysis> {
  return callStructured({
    system: SONG_SYSTEM,
    maxTokens: 16000,
    schema: AiSongAnalysisSchema,
    content: [
      ...imageBlocks(images),
      { type: 'text', text: `이 곡 악보 ${images.length}장을 분석해줘.` },
    ],
  });
}

export async function editSetlist(
  setlist: Setlist,
  songs: Song[],
  command: string,
): Promise<AiSetlistEdit> {
  const current = setlist.items.map((it, i) => {
    const song = songs.find((s) => s.id === it.songId);
    return {
      order: i + 1,
      songId: it.songId,
      title: song?.title ?? '',
      key: it.key,
      note: it.note ?? null,
      linkedToPrev: it.linkedToPrev ?? false,
    };
  });

  return callStructured({
    system: EDIT_SYSTEM,
    maxTokens: 8000,
    schema: AiSetlistEditSchema,
    content: `현재 콘티:\n${JSON.stringify(current, null, 2)}\n\n수정 요청: ${command}`,
  });
}
