# 오라클 클라우드 VM에 Chordi AI 프록시 배포하기

배포용(스탠드얼론) APK가 맥 없이 AI 기능을 쓰려면 프록시가 24시간 떠 있는 서버가 필요해요.
오라클 클라우드 무료 티어(Always Free)면 충분합니다.

## 0. 준비물

- **Anthropic API 키** — https://console.anthropic.com → API Keys → Create Key
  (VM에서는 Claude 구독 인증을 못 쓰고 실제 API 키가 필요해요. 콘티 1회 생성 ≈ 300~400원)
- 오라클 클라우드 계정 — https://cloud.oracle.com (가입 시 카드 인증 필요, 과금은 안 됨)

## 1. VM 만들기 (오라클 콘솔)

1. Compute → Instances → **Create instance**
2. Image: **Ubuntu 22.04** / Shape: **VM.Standard.A1.Flex** (Ampere, Always Free — 4 OCPU·24GB까지 무료. 1 OCPU·6GB면 충분)
3. SSH 키: "Generate a key pair" → **프라이빗 키 다운로드** (다시 못 받아요!)
4. Create → 생성되면 **Public IP** 메모

## 2. 방화벽 열기 (오라클 콘솔)

1. 인스턴스 상세 → Virtual cloud network 클릭 → Security Lists → Default Security List
2. **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: TCP / Destination Port Range: `8787`

## 3. 프록시 설치 (맥 터미널에서)

```bash
# 파일 복사 (키 경로/IP는 본인 것으로)
scp -i ~/Downloads/ssh-key.key -r server ubuntu@<VM공인IP>:~/chordi-server

# 접속해서 설치 (비밀문자열은 아무거나 길게 — 앱과 맞추는 열쇠)
ssh -i ~/Downloads/ssh-key.key ubuntu@<VM공인IP>
ANTHROPIC_API_KEY=sk-ant-xxxx CHORDI_PROXY_SECRET=비밀문자열 bash ~/chordi-server/deploy/setup-vm.sh
```

성공하면 `http://<VM공인IP>:8787` 이 프록시 주소예요.

## 4. 앱에 연결 (맥에서)

`eas.json`의 preview(배포용) 프로필 env에 추가:

```json
"EXPO_PUBLIC_AI_PROXY_URL": "http://<VM공인IP>:8787",
"EXPO_PUBLIC_AI_PROXY_KEY": "위에서 정한 비밀문자열"
```

그리고 배포용 APK 재빌드:

```bash
npx eas-cli build --platform android --profile preview
```

## 운영 명령어 (VM에서)

```bash
sudo systemctl status chordi-proxy    # 상태
sudo journalctl -u chordi-proxy -f    # 실시간 로그
sudo systemctl restart chordi-proxy   # 재시작
sudo nano /etc/chordi-proxy.env       # API 키 등 변경 후 재시작
```

## 참고

- 지금은 HTTP(평문)라 `usesCleartextTraffic`을 켜둔 상태예요. 나중에 도메인을 붙이면
  Caddy로 HTTPS를 무료 적용할 수 있어요 (교회 대상 정식 오픈 전 권장).
- Audiveris(오선보 인식)는 현재 앱에서 꺼져 있어 VM에 설치하지 않아요.
  다시 켤 때 `sudo apt install audiveris` 또는 수동 설치 후 `AUDIVERIS_BIN` 지정.
