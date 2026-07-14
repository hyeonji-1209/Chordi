const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/**
 * 갤러리 사진의 mimeType을 API 허용 형식으로 정규화.
 * expo-image-picker는 quality 옵션으로 JPEG 재인코딩하지만
 * mimeType은 원본(HEIC 등)을 보고할 수 있다.
 */
export function normalizeImageType(mime?: string | null): string {
  return mime && ALLOWED.has(mime) ? mime : 'image/jpeg';
}
