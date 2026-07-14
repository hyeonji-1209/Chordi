#!/usr/bin/env bash
# Chordi AI 프록시 — 오라클 클라우드 VM(Ubuntu) 설치 스크립트
#
# VM에서 한 번만 실행:
#   ANTHROPIC_API_KEY=sk-ant-... CHORDI_PROXY_SECRET=아무비밀문자열 bash setup-vm.sh
#
# 하는 일:
#  1) Node.js 20 설치
#  2) /opt/chordi-proxy 에 proxy.mjs 배치
#  3) systemd 서비스 등록 (재부팅해도 자동 시작)
#  4) 방화벽(iptables) 8787 포트 오픈
set -euo pipefail

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "❌ ANTHROPIC_API_KEY를 지정해 주세요"; exit 1
fi
if [ -z "${CHORDI_PROXY_SECRET:-}" ]; then
  echo "❌ CHORDI_PROXY_SECRET를 지정해 주세요 (앱과 맞출 비밀 문자열)"; exit 1
fi

echo "── 1. Node.js 20 설치"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "── 2. 프록시 배치"
sudo mkdir -p /opt/chordi-proxy
HERE="$(cd "$(dirname "$0")" && pwd)"
sudo cp "$HERE/../proxy.mjs" /opt/chordi-proxy/proxy.mjs

echo "── 3. 환경변수 파일"
sudo tee /etc/chordi-proxy.env > /dev/null << EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
CHORDI_PROXY_SECRET=${CHORDI_PROXY_SECRET}
PORT=8787
EOF
sudo chmod 600 /etc/chordi-proxy.env

echo "── 4. systemd 서비스"
sudo tee /etc/systemd/system/chordi-proxy.service > /dev/null << 'EOF'
[Unit]
Description=Chordi AI Proxy
After=network.target

[Service]
EnvironmentFile=/etc/chordi-proxy.env
ExecStart=/usr/bin/node /opt/chordi-proxy/proxy.mjs
Restart=always
RestartSec=3
User=root

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now chordi-proxy

echo "── 5. 방화벽 8787 오픈 (오라클 Ubuntu 기본 iptables)"
sudo iptables -C INPUT -p tcp --dport 8787 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp --dport 8787 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

sleep 1
sudo systemctl --no-pager status chordi-proxy | head -5
IP=$(curl -s ifconfig.me || echo "VM공인IP")
echo ""
echo "✅ 완료! 프록시 주소: http://${IP}:8787"
echo "   (오라클 콘솔의 보안 목록에서도 8787 인그레스 규칙을 열어야 해요)"
