import type { FormChip } from '@/data/types';

export function chipText(c: FormChip): string {
  let t = c.label;
  if (c.repeat && c.repeat > 1) t += ` ×${c.repeat}`;
  if (c.keyUp) t += ` ↑${c.keyUp}`;
  return t;
}

export function formToText(form: FormChip[]): string {
  return form
    .map((c) => {
      let t = c.label;
      if (c.repeat && c.repeat > 1) t += `×${c.repeat}`;
      if (c.keyUp) t += '↑'.repeat(c.keyUp);
      return t;
    })
    .join(' ');
}

export function textToForm(text: string): FormChip[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token, i) => {
      const keyUp = (token.match(/↑/g) ?? []).length;
      const repeatMatch = token.match(/[×x](\d+)/);
      const label = token.replace(/[×x]\d+/g, '').replace(/↑/g, '');
      return {
        id: `t-${i}`,
        label,
        repeat: repeatMatch ? Number(repeatMatch[1]) : undefined,
        keyUp: keyUp || undefined,
      };
    });
}

/** AI가 준 ["In","V1","C×2","C↑"] 형태를 FormChip[]으로 */
export function stringsToForm(tokens: string[]): FormChip[] {
  return textToForm(tokens.join(' '));
}
