#!/bin/bash

# AWS EC2에서 실행할 자동 배포 스크립트
# 사용법: ssh로 접속 후 다음 실행:
#   curl -O https://your-repo/setup.sh && bash setup.sh

set -e

echo "🚀 Quant Trading System - AWS EC2 자동 설치 시작"

# ============================================================
# 1. 시스템 업데이트
# ============================================================
echo "📦 Step 1: 시스템 업데이트..."
sudo yum update -y
sudo yum install -y git curl wget

# ============================================================
# 2. Docker 설치
# ============================================================
echo "🐳 Step 2: Docker 설치..."
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# ============================================================
# 3. Docker Compose 설치
# ============================================================
echo "📐 Step 3: Docker Compose 설치..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker --version
docker-compose --version

# ============================================================
# 4. 애플리케이션 코드 다운로드 (또는 git clone)
# ============================================================
echo "📂 Step 4: 애플리케이션 코드 다운로드..."
mkdir -p ~/quant-trading
cd ~/quant-trading

# GitHub에서 클론 (자신의 리포지토리로 변경 필요)
if [ -d ".git" ]; then
  git pull origin main
else
  git clone https://github.com/your-username/your-repo.git .
fi

# ============================================================
# 5. 환경 변수 설정
# ============================================================
echo "⚙️  Step 5: 환경 변수 설정..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "✅ .env 파일이 생성되었습니다."
  echo "📝 다음 명령으로 편집해주세요:"
  echo "   nano .env"
  echo ""
  echo "필수 설정:"
  echo "  - TELEGRAM_BOT_TOKEN=YOUR_TOKEN"
  echo "  - TELEGRAM_CHAT_ID=YOUR_CHAT_ID"
  echo "  - PAPER_TRADING_ENABLED=True"
  echo "  - INITIAL_CAPITAL=5000000"
  read -p "⏸️  .env 설정 완료 후 Enter를 누르세요..."
else
  echo "✅ .env 파일이 이미 존재합니다."
fi

# ============================================================
# 6. 모델 파일 확인
# ============================================================
echo "🤖 Step 6: 모델 파일 확인..."
if [ -f "Low_conf.pkl" ]; then
  echo "✅ Low_conf.pkl이 존재합니다."
else
  echo "⚠️  Low_conf.pkl을 찾을 수 없습니다."
  echo "   scp로 로컬에서 복사하거나 git에 추가해주세요."
fi

# ============================================================
# 7. Docker 컨테이너 실행
# ============================================================
echo "🚀 Step 7: Docker 컨테이너 시작..."
docker-compose up -d

# 컨테이너 상태 확인
sleep 5
docker-compose ps

echo ""
echo "✅ 설치 완료!"
echo ""
echo "📋 다음 단계:"
echo "1️⃣  상태 확인: docker-compose ps"
echo "2️⃣  로그 확인: docker-compose logs -f"
echo "3️⃣  헬스 체크: curl http://localhost:8000/health"
echo "4️⃣  포트포워딩 (로컬에서 테스트): ssh -i key.pem -L 8000:localhost:8000 ec2-user@<IP>"
echo ""
echo "🔧 Systemd 서비스 등록 (자동 재시작):"
echo "   sudo tee /etc/systemd/system/quant-trading.service > /dev/null << 'EOF'"
echo "   [Unit]"
echo "   Description=Quant Trading System"
echo "   After=network.target docker.service"
echo "   Requires=docker.service"
echo "   "
echo "   [Service]"
echo "   Type=simple"
echo "   WorkingDirectory=/home/ec2-user/quant-trading"
echo "   ExecStart=/usr/local/bin/docker-compose up"
echo "   ExecStop=/usr/local/bin/docker-compose down"
echo "   Restart=always"
echo "   RestartSec=10"
echo "   User=ec2-user"
echo "   "
echo "   [Install]"
echo "   WantedBy=multi-user.target"
echo "   EOF"
echo ""
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable quant-trading"
echo "   sudo systemctl start quant-trading"
echo ""
