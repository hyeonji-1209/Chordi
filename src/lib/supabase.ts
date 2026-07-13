import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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
      },
    })
  : null;
