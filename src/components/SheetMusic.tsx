import { useMemo } from 'react';
import { WebView } from 'react-native-webview';
import { C } from '@/constants/theme';

/**
 * ABC 표기 악보를 오선보로 렌더링 (abcjs).
 * transpose: 반음 단위 이조 — 악보 자체가 새 키로 다시 그려진다.
 */
export function SheetMusic({ abc, transpose }: { abc: string; transpose: number }) {
  const html = useMemo(() => buildHtml(abc, transpose), [abc, transpose]);
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={{ flex: 1, backgroundColor: C.card }}
      // 로컬 HTML + CDN 스크립트 하나만 로드
      javaScriptEnabled
      domStorageEnabled={false}
      allowsBackForwardNavigationGestures={false}
      setSupportMultipleWindows={false}
    />
  );
}

function buildHtml(abc: string, transpose: number): string {
  const abcJson = JSON.stringify(abc);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">
<script src="https://cdn.jsdelivr.net/npm/abcjs@6.4.4/dist/abcjs-basic-min.js"></script>
<style>
  body { margin: 0; padding: 10px 6px 24px; background: ${C.card}; }
  #paper { width: 100%; }
  #err { font: 13px -apple-system, sans-serif; color: ${C.mut}; padding: 16px; display: none; }
  /* abcjs 기본 스타일 위에 Chordi 톤 */
  .abcjs-chord { fill: ${C.primary}; font-weight: 700; }
  .abcjs-annotation { fill: ${C.goldDark}; font-weight: 700; }
  .abcjs-lyric { fill: ${C.ink}; }
</style>
</head>
<body>
<div id="paper"></div>
<div id="err">악보를 그리지 못했어요. 곡을 다시 업로드해 보세요.</div>
<script>
  try {
    var visualObj = ABCJS.renderAbc('paper', ${abcJson}, {
      visualTranspose: ${transpose},
      responsive: 'resize',
      add_classes: true,
      staffwidth: document.body.clientWidth - 12,
      paddingleft: 0,
      paddingright: 0,
      format: {
        gchordfont: 'Helvetica 13 bold',
        annotationfont: 'Helvetica 11 bold',
        vocalfont: 'Helvetica 12',
      },
    });
    if (!visualObj || !visualObj[0] || visualObj[0].warnings && visualObj[0].lines.length === 0) {
      document.getElementById('err').style.display = 'block';
    }
  } catch (e) {
    document.getElementById('err').style.display = 'block';
  }
</script>
</body>
</html>`;
}
