import { supabase } from './supabase';

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = globalThis.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * 원본 악보 사진을 비공개 버킷에 업로드하고 저장 경로 목록 반환.
 * 접근은 팀 멤버가 서명 URL(getSheetImageUrls)로만 가능.
 */
export async function uploadSheetImages(
  teamId: string,
  songId: string,
  images: { base64: string; mediaType: string }[],
): Promise<string[]> {
  if (!supabase) return [];
  const paths: string[] = [];
  for (let i = 0; i < images.length; i++) {
    try {
      const img = images[i];
      const ext = img.mediaType.includes('png') ? 'png' : 'jpg';
      const path = `${teamId}/${songId}/page-${i + 1}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('sheets')
        .upload(path, base64ToArrayBuffer(img.base64), {
          contentType: img.mediaType,
          upsert: true,
        });
      if (error) throw error;
      paths.push(path);
    } catch (e) {
      console.warn('[sheets] 업로드 실패:', e instanceof Error ? e.message : e);
    }
  }
  return paths;
}

/** 저장 경로 → 서명 URL (1시간 유효). 팀 멤버만 발급 가능 (RLS) */
export async function getSheetImageUrls(paths: string[]): Promise<string[]> {
  if (!supabase || paths.length === 0) return [];
  const { data, error } = await supabase.storage.from('sheets').createSignedUrls(paths, 3600);
  if (error) {
    console.warn('[sheets] 서명 URL 발급 실패:', error.message);
    return [];
  }
  return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
}
