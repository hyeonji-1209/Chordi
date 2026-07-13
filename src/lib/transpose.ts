const SHARP_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm']);

function noteIndex(note: string): number {
  const i = SHARP_SCALE.indexOf(note);
  if (i >= 0) return i;
  return FLAT_SCALE.indexOf(note);
}

export function transposeNote(note: string, semitones: number, preferFlat: boolean): string {
  const i = noteIndex(note);
  if (i < 0) return note;
  const j = (((i + semitones) % 12) + 12) % 12;
  return preferFlat ? FLAT_SCALE[j] : SHARP_SCALE[j];
}

export function semitonesBetween(fromKey: string, toKey: string): number {
  const a = noteIndex(fromKey.replace('m', ''));
  const b = noteIndex(toKey.replace('m', ''));
  if (a < 0 || b < 0) return 0;
  return (((b - a) % 12) + 12) % 12;
}

/** "G/B" "Dsus4" "Em7" 같은 코드 심볼 하나를 이조 */
export function transposeChord(chord: string, semitones: number, preferFlat: boolean): string {
  if (semitones === 0) return chord;
  return chord.replace(/([A-G][#b]?)/g, (m) => transposeNote(m, semitones, preferFlat));
}

/** 코드 라인 전체("G        D/F#      Em7")를 공백 폭 유지하며 이조 */
export function transposeLine(line: string, semitones: number, toKey: string): string {
  if (semitones === 0) return line;
  const preferFlat = FLAT_KEYS.has(toKey);
  return line.replace(/([A-G][#b]?[^A-G\s]*)/g, (m) => transposeChord(m, semitones, preferFlat));
}

const KEY_ORDER = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function shiftKey(key: string, delta: number): string {
  const base = key.replace('m', '');
  const i = KEY_ORDER.findIndex((k) => semitonesBetween(k, base) === 0);
  if (i < 0) return key;
  const j = (((i + delta) % 12) + 12) % 12;
  return KEY_ORDER[j] + (key.endsWith('m') ? 'm' : '');
}
