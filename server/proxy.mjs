// Chordi 로컬 AI 프록시
// 앱 → (LAN) → 이 프록시 → api.anthropic.com
// 인증은 `ant auth login`으로 저장된 로컬 OAuth 프로필을 사용한다.
// 토큰은 수명이 짧으므로 매번 `ant auth print-credentials --access-token`으로
// 가져온다 (필요 시 ant가 알아서 갱신).
//
// 실행: npm run proxy   (기본 포트 8787)

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 8787);
const UPSTREAM = 'https://api.anthropic.com';
const OAUTH_BETA = 'oauth-2025-04-20';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AUDIVERIS =
  process.env.AUDIVERIS_BIN ??
  path.join(os.homedir(), 'Applications/Audiveris.app/Contents/MacOS/Audiveris');
const XML2ABC = path.join(HERE, 'tools/xml2abc.py');

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

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${path.basename(cmd)} 실패: ${stderr?.slice(-400) || err.message}`));
      else resolve(stdout);
    });
  });
}

/** 악보 이미지 → Audiveris(OMR) → MusicXML → xml2abc → ABC */
async function omrToAbc(images) {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'chordi-omr-'));
  try {
    const inputs = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = String(img.mediaType ?? '').includes('png') ? 'png' : 'jpg';
      const p = path.join(work, `page-${i + 1}.${ext}`);
      await fs.writeFile(p, Buffer.from(img.base64, 'base64'));
      inputs.push(p);
    }

    await run(AUDIVERIS, ['-batch', '-export', '-output', work, ...inputs], 180_000);

    const files = await fs.readdir(work);
    const mxls = files.filter((f) => f.endsWith('.mxl')).sort();
    if (mxls.length === 0) return null;

    const abcs = [];
    for (let i = 0; i < mxls.length; i++) {
      // -u: 언빔 정리, stdout 대신 파일 출력(-o) 후 읽기
      await run('python3', [XML2ABC, '-o', work, path.join(work, mxls[i])], 60_000);
      const abcFile = path.join(work, mxls[i].replace(/\.mxl$/, '.abc'));
      let abc = await fs.readFile(abcFile, 'utf8').catch(() => '');
      abc = abc.trim();
      if (abc) abcs.push(i === 0 ? abc : abc.replace(/^X:\s*\d+/m, `X:${i + 1}`));
    }
    return abcs.length ? abcs.join('\n\n') : null;
  } finally {
    fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  // 로컬 OMR 엔드포인트 (Anthropic 프록시와 무관)
  if (req.method === 'POST' && req.url === '/omr') {
    try {
      const { images } = JSON.parse(body.toString('utf8'));
      if (!Array.isArray(images) || images.length === 0) throw new Error('images가 비어있어요');
      const started = Date.now();
      const abc = await omrToAbc(images);
      console.log(`POST /omr → ${abc ? 'ok' : 'empty'} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ abc }));
    } catch (e) {
      console.error('OMR 실패:', e.message);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ abc: null, error: String(e.message) }));
    }
    return;
  }

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
