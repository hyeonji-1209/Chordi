import { Platform } from 'react-native';

// Chordi design tokens — from "Chordi Hi-fi" design (claude.ai/design)
export const C = {
  bg: '#F7F5F0',
  card: '#FFFFFF',
  border: '#E7E3DA',
  ink: '#26241F',
  mut: '#8A857A',
  faint: '#B9B3A6',
  dim: '#D9D5CB',
  primary: '#3E4C8E',
  primaryDark: '#37437E',
  primaryTint: '#EEF0F9',
  primaryBorder: '#C9CFE6',
  primaryText: '#5A628F',
  avatarBg: '#E4E7F2',
  gold: '#E9C46A',
  goldDark: '#B98A2F',
  goldBg: '#F7EFDD',
  goldBorder: '#E0B25C',
  goldAvatarBg: '#F2E7CF',
  memoText: '#6B6558',
} as const;

export const F = {
  serif: 'GowunBatang_700Bold',
  serifRegular: 'GowunBatang_400Regular',
  sans: 'NotoSansKR_400Regular',
  sansMedium: 'NotoSansKR_500Medium',
  sansBold: 'NotoSansKR_700Bold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }) as string,
} as const;
