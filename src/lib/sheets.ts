import { supabase } from './supabase';

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = globalThis.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** 원본 악보 사진들을 Storage에 올리고 공개 URL 목록 반환 (실패한 장은 건너뜀) */
export async function uploadSheetImages(
  teamId: string,
  songId: string,
  images: { base64: string; mediaType: string }[],
): Promise<string[]> {
  if (!supabase) return [];
  const urls: string[] = [];
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
      const { data } = supabase.storage.from('sheets').getPublicUrl(path);
      urls.push(data.publicUrl);
    } catch (e) {
      console.warn('[sheets] 업로드 실패:', e instanceof Error ? e.message : e);
    }
  }
  return urls;
}
