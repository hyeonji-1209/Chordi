/** 다가오는 주일(일요일) 라벨. 오늘이 일요일이면 오늘. 예: "7월 19일 주일" */
export function nextSundayLabel(base = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return `${d.getMonth() + 1}월 ${d.getDate()}일 주일`;
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
