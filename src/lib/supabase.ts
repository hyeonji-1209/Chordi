import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';

// RN에는 WebCrypto가 없어서 supabase-js PKCE가 plain으로 강등됨 → expo-crypto로 폴리필 (S256 사용)
const g = globalThis as Record<string, any>;
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = Crypto.getRandomValues.bind(Crypto);
if (!g.crypto.subtle) {
  g.crypto.subtle = {
    digest: (algorithm: string | { name: string }, data: BufferSource) =>
      Crypto.digest(
        (typeof algorithm === 'string' ? algorithm : algorithm.name) as Crypto.CryptoDigestAlgorithm,
        data,
      ),
  };
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase 설정 여부 — 미설정이면 앱은 기존 로컬 모드로 동작 */
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled
  ? createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // RN에서는 딥링크로 직접 처리
        flowType: 'pkce', // 모바일 OAuth 권장 방식
      },
    })
  : null;
