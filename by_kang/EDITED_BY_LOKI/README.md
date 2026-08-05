# AI Quant Trading System

Upbit 1분봉 데이터를 실시간으로 가져와 XGBoost 기반 모델로 진입 확률을 추론하고, 위험 성향별 분할 투자 금액을 계산하는 Flask API입니다. 텔레그램 알림과 모의투자 루프를 함께 지원합니다.

이 프로젝트는 **Oracle Cloud Always Free Ampere A1**에서 24시간 추론 서버로 구동하는 것을 우선 목표로 합니다. 학습은 별도 환경에서 수행하는 것을 권장합니다.

## 최적 피처 조합 업데이트

2026-07-03 기준으로 피처 선택 재학습을 수행해 기존 104개 피처를 horizon별 최적 조합으로 축소했습니다. 기본 모델 경로는 `models/feature_selected_realtime_model.pkl`이며, 모델 파일 자체는 GitHub에 올리지 않고 로컬 또는 배포 서버에만 둡니다.

| 예측 구간 | 선택 후보 | 피처 수 | 배포 권장 | 요약 |
| --- | --- | ---: | --- | --- |
| `short_30m` | `top_32_importance` | 32 | 예 | 단기 실시간 진입 기본 후보 |
| `short_4h` | `top_24_importance` | 24 | 예 | 중단기 확인용 후보 |
| `long_2d` | `top_48_importance` | 48 | 예 | 2일 방향성 참고 후보 |
| `long_30d` | `top_24_importance` | 24 | 아니오 | test 순수익이 음수라 기본 진입에는 비권장 |
| `long_60d` | 제외 | 0 | 아니오 | 시간순 검증 구간에서 target class가 한쪽으로 쏠려 학습 제외 |

상세 결과는 `reports/feature_selection_report.ipynb`와 `reports/feature_selection_metrics.json`에서 확인합니다.

## 현재 동작 기준

- 클라우드 권장 환경: Oracle Cloud Always Free `VM.Standard.A1.Flex`
- 권장 서버 사양: 1 OCPU / 6GB 이상, Docker 빌드까지 서버에서 하면 2 OCPU / 12GB 권장
- 거래소 데이터: `ccxt.upbit()` 공개 API
- 입력 데이터: 마켓별 Upbit 1분봉 OHLCV 200개
- 실시간 피처: `quant_app.realtime_model.build_realtime_features`
- 모델 추론: `models/feature_selected_realtime_model.pkl`의 `predict_signal(..., horizon="short_30m")`
- 기본 마켓: `KRW-BTC`, `KRW-ETH`, `KRW-XRP`, `KRW-SOL`, `KRW-ADA`
- 배분 방식: 후보 확률, 현재 포지션 가치, 현금, 성향별 최대 투자 한도를 함께 고려
- 현금 정책: 분할투자를 하되 전체 현금을 강제로 100% 투입하지 않음

## 주요 파일

| 파일 | 역할 |
| --- | --- |
| `app.py` | Flask API, 모델 로딩, Upbit 실시간 추론, 엔드포인트 |
| `paper_trader.py` | 모의투자 자동매매 루프 |
| `risk_manager/portfolio.py` | 분할 투자 및 포트폴리오 위험 관리 |
| `quant_app/realtime_model.py` | 실시간 피처 생성 및 모델 wrapper |
| `models/feature_selected_realtime_model.pkl` | 피처 선택 재학습으로 만든 로컬 배포용 모델 파일 |
| `Dockerfile` | Oracle Ampere A1/ARM64 호환 Docker 실행 설정 |
| `docker-compose.yml` | 단일 컨테이너 실행용 Compose 설정 |
| `.dockerignore` | Oracle 서버 Docker 빌드 최적화용 제외 목록 |
| `.env.example` | 환경 변수 예시 |
| `ORACLE_24H_ALWAYS_FREE_DEPLOYMENT_STEP_BY_STEP.txt` | Oracle 배포 절차서 |

## Oracle 배포 문서

처음 배포한다면 먼저 아래 문서를 따라가세요.

```text
ORACLE_24H_ALWAYS_FREE_DEPLOYMENT_STEP_BY_STEP.txt
```

문서에는 Oracle 가입, Home Region 선택, VCN, Security List, Compute 생성, Docker 설치, 프로젝트 업로드, 24시간 실행, 비용 확인 절차가 들어 있습니다.

## 로컬 설치

```bash
cd EDITED_BY_LOKI
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## 환경 변수

`.env.example`을 `.env`로 복사한 뒤 값을 수정합니다.

```bash
cp .env.example .env
```

주요 설정:

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `CLOUD_PROVIDER` | `oracle` | 배포 환경 표시용 |
| `ORACLE_HOME_REGION` | `ap-seoul-1` | Oracle Home Region 기록용 |
| `ORACLE_SHAPE` | `VM.Standard.A1.Flex` | Oracle 권장 Shape |
| `ORACLE_OCPU` | `2` | 권장 OCPU |
| `ORACLE_MEMORY_GB` | `12` | 권장 메모리 |
| `MODEL_FILE` | `models/feature_selected_realtime_model.pkl` | 모델 파일 경로 |
| `BASE_THRESHOLD` | `0.60` | 기본 진입 임계값 |
| `INITIAL_CAPITAL` | `5000000` | 모의투자 초기 자본 |
| `PAPER_TRADING_ENABLED` | `True` | 앱 초기화 시 모의투자 엔진 생성 여부 |
| `SIMULATION_INTERVAL_SECONDS` | `60` | 모의투자 루프 주기 |
| `FEE_BPS` | `5` | 거래 수수료 bps |
| `MARKETS` | 빈 값 | 쉼표로 구분한 마켓 override |
| `TELEGRAM_BOT_TOKEN` | 빈 값 | 텔레그램 봇 토큰 |
| `TELEGRAM_CHAT_ID` | 빈 값 | 알림 대상 chat ID 또는 채널 username |

주의: 실제 텔레그램 토큰을 README, `.env.example`, Git 저장소에 넣지 마세요. 실제 토큰은 Oracle 서버의 `.env`에만 둡니다.

## Docker 실행

Oracle 서버에서 권장 실행:

```bash
docker build -t quant-trading:latest .

docker run -d \
  --name quant-trading \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file .env \
  quant-trading:latest
```

Compose를 사용할 경우:

```bash
docker compose up -d --build
```

로그 확인:

```bash
docker logs -f quant-trading
```

상태 확인:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/signal
```

Dockerfile은 Oracle Ampere A1을 고려해 다음 설정을 사용합니다.

```text
gunicorn --workers=1 --threads=2 --worker-class=gthread
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1
NUMEXPR_NUM_THREADS=1
libgomp1 설치
```

## API

### `GET /health`

모델, 거래소, 텔레그램, 모의투자 상태를 확인합니다.

```bash
curl http://localhost:8000/health
```

### `GET /signal`

마켓별 Upbit 1분봉 200개를 가져와 실시간 피처를 만들고, `short_30m` 모델로 확률과 시그널을 추론합니다. 시그널 후보가 있으면 분할 투자 배분도 함께 계산합니다.

```bash
curl http://localhost:8000/signal
```

### `POST /allocation`

현재 Upbit 데이터와 모델 추론 확률을 사용해 분할 배분을 계산합니다.

```bash
curl -X POST http://localhost:8000/allocation \
  -H "Content-Type: application/json" \
  -d "{\"capital\": 1000000, \"risk_profile\": \"neutral\"}"
```

응답에는 `allocation`, `total_allocated`, `cash_reserve`, `allocated_pct`가 포함됩니다.

### `GET /portfolio`

현재 포트폴리오 상태와 위험 지표를 반환합니다.

```bash
curl http://localhost:8000/portfolio
```

### `POST /paper/start`

모의투자 자동매매 루프를 시작합니다. 루프는 실시간 모델 추론 결과를 사용합니다.

```bash
curl -X POST http://localhost:8000/paper/start
```

### `POST /paper/stop`

모의투자 자동매매 루프를 중지합니다.

```bash
curl -X POST http://localhost:8000/paper/stop
```

### `GET /paper/status`

모의투자 현금, 포지션, 최근 거래 내역을 확인합니다.

```bash
curl http://localhost:8000/paper/status
```

### `POST /test-telegram`

텔레그램 봇 연결이 설정된 경우 테스트 메시지를 보냅니다.

```bash
curl -X POST http://localhost:8000/test-telegram
```

### `GET /metrics`

서비스 및 포트폴리오 요약 지표를 반환합니다.

```bash
curl http://localhost:8000/metrics
```

## 분할 투자 규칙

배분기는 `available_capital`, `total_equity`, `current_position_value`를 함께 보고 추가 투자 가능 금액을 계산합니다. 이미 포지션이 충분히 열려 있으면 신규 배분은 0이 될 수 있습니다.

| 성향 | 고신뢰 | 중신뢰 | 저신뢰 | 종목당 최대 | 동시 포지션 | 총 투자 상한 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Conservative | 30% | 15% | 5% | 10% | 3 | 60% |
| Neutral | 50% | 30% | 10% | 15% | 5 | 80% |
| Aggressive | 60% | 40% | 20% | 20% | 8 | 95% |

## Oracle Always Free 운용 기준

권장 조건:

- Oracle Cloud Always Free 사용
- Shape: `VM.Standard.A1.Flex`
- 처음에는 1 OCPU / 6GB, Docker 빌드까지 편하게 하려면 2 OCPU / 12GB
- 기본 5개 마켓 유지
- `SIMULATION_INTERVAL_SECONDS=60` 이상 권장
- `--restart unless-stopped`로 컨테이너 자동 재시작
- Security List에서 22번과 8000번은 내 IP만 허용

주의할 점:

- Ampere A1 재고가 없으면 인스턴스 생성이 실패할 수 있습니다.
- Oracle A1은 ARM64 서버입니다. Dockerfile은 ARM64를 지원하는 `python:3.11-slim`을 사용합니다.
- 모델 파일과 `quant_app/realtime_model.py`는 함께 배포되어야 합니다. pickle 로딩에 필요한 클래스가 이 모듈에 있습니다.
- Always Free 한도를 넘기거나 유료 리소스를 만들면 비용이 발생할 수 있습니다.

## 검증 명령

문법 확인:

```bash
python -m compileall app.py paper_trader.py risk_manager/portfolio.py quant_app/realtime_model.py
```

모델 로딩 확인:

```bash
python -c "import pickle; import quant_app.realtime_model; m=pickle.load(open('models/feature_selected_realtime_model.pkl','rb')); print(type(m).__name__); print(m.available_horizons())"
```

Upbit 공개 API 확인:

```bash
python -c "import ccxt; ex=ccxt.upbit(); data=ex.fetch_ohlcv('KRW-BTC', timeframe='1m', limit=5); print(len(data), data[-1][4] if data else None)"
```

## 보안

- 실제 Telegram token을 README, `.env.example`, Git 저장소에 넣지 마세요.
- `.env`는 커밋하지 마세요.
- Oracle Security List에서 필요한 포트만 내 IP로 열어두세요.
- 실제 주문 기능을 추가하기 전에는 반드시 모의투자와 백테스트로 충분히 검증하세요.

## 면책

이 프로젝트는 투자 참고와 시스템 실험을 위한 코드입니다. 모델 예측은 100% 정확하지 않으며, 거래 손실에 대한 책임은 사용자에게 있습니다.
