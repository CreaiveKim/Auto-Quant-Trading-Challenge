# Auto-Quant-Trading-Challenge
거시경제지표와 주가 데이터를 이용한 자동 매매 프로그램 도전기

AI 기반 시계열 예측 및 자동 매매 시스템 구축 프로젝트

경제학적 가설을 바탕으로 거시경제 지표와 주가 데이터를 결합하여, XGBoost 모델을 통해 최적의 매수 타점을 포착하고 자동 주문까지 수행하는 End-to-End MLOps 파이프라인입니다.

Category: Tech
Language: Python
Database: SQL-based Tuning
Finance API,"한국투자증권(KIS) API, yfinance (Macro Data)

Key Features & Logic
1. 경제학적 가설 기반 Feature Engineering
Macro Integration: 단순 주가뿐만 아니라 환율(USD/KRW), 금리(US 10Y) 등 거시경제 지표를 Feature로 결합하여 시장의 문맥을 파악합니다.

Technical Indicators: RSI, MACD, 이동평균 이격도 등 20여 종의 기술적 지표 생성.

2. 데이터 파이프라인
MySQL Optimization: SQL 바탕으로 수백만 건의 시계열 데이터에 최적화된 복합 인덱스 및 파티셔닝 설계.

MLOps & Monitoring
Dockerized: 전체 시스템을 컨테이너화하여 환경에 구애받지 않는 배포 환경 구축.

Failure Analysis: 모델의 예측값과 실제 체결 데이터를 비교 분석하여 매매 로직의 오차를 추적하는 로깅 시스템.

Roles (Collaborators)\
LOKI 

- 데이터 아키텍처 설계 및 MySQL 데이터베이스 최적화 (SQL 적용).
- 거시경제 지표 기반 XGBoost 회귀 모델링 및 Feature Engineering.
- Docker 기반 서버 환경 구축 및 n8n 워크플로우 설계.

KCH
- 증권사 Open API 연동
- 버스 승객
