# Auto-Quant-Trading-Challenge

거시경제 지표, 거래소 시세, 기술적 지표를 결합해 암호화폐/주식 자동매매 전략을 실험하는 End-to-End 퀀트 트레이딩 프로젝트입니다. 데이터 수집과 피처 엔지니어링, XGBoost 기반 시계열 예측, Streamlit 분석 대시보드, 실시간 운용 리스크 가드까지 포트폴리오 형태로 확장하고 있습니다.

## Project Snapshot

- Category: Quant Trading, Machine Learning, MLOps
- Language: Python
- Core Stack: pandas, NumPy, scikit-learn, XGBoost, PyArrow, Streamlit, Plotly
- Data Sources: Upbit/Binance 1분봉 병합 데이터, USD/KRW 환율, 김치프리미엄, 거래량/거래대금 기반 시장 지표
- Goal: 단순 백테스트를 넘어 실시간 추론 가능한 모델과 리스크 제어 로직을 갖춘 자동매매 실험 환경 구축

## Portfolio Progress

### 1. 데이터 파이프라인

- Upbit KRW 마켓과 Binance USDT 마켓의 1분봉 데이터를 병합해 `master.parquet` 캐시를 구성했습니다.
- 현재 모델 학습에는 2017-09-01부터 2026-02-26까지의 데이터 중 최근 4년 구간을 사용합니다.
- BTC, ETH, XRP, SOL, DOGE, ENSO 총 6개 마켓 기준 10,702,258개 행을 로드해 학습/검증/테스트 세트로 분리했습니다.
- 대용량 CSV를 앱에서 직접 전량 로드하지 않도록 `sample.csv`, `newdata/*.csv`, `coin_files/*.parquet` 우선순위 로더를 구성했습니다.

### 2. 실시간 피처 엔지니어링

- 실시간 환경에서 계산 가능한 causal feature만 사용하도록 피처 빌더를 분리했습니다.
- 수익률, 캔들 구조, 변동성, EMA/MACD/RSI/Bollinger, 거래량/거래대금 상대 강도, Upbit-Binance 스프레드, 김치프리미엄, USD/KRW 변화율, BTC/ETH 시장 상태를 포함합니다.
- 학습 코드와 추론 코드가 동일한 피처 컬럼을 공유하도록 `RealtimeCryptoModelSuite` 래퍼를 구현했습니다.

### 3. 멀티 호라이즌 모델링

- XGBoost histogram tree 기반으로 30분, 4시간, 2일, 30일, 60일 예측 호라이즌을 각각 학습했습니다.
- 후보 모델별 threshold, average precision, ROC-AUC, 거래 커버리지, 평균 순수익률, hit rate를 저장해 실험 추적이 가능하도록 구성했습니다.
- 현재 라이브 후보로는 단기 호라이즌을 우선 검토하고, 장기 30일/60일 호라이즌은 성능 안정화 전까지 신규 진입 차단 대상으로 분리했습니다.

| Horizon | Selected Model | Test ROC-AUC | Average Precision | Trade Mean Net Return | Hit Rate |
| --- | --- | ---: | ---: | ---: | ---: |
| 30m | xgb_gpu_depth3_regularized | 0.614 | 0.459 | 0.046% | 54.03% |
| 4h | xgb_gpu_depth2_low_latency | 0.562 | 0.397 | 0.107% | 46.77% |
| 2d | xgb_gpu_depth3_regularized | 0.659 | 0.446 | 1.237% | 42.10% |

### 4. 리스크 가드 및 운용 제어

- 급락장, 데이터 지연, 마켓 누락, 김치프리미엄 급변, 환율 변화, 유동성 저하를 감지하는 `RiskGuard`를 구현했습니다.
- 상황별로 `normal`, `caution`, `block_new_entries`, `reduce_only`, `kill_switch` 레벨을 반환합니다.
- 모델 시그널과 리스크 판단을 결합해 신규 진입 차단, 포지션 축소, 종목별 차단을 적용할 수 있게 설계했습니다.

### 5. 분석 대시보드

- Streamlit 기반 `Quant Trading Lab`을 구축했습니다.
- 시장 개요, 종목별 가격/거래량 분석, 팩터 상관관계, 이동평균 교차 전략 백테스트를 탭 구조로 제공합니다.
- 대용량 데이터에서도 로드 행 수를 제한해 빠르게 탐색할 수 있도록 구성했습니다.

## Key Features & Logic

1. 경제학적 가설 기반 Feature Engineering

Macro Integration: 단순 가격 데이터뿐만 아니라 USD/KRW, 김치프리미엄, 거래소 간 스프레드, 시장 대표 자산 움직임을 Feature로 결합해 시장의 문맥을 반영합니다.

Technical Indicators: RSI, MACD, 이동평균 이격도, 변동성, Bollinger z-score, breakout 등 실시간 계산 가능한 기술적 지표를 생성합니다.

2. 데이터 파이프라인

Large-scale Time Series: 수백만 건 이상의 시계열 데이터를 Parquet 기반으로 캐싱하고, 학습/검증/테스트 기간을 분리해 재현 가능한 실험을 구성합니다.

MLOps & Monitoring

Model Artifact: 학습된 모델, 메타데이터, 실험 지표를 `models/` 아래에 저장해 추론과 검증 흐름을 분리합니다.

Failure Analysis: 모델 예측값, 실제 수익률, 리스크 차단 사유를 비교 분석할 수 있도록 로그와 메트릭 구조를 설계하고 있습니다.

## Basic Quant App Starter

- `app.py`: Streamlit 기반 Quant Trading Lab
- `src/quant_app/data.py`: CSV/Parquet 데이터 카탈로그 및 로딩
- `src/quant_app/analytics.py`: 기초 피처, 신호 보드, 팩터 상관관계, 이동평균 백테스트
- `src/quant_app/realtime_model.py`: 실시간 피처 생성 및 모델 추론 래퍼
- `src/quant_app/risk_guard.py`: 실시간 리스크 평가 및 시그널 차단 로직
- `train_realtime_crypto_model.py`: 단일 호라이즌 실시간 모델 학습
- `train_overlap_multi_horizon_model.py`: 멀티 호라이즌 모델 학습
- `models/`: 학습된 모델과 실험 메트릭 저장

실행 방법:

1. `pip install -r requirements.txt`
2. UI 실행: `streamlit run app.py`
3. 멀티 호라이즌 학습: `python train_overlap_multi_horizon_model.py --merged-parquet master.parquet`

Roles (Collaborators)\
LOKI 

- 데이터 아키텍처 설계 및 MySQL 데이터베이스 최적화 (SQL 적용).
- 거시경제 지표 기반 XGBoost 회귀 모델링 및 Feature Engineering.
- Docker 기반 서버 환경 구축 및 n8n 워크플로우 설계.

KCH
- 증권사 Open API 연동
- 실시간 데이터/API 연동 보조 및 운영 테스트
