// Chordi 로컬 AI 프록시
// 앱 → (LAN) → 이 프록시 → api.anthropic.com
// 인증은 `ant auth login`으로 저장된 로컬 OAuth 프로필을 사용한다.
// 토큰은 수명이 짧으므로 매번 `ant auth print-credentials --access-token`으로
// 가져온다 (필요 시 ant가 알아서 갱신).
//
// 실행: npm run proxy   (기본 포트 8787)

import { execFile } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';

const PORT = Number(process.env.PORT ?? 8787);
const UPSTREAM = 'https://api.anthropic.com';
const OAUTH_BETA = 'oauth-2025-04-20';

let cached = { token: null, at: 0 };

function fetchToken() {
  return new Promise((resolve, reject) => {
    execFile('ant', ['auth', 'print-credentials', '--access-token'], (err, stdout, stderr) => {
      if (err) reject(new Error(`ant 토큰 발급 실패: ${stderr || err.message}`));
      else resolve(stdout.trim());
    });
  });
}

async function getToken(force = false) {
  const now = Date.now();
  if (!force && cached.token && now - cached.at < 4 * 60 * 1000) return cached.token;
  cached = { token: await fetchToken(), at: now };
  return cached.token;
}

async function forward(req, body, token) {
  const headers = {
    'content-type': req.headers['content-type'] ?? 'application/json',
    'anthropic-version': req.headers['anthropic-version'] ?? '2023-06-01',
    authorization: `Bearer ${token}`,
  };
  // 클라이언트가 보낸 beta 헤더에 oauth beta를 합친다
  const betas = new Set(
    String(req.headers['anthropic-beta'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  betas.add(OAUTH_BETA);
  headers['anthropic-beta'] = [...betas].join(',');

  return fetch(UPSTREAM + req.url, { method: req.method, headers, body: body.length ? body : undefined });
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  try {
    let token = await getToken();
    let upstream = await forward(req, body, token);
    if (upstream.status === 401) {
      // 토큰 만료 → 강제 갱신 후 1회 재시도
      token = await getToken(true);
      upstream = await forward(req, body, token);
    }
    console.log(`${req.method} ${req.url} → ${upstream.status}`);
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    // SSE 스트리밍 응답을 도착하는 대로 흘려보낸다
    if (upstream.body) {
      for await (const chunk of upstream.body) res.write(chunk);
      res.end();
    } else {
      res.end(await upstream.text());
    }
  } catch (e) {
    console.error(e);
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: String(e) } }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const nets = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
  console.log(`Chordi AI 프록시 시작 — 포트 ${PORT}`);
  console.log(`  시뮬레이터: http://localhost:${PORT}`);
  for (const ip of nets) console.log(`  실기기(Expo Go): http://${ip}:${PORT}`);
  console.log('인증: ant 로컬 프로필 (ant auth status로 확인)');
});
