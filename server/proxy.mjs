// Chordi AI 프록시
// 앱 → 이 프록시 → api.anthropic.com
//
// 인증 (둘 중 하나):
//  - ANTHROPIC_API_KEY 환경변수 → API 키로 호출 (서버/VM 배포용)
//  - 없으면 `ant auth login` 로컬 OAuth 프로필 사용 (맥 개발용)
//
// 공개 서버에서는 CHORDI_PROXY_SECRET을 설정하면
// x-chordi-key 헤더가 일치하는 요청만 통과시킨다.
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
const API_KEY = process.env.ANTHROPIC_API_KEY || null; // 있으면 API 키 모드
const PROXY_SECRET = process.env.CHORDI_PROXY_SECRET || null; // 있으면 검문 활성화
// 사용량 제한 (비용 폭주 방지) — AI 호출(POST /v1/*)에만 적용
const DAILY_LIMIT = Number(process.env.CHORDI_DAILY_LIMIT ?? 300); // 전체 하루 한도
const IP_HOURLY_LIMIT = Number(process.env.CHORDI_IP_HOURLY_LIMIT ?? 30); // IP당 시간 한도

const usage = { day: '', count: 0, perIp: new Map() }; // perIp: ip → {hour, count}
function overLimit(ip) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = `${day}T${now.getUTCHours()}`;
  if (usage.day !== day) Object.assign(usage, { day, count: 0, perIp: new Map() });
  const ipRec = usage.perIp.get(ip) ?? { hour, count: 0 };
  if (ipRec.hour !== hour) Object.assign(ipRec, { hour, count: 0 });
  if (usage.count >= DAILY_LIMIT || ipRec.count >= IP_HOURLY_LIMIT) return true;
  usage.count += 1;
  ipRec.count += 1;
  usage.perIp.set(ip, ipRec);
  return false;
}

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
  };
  const betas = new Set(
    String(req.headers['anthropic-beta'] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (API_KEY) {
    headers['x-api-key'] = API_KEY;
  } else {
    // 로컬 OAuth 모드 — oauth beta 헤더 필요
    headers.authorization = `Bearer ${token}`;
    betas.add(OAUTH_BETA);
  }
  if (betas.size) headers['anthropic-beta'] = [...betas].join(',');

  return fetch(UPSTREAM + req.url, { method: req.method, headers, body: body.length ? body : undefined });
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const detail = [stderr, stdout].map((s) => (s ?? '').trim().slice(-600)).filter(Boolean).join('\n');
        reject(new Error(`${path.basename(cmd)} 실패:\n${detail || err.message}`));
      } else resolve(stdout);
    });
  });
}

/** OMR은 해상도가 생명 — 작은 이미지는 sips로 업스케일 (macOS 내장) */
async function upscaleIfSmall(file) {
  try {
    const out = await run('sips', ['-g', 'pixelWidth', file], 10_000);
    const width = Number(out.match(/pixelWidth: (\d+)/)?.[1] ?? 0);
    if (width > 0 && width < 1500) {
      await run('sips', ['--resampleWidth', '2200', file], 30_000);
      console.log(`  업스케일: ${width}px → 2200px`);
    }
  } catch {
    // 업스케일 실패는 무시하고 원본으로 진행
  }
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
      await upscaleIfSmall(p);
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
  // 검문: 공개 서버에서는 앱에서 보낸 x-chordi-key가 일치해야 통과
  if (PROXY_SECRET && req.headers['x-chordi-key'] !== PROXY_SECRET) {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ type: 'error', error: { type: 'forbidden', message: '접근 키가 없어요' } }));
    return;
  }

  // 사용량 제한 — AI 호출만 카운트
  if (req.method === 'POST' && req.url.startsWith('/v1/')) {
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (overLimit(ip)) {
      console.log(`  ⛔ 사용량 제한: ${ip}`);
      res.writeHead(429, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: '오늘 사용량이 가득 찼어요. 내일 다시 시도해 주세요.' } }));
      return;
    }
  }

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
    let token = API_KEY ? null : await getToken();
    let upstream = await forward(req, body, token);
    if (!API_KEY && upstream.status === 401) {
      // 토큰 만료 → 강제 갱신 후 1회 재시도
      token = await getToken(true);
      upstream = await forward(req, body, token);
    }
    console.log(`${req.method} ${req.url} → ${upstream.status}`);
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
    });
    // 에러 응답은 본문을 로그에 남긴다 (원인 파악용)
    if (!upstream.ok) {
      const text = await upstream.text();
      console.log('  ⚠️ 업스트림 에러:', text.slice(0, 400));
      res.end(text);
      return;
    }
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
  console.log(`인증: ${API_KEY ? 'ANTHROPIC_API_KEY (서버 모드)' : 'ant 로컬 프로필 (ant auth status로 확인)'}`);
  console.log(`검문: ${PROXY_SECRET ? 'x-chordi-key 활성화' : '없음 (로컬 전용 권장)'}`);
});
