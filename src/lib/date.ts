const DAY_NAMES = ['주일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/** 다가오는 예배일 (요일 미설정 시 주일). 오늘이 그 요일이면 오늘 */
export function nextServiceDate(serviceDay?: number, base = new Date()): Date {
  const d = new Date(base);
  const target = serviceDay ?? 0;
  d.setDate(d.getDate() + ((target - d.getDay() + 7) % 7));
  return d;
}

/** 예배일 라벨. 예: "7월 19일 주일", "7월 17일 목요일" */
export function nextServiceLabel(serviceDay?: number, base = new Date()): string {
  const d = nextServiceDate(serviceDay, base);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}`;
}

/** 팀 이름에서 예배 요일 추측. "목요예배 찬양팀" → 4 */
export function guessServiceDay(teamName: string): number | undefined {
  const rules: [RegExp, number][] = [
    [/주일|일요/, 0],
    [/월요/, 1],
    [/화요/, 2],
    [/수요/, 3],
    [/목요/, 4],
    [/금요|철야/, 5],
    [/토요/, 6],
    [/청년|대예배|본예배/, 0],
  ];
  for (const [re, day] of rules) if (re.test(teamName)) return day;
  return undefined;
}

/** @deprecated nextServiceLabel 사용 */
export function nextSundayLabel(base = new Date()): string {
  return nextServiceLabel(0, base);
}

/** AI에 넘길 오늘 날짜 문자열 */
export function todayLabel(base = new Date()): string {
  return base.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}