# 파라미터 설명 가이드

이 문서는 `EDITED_BY_LOKI` 서비스에서 사용하는 환경 변수, API 요청값, 응답 필드, 모델 피처, 내부 함수 인자를 한글로 정리한 가이드임. 실제 API 토큰, 채팅 ID, 개인 설정값은 기록하지 않고 파라미터의 의미만 설명함.

## 1. 환경 변수

### 1.1 클라우드 배포 설정

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `CLOUD_PROVIDER` | `oracle` | 배포 환경을 구분하기 위한 클라우드 제공자 이름임. 현재 앱이 클라우드 API를 직접 호출하지는 않고 운영 참고값으로 사용함. |
| `ORACLE_HOME_REGION` | `ap-seoul-1` | 오라클 클라우드 홈 리전임. 배포 문서와 운영 환경을 맞추기 위한 참고값임. |
| `ORACLE_SHAPE` | `VM.Standard.A1.Flex` | 오라클 클라우드 인스턴스 형태임. 서버 사양을 문서화하기 위한 값임. |
| `ORACLE_OCPU` | `2` | 오라클 인스턴스에 할당할 OCPU 수임. |
| `ORACLE_MEMORY_GB` | `12` | 오라클 인스턴스에 할당할 메모리 용량임. 단위는 GB임. |

### 1.2 텔레그램 설정

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | 빈 값 | 텔레그램 봇 토큰임. 값이 있으면 알림 기능을 켤 수 있음. 실제 토큰은 절대 커밋하지 않음. |
| `TELEGRAM_CHAT_ID` | 빈 값 | 알림을 받을 개인 채팅 ID 또는 채널 사용자 이름임. 채널 사용자 이름은 `@채널명` 형식으로 입력함. |
| `TELEGRAM_CHANNEL` | 빈 값 | 별도 채널 발송을 구분할 때 사용하는 채널 대상값임. |
| `ENABLED` | 토큰 존재 여부 | 코드 내부의 텔레그램 활성화 상태임. `TELEGRAM_BOT_TOKEN`이 있으면 기본적으로 활성화됨. |

### 1.3 플라스크 서버 설정

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `FLASK_APP` | `app.py` | 플라스크 실행 진입 파일임. |
| `FLASK_ENV` | `production` | 플라스크 실행 환경임. 운영 배포에서는 `production` 사용을 권장함. |
| `DEBUG` | `False` | 디버그 모드 여부임. 운영 환경에서는 `False`로 둠. |
| `HOST` | `0.0.0.0` | 서버가 바인딩할 호스트 주소임. 외부 접속을 받으려면 `0.0.0.0`을 사용함. |
| `PORT` | `8000` | 플라스크 서버 포트임. |

### 1.4 모델 설정

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `MODEL_FILE` | `models/feature_selected_realtime_model.pkl` | 로드할 실시간 추론 모델 파일 경로임. 현재 기본값은 피처 선택 재학습으로 만든 최적 조합 모델임. 피클 파일은 민감하거나 용량이 클 수 있으므로 커밋 대상에서 제외함. |
| `BASE_THRESHOLD` | `0.60` | 매수 신호 판단의 기본 확률 기준값임. 모델 객체의 개별 임계값이 있으면 모델 임계값을 우선 사용함. |

### 1.5 매매 설정

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `TAKE_PROFIT` | `0.02` | 모의투자 포지션의 익절 기준 수익률임. `0.02`는 2% 수익을 뜻함. |
| `STOP_LOSS` | `-0.03` | 모의투자 포지션의 손절 기준 수익률임. `-0.03`은 3% 손실을 뜻함. |
| `MAX_HOLD_MINUTES` | `30` | 포지션 최대 보유 시간임. 이 시간이 지나면 익절이나 손절 조건이 아니어도 청산 후보가 됨. |
| `SWITCH_MIN_CONFIDENCE_DELTA` | `0.0` | 보유 중인 포지션보다 더 좋은 신뢰도 신호로 갈아탈 때 요구하는 최소 신뢰도 차이임. `0.03`이면 새 후보가 기존 포지션보다 최소 3%p 높아야 교체함. |
| `INITIAL_CAPITAL` | `5000000` | 모의투자 시작 자본임. 단위는 원화임. |
| `PAPER_TRADING_ENABLED` | `False` | 모의투자 엔진 활성화 여부임. `True`이면 앱 초기화 시 모의투자 엔진을 생성함. |
| `SIMULATION_INTERVAL_SECONDS` | `60` | 모의투자 자동 루프 실행 간격임. 단위는 초임. |
| `FEE_BPS` | `5.0` | 거래 수수료를 베이시스 포인트 단위로 입력한 값임. `5.0`은 0.05%임. |
| `MARKETS` | `KRW-BTC,KRW-ETH,KRW-XRP,KRW-SOL,KRW-ADA` | 감시하고 추론할 업비트 마켓 목록임. 쉼표로 구분함. 빈 값이면 기본 5개 마켓을 사용함. |

### 1.6 리스크 및 성능 설정

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `RISK_PROFILE` | `neutral` | 문서상 위험 성향 설정값임. 현재 앱 초기화 코드는 기본값으로 `neutral`을 사용함. |
| `LOG_LEVEL` | `INFO` | 로그 출력 수준임. 현재 기본 로깅은 코드에서 `INFO`로 설정됨. |
| `LOG_RETENTION_DAYS` | `7` | 로그 보관 기간을 나타내는 운영 참고값임. 단위는 일임. |
| `CONCURRENT_MARKETS` | `5` | 동시에 처리할 마켓 수를 제한하기 위한 성능 참고값임. |
| `MEMORY_LIMIT_MB` | `4096` | 메모리 사용 한도를 나타내는 운영 참고값임. 단위는 MB임. |

## 2. 리스크 관리 파라미터

### 2.1 위험 성향

| 값 | 설명 |
| --- | --- |
| `conservative` | 보수형 투자 성향임. 포지션 수와 총 투자 비중을 낮게 유지함. |
| `neutral` | 중립형 투자 성향임. 기본 운용 성향으로 사용함. |
| `aggressive` | 공격형 투자 성향임. 더 많은 포지션과 더 높은 투자 비중을 허용함. |

### 2.2 배분 규칙

| 파라미터 | 설명 |
| --- | --- |
| `high_confidence_allocation` | 고신뢰 후보에 배정할 목표 비중임. |
| `medium_confidence_allocation` | 중간 신뢰 후보에 배정할 목표 비중임. |
| `low_confidence_allocation` | 낮은 신뢰 후보에 배정할 목표 비중임. 보수형에서는 낮은 신뢰 후보를 추가 배분하지 않음. |
| `max_per_market` | 한 마켓에 투자할 수 있는 최대 비중임. |
| `max_active_positions` | 동시에 보유할 수 있는 최대 포지션 수임. |
| `max_total_allocation` | 전체 자산 중 시장에 투입할 수 있는 최대 비중임. 현금 비중을 남기기 위한 상한값임. |

### 2.3 기본 배분값

| 위험 성향 | 고신뢰 | 중간 신뢰 | 낮은 신뢰 | 마켓별 최대 | 최대 포지션 | 총 투자 상한 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `conservative` | 0.30 | 0.15 | 0.05 | 0.10 | 3 | 0.60 |
| `neutral` | 0.50 | 0.30 | 0.10 | 0.15 | 5 | 0.80 |
| `aggressive` | 0.60 | 0.40 | 0.20 | 0.20 | 8 | 0.95 |

### 2.4 신뢰도 등급

| 등급 | 범위 | 설명 |
| --- | --- | --- |
| `high` | 0.75 이상 | 모델이 강한 상승 가능성을 준 상태임. |
| `medium` | 0.60 이상 0.75 미만 | 매수 후보로 볼 수 있지만 고신뢰보다는 약한 상태임. |
| `low` | 0.50 이상 0.60 미만 | 참고 신호에 가까운 상태임. 보수형에서는 신규 배분하지 않음. |

### 2.5 위험 알림 기준

| 파라미터 | 기본값 | 설명 |
| --- | ---: | --- |
| `critical_loss` | -0.05 | 긴급 손실 알림 기준임. 5% 이상 손실 상황을 뜻함. |
| `max_dd` | -0.10 | 최대 낙폭 경고 기준임. 10% 이상 낙폭 상황을 뜻함. |
| `overheating` | 0.95 | 과열 판단 참고 기준임. |

## 3. API 엔드포인트 파라미터

### 3.1 `GET /health`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `status` | 모델과 거래소가 정상 초기화되면 `healthy`, 일부가 준비되지 않으면 `degraded`로 반환함. |
| `timestamp` | 응답 생성 시각임. |
| `model_loaded` | 모델 로드 여부임. |
| `exchange_connected` | 거래소 연결 객체 생성 여부임. |
| `telegram_enabled` | 텔레그램 알림 객체 활성화 여부임. |
| `paper_trading` | 모의투자 루프 실행 여부임. |

### 3.2 `GET /signal`

요청 파라미터는 없음. 설정된 `MARKETS` 목록을 기준으로 실시간 신호를 생성함.

| 응답 필드 | 설명 |
| --- | --- |
| `timestamp` | 신호 응답 생성 시각임. |
| `results` | 마켓별 신호 목록임. |
| `portfolio` | 현재 포트폴리오 요약 정보임. |

`results` 내부 필드 설명임.

| 필드 | 설명 |
| --- | --- |
| `market` | 업비트 마켓 코드임. 예: `KRW-BTC`. |
| `price` | 신호 계산 시점의 현재가임. |
| `probability` | 모델이 계산한 상승 확률임. |
| `signal` | 매수 신호 여부임. `1`이면 매수 후보, `0`이면 비매수임. |
| `threshold` | 매수 신호 판단에 사용한 확률 임계값임. |
| `confidence_level` | 확률을 기준으로 나눈 신뢰도 등급임. |
| `return_5m` | 최근 5분 수익률 피처임. |
| `return_30m` | 최근 30분 수익률 피처임. |
| `horizon` | 예측에 사용한 모델 구간 이름임. 기본값은 `short_30m`임. |
| `allocation` | 현재 포트폴리오와 현금을 반영해 계산한 신규 배정 금액임. |
| `error` | 해당 마켓 처리 실패 시 오류 메시지를 담는 필드임. |

`portfolio` 내부 필드 설명임.

| 필드 | 설명 |
| --- | --- |
| `total_value` | 평가 기준 총 포트폴리오 가치임. |
| `active_positions` | 현재 보유 중인 포지션 수임. |
| `portfolio_return` | 초기 자본 대비 포트폴리오 수익률임. |
| `max_drawdown` | 현재까지의 최대 낙폭임. |
| `risk_level` | 최대 낙폭 기준 위험 등급임. |

### 3.3 `POST /allocation`

| 요청 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `capital` | `1000000` | 배분 계산에 사용할 투자 가능 금액임. 단위는 원화임. |
| `risk_profile` | `neutral` | 요청에서 전달하는 위험 성향 문자열임. 현재 계산은 생성된 포트폴리오 매니저의 위험 성향을 사용하므로 응답 표시용 성격이 강함. |

| 응답 필드 | 설명 |
| --- | --- |
| `capital` | 요청에 사용한 투자 가능 금액임. |
| `risk_profile` | 요청에 전달된 위험 성향 문자열임. |
| `allocation` | 마켓별 배분 금액임. |
| `total_allocated` | 전체 배분 금액 합계임. |
| `cash_reserve` | 배분 후 남는 현금임. |
| `allocated_pct` | 투자 가능 금액 중 배분된 비율임. |
| `error` | 계산 실패 시 오류 메시지임. |

### 3.4 `GET /portfolio`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `metrics` | 포트폴리오 성과 지표 묶음임. |
| `risk` | 포트폴리오 위험 요약 묶음임. |
| `positions` | 현재 보유 포지션 목록임. |
| `cash` | 모의투자 엔진이 있을 때의 보유 현금임. |
| `total_equity` | 현금과 포지션 평가액을 더한 총자산임. |

`positions` 내부 필드 설명임.

| 필드 | 설명 |
| --- | --- |
| `market` | 보유 마켓 코드임. |
| `quantity` | 보유 수량임. |
| `entry_price` | 진입 가격임. |
| `current_price` | 현재 가격임. 가격 조회 실패 시 진입 가격을 사용함. |
| `confidence` | 진입 시점의 모델 신뢰도임. |

### 3.5 `POST /paper/start`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `status` | `started`, `failed`, `already_running` 중 하나임. |
| `error` | 모의투자 엔진 또는 거래소가 초기화되지 않았을 때 반환되는 오류 메시지임. |

### 3.6 `POST /paper/stop`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `status` | `stopped`, `failed`, `already_stopped` 중 하나임. |
| `error` | 모의투자 엔진이 초기화되지 않았을 때 반환되는 오류 메시지임. |

### 3.7 `GET /paper/status`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `cash` | 현재 보유 현금임. |
| `position_value` | 보유 포지션의 현재 평가액 합계임. |
| `total_equity` | 현금과 포지션 평가액을 더한 총자산임. |
| `positions` | 보유 포지션 목록임. |
| `trade_history` | 최근 거래 이력 목록임. |
| `metrics` | 포트폴리오 성과 지표임. |
| `running` | 모의투자 루프 실행 여부임. |

### 3.8 `POST /test-telegram`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `success` | 테스트 메시지 발송 성공 여부임. |
| `message` | 테스트 메시지 발송 결과 설명임. |
| `error` | 텔레그램 객체가 없거나 발송 중 예외가 났을 때 반환되는 오류 메시지임. |

### 3.9 `GET /metrics`

요청 파라미터는 없음.

| 응답 필드 | 설명 |
| --- | --- |
| `timestamp` | 메트릭 생성 시각임. |
| `system.model_loaded` | 모델 로드 여부임. |
| `system.exchange_connected` | 거래소 연결 여부임. |
| `system.telegram_enabled` | 텔레그램 알림 활성화 여부임. |
| `portfolio.total_trades` | 누적 진입 거래 수임. |
| `portfolio.winning_trades` | 수익으로 종료된 거래 수임. |
| `portfolio.win_rate` | 승률임. 거래가 없으면 0임. |
| `portfolio.equity` | 현재 기록된 포트폴리오 자산 곡선의 마지막 값임. |

## 4. 모의투자 엔진 파라미터

### 4.1 `TradeEvent`

| 파라미터 | 설명 |
| --- | --- |
| `market` | 거래 대상 마켓 코드임. |
| `action` | 거래 방향임. `BUY` 또는 `SELL`을 사용함. |
| `price` | 체결 가격임. |
| `quantity` | 체결 수량임. |
| `reason` | 거래가 발생한 이유임. 예: 자동 진입, 익절, 손절, 보유 시간 초과, 더 강한 신호로 교체. |
| `timestamp` | 이벤트 생성 시각임. 생성자 내부에서 자동 기록함. |

### 4.2 `PaperTradingEngine`

| 파라미터 | 설명 |
| --- | --- |
| `trade_config` | 매매 설정 객체임. `INITIAL_CAPITAL`, `FEE_BPS`, `TAKE_PROFIT`, `STOP_LOSS`, `MAX_HOLD_MINUTES`, `SIMULATION_INTERVAL_SECONDS`, `MARKETS` 등을 참조함. |
| `risk_profile` | 포트폴리오 배분에 사용할 위험 성향임. 기본값은 `neutral`임. |
| `model` | 실시간 추론에 사용할 모델 또는 모델 묶음 객체임. 없으면 신호 생성이 불가능함. |
| `cash` | 모의투자 현금 잔고임. 초기값은 `INITIAL_CAPITAL`임. |
| `trade_history` | 최근 거래 이벤트를 저장하는 목록임. |
| `running` | 자동 모의투자 루프 실행 여부임. |

### 4.3 매수와 매도 실행 인자

| 함수 | 파라미터 | 설명 |
| --- | --- | --- |
| `_buy_market` | `market` | 매수할 마켓 코드임. |
| `_buy_market` | `price` | 매수 기준 가격임. |
| `_buy_market` | `confidence` | 매수 신호의 모델 신뢰도임. |
| `_buy_market` | `allocation` | 매수에 사용할 목표 금액임. 수수료와 현금 잔고를 반영해 실제 수량이 계산됨. |
| `_buy_market` | `notifier` | 텔레그램 알림 객체임. 없으면 알림 없이 매수 처리함. |
| `_buy_market` | `reason` | 매수 이유 문구임. 기본값은 자동 진입 신호임. |
| `_sell_market` | `market` | 매도할 마켓 코드임. |
| `_sell_market` | `price` | 매도 기준 가격임. |
| `_sell_market` | `exit_reason` | 매도 이유 문구임. 익절, 손절, 보유 시간 초과, 신뢰도 교체 등이 들어감. |
| `_sell_market` | `notifier` | 텔레그램 알림 객체임. 없으면 알림 없이 매도 처리함. |

### 4.4 신호 교체 인자

| 파라미터 | 설명 |
| --- | --- |
| `signals` | 마켓별 실시간 신호 목록임. `market`, `price`, `trend_probability`, `signal`, `confidence`를 포함함. |
| `market_prices` | 마켓별 현재가 사전임. 기존 포지션 평가와 청산 가격에 사용함. |
| `notifier` | 교체 매매 발생 시 알림을 보낼 텔레그램 객체임. |
| `SWITCH_MIN_CONFIDENCE_DELTA` | 새 후보가 기존 포지션보다 얼마나 더 높은 신뢰도를 가져야 교체할지 정하는 최소 차이임. |

### 4.5 자동 루프 인자

| 함수 | 파라미터 | 설명 |
| --- | --- | --- |
| `run_step` | `exchange` | OHLCV와 현재가를 가져올 ccxt 거래소 객체임. |
| `run_step` | `notifier` | 거래 알림에 사용할 텔레그램 객체임. |
| `start` | `exchange` | 자동 루프에서 반복 사용할 ccxt 거래소 객체임. |
| `start` | `notifier` | 자동 루프의 거래 알림에 사용할 텔레그램 객체임. |
| `stop` | 없음 | 실행 중인 자동 루프를 중지함. |

## 5. 포트폴리오 관리자 파라미터

### 5.1 `Position`

| 파라미터 | 설명 |
| --- | --- |
| `market` | 보유 마켓 코드임. |
| `entry_price` | 포지션 진입 가격임. |
| `quantity` | 보유 수량임. |
| `entry_time` | 포지션 진입 시각임. |
| `confidence` | 진입 당시 모델 신뢰도임. |
| `target_allocation` | 해당 포지션에 배정한 목표 금액임. |
| `position_value` | 진입가 기준 포지션 가치임. `entry_price * quantity`로 계산함. |
| `unrealized_return` | 현재가가 없을 때 쓰는 임시 평가값임. 실제 미실현 손익 계산에는 현재가가 필요함. |

### 5.2 `PortfolioRiskManager`

| 파라미터 | 설명 |
| --- | --- |
| `initial_capital` | 포트폴리오 초기 자본임. |
| `risk_profile` | 배분 규칙을 결정할 위험 성향임. |
| `fee_bps` | 거래 수수료임. 베이시스 포인트 단위로 입력함. |
| `positions` | 현재 보유 포지션 사전임. 키는 마켓 코드임. |
| `equity_curve` | 거래 후 자산 변화를 기록하는 목록임. |
| `total_trades` | 누적 진입 거래 수임. |
| `winning_trades` | 수익 거래 수임. |

### 5.3 배분 계산 인자

| 파라미터 | 설명 |
| --- | --- |
| `candidates` | 후보 마켓 데이터프레임임. 최소한 `market`, `trend_probability` 컬럼이 필요함. |
| `available_capital` | 새 포지션에 투입 가능한 현금임. |
| `total_equity` | 전체 평가 자산임. 없으면 `available_capital + current_position_value`로 계산함. |
| `current_position_value` | 기존 보유 포지션 평가액임. 없으면 진입가 기준 포지션 가치 합계로 계산함. |

### 5.4 포지션 추가와 청산 인자

| 함수 | 파라미터 | 설명 |
| --- | --- | --- |
| `add_position` | `market` | 추가할 마켓 코드임. |
| `add_position` | `entry_price` | 진입 가격임. |
| `add_position` | `quantity` | 진입 수량임. |
| `add_position` | `confidence` | 진입 신뢰도임. |
| `add_position` | `target_allocation` | 목표 배정 금액임. |
| `close_position` | `market` | 청산할 마켓 코드임. |
| `close_position` | `exit_price` | 청산 가격임. |
| `close_position` | `reason` | 청산 이유임. 기본값은 수동 청산임. |

### 5.5 포트폴리오 지표 인자

| 파라미터 | 설명 |
| --- | --- |
| `market_prices` | 마켓별 현재가 사전임. 포지션 평가, 총자산, 미실현 손익, 리스크 요약 계산에 사용함. |
| `risk_free_rate` | 샤프 비율 계산에 쓰는 연간 무위험 수익률 가정값임. 기본값은 0.02임. |

## 6. 텔레그램 알림 파라미터

### 6.1 `TelegramNotifier`

| 파라미터 | 설명 |
| --- | --- |
| `token` | 텔레그램 봇 토큰임. 실제 값은 로컬 `.env`에만 둠. |
| `chat_id` | 메시지를 받을 채팅 ID 또는 채널 사용자 이름임. |
| `enabled` | 알림 발송 활성화 여부임. |
| `channel` | 채널 사용자 이름이 들어온 경우 내부 기본 발송 대상으로 저장되는 값임. |
| `api_url` | 텔레그램 API 호출 주소임. 토큰을 포함하므로 로그나 문서에 실제 값을 남기지 않음. |

### 6.2 메시지 발송 인자

| 함수 | 파라미터 | 설명 |
| --- | --- | --- |
| `send_message` | `text` | 발송할 메시지 본문임. |
| `send_message` | `parse_mode` | 텔레그램 메시지 해석 모드임. 기본값은 `HTML`임. |
| `send_message` | `chat_id` | 기본 수신자 대신 사용할 별도 수신자임. |
| `send_signal_alert` | `market` | 신호가 발생한 마켓 코드임. |
| `send_signal_alert` | `signal_type` | 알림 유형임. 매수, 매도, 대기 등의 값을 사용함. |
| `send_signal_alert` | `probability` | 모델 신뢰도임. 0과 1 사이의 값임. |
| `send_signal_alert` | `price` | 신호 발생 시점 가격임. |
| `send_signal_alert` | `features` | 메시지에 추가할 보조 지표 사전임. 예: 5분 수익률, 30분 수익률, 신뢰도. |
| `send_risk_alert` | `alert_type` | 위험 알림 유형임. 긴급 손실, 과열 경고 등을 사용함. |
| `send_risk_alert` | `portfolio_value` | 현재 포트폴리오 가치임. |
| `send_risk_alert` | `loss_pct` | 손실률임. |
| `send_risk_alert` | `at_risk_markets` | 위험 상태로 판단한 마켓 목록임. |
| `send_risk_alert` | `risk_level` | 위험 등급임. 기본값은 `MEDIUM`임. |
| `send_portfolio_update` | `portfolio` | 포트폴리오 보유 현황 사전임. |
| `send_portfolio_update` | `total_value` | 총자산 평가액임. |
| `send_portfolio_update` | `daily_pnl` | 일간 손익 금액임. |
| `send_command_response` | `command` | 사용자가 요청한 명령어 이름임. |
| `send_command_response` | `response` | 명령어 처리 결과 사전임. |
| `send_to_channel` | `channel` | 메시지를 보낼 채널 사용자 이름 또는 ID임. 없으면 기본 채널을 사용함. |
| `send_to_channel` | `text` | 채널로 보낼 메시지 본문임. |

### 6.3 알림 유형

| 값 | 설명 |
| --- | --- |
| `BUY_SIGNAL` | 매수 신호 알림임. |
| `SELL_SIGNAL` | 매도 신호 알림임. |
| `HOLD` | 대기 상태 알림임. |
| `CRITICAL_LOSS` | 긴급 손실 알림임. |
| `OVERHEATING` | 시장 또는 포트폴리오 과열 경고 알림임. |
| `PORTFOLIO_UPDATE` | 포트폴리오 상태 업데이트 알림임. |

## 7. 실시간 모델 파라미터

### 7.1 `RealtimeFeatureConfig`

| 파라미터 | 기본값 | 설명 |
| --- | --- | --- |
| `horizon_minutes` | `30` | 타깃 수익률을 계산할 미래 구간임. 단위는 분임. |
| `min_return_bps` | `12.0` | 상승 타깃으로 인정할 최소 기대 수익률임. 베이시스 포인트 단위임. |
| `fee_bps` | `5.0` | 거래 비용 가정값임. 베이시스 포인트 단위임. |
| `positive_return_threshold` | 계산값 | `min_return_bps / 10000`으로 계산한 양의 수익률 기준임. |

### 7.2 `RealtimeCryptoModel`

| 파라미터 | 설명 |
| --- | --- |
| `model` | 실제 확률 예측을 수행하는 학습 모델 객체임. |
| `feature_columns` | 추론에 사용할 피처 컬럼 목록임. |
| `threshold` | 매수 신호를 1로 판단할 확률 기준값임. |
| `config` | 실시간 피처 생성 설정 객체임. |
| `metadata` | 모델 학습 정보, 성능, 선택 후보 등을 담는 선택 메타데이터임. |
| `feature_frame` | 추론할 피처 데이터프레임임. 모델 피처 순서에 맞춰 정렬됨. |

### 7.3 `RealtimeCryptoModelSuite`

| 파라미터 | 설명 |
| --- | --- |
| `models` | 예측 구간별 모델 사전임. 예: `short_30m`, `long_2d`. |
| `metadata` | 모델 묶음 전체에 대한 메타데이터임. |
| `horizon` | 사용할 예측 구간 이름임. 기본값은 `short_30m`임. |

### 7.4 피처 생성 함수 인자

| 함수 | 파라미터 | 설명 |
| --- | --- | --- |
| `build_realtime_features` | `frame` | 원천 시세 데이터프레임임. 업비트 OHLCV와 선택적 외부 데이터를 포함함. |
| `build_realtime_features` | `config` | 피처 생성 설정임. 없으면 기본 `RealtimeFeatureConfig`를 사용함. |
| `build_realtime_features` | `include_target` | 학습용 타깃 컬럼을 만들지 여부임. 실시간 추론에서는 `False`로 사용함. |
| `align_feature_frame` | `frame` | 모델 입력으로 정렬할 데이터프레임임. |
| `align_feature_frame` | `feature_columns` | 맞춰야 할 피처 컬럼 목록임. 없으면 기본 실시간 피처 목록을 사용함. |
| `_standardize_columns` | `frame` | 컬럼명을 표준 스키마로 맞출 원천 데이터프레임임. |
| `_round_figure_distance` | `price` | 라운드 피겨와의 거리를 계산할 가격 시리즈임. |

## 8. 입력 데이터 컬럼 파라미터

### 8.1 필수 기본 컬럼

| 컬럼 | 설명 |
| --- | --- |
| `market` | 마켓 코드임. 없으면 `asset` 또는 `symbol`에서 가져오고, 둘 다 없으면 `UNKNOWN`으로 채움. |
| `timestamp_utc` | 캔들 시각임. 없으면 `time` 또는 `open_time`을 사용함. |
| `open_u` | 업비트 시가임. 없으면 `open`에서 가져옴. |
| `high_u` | 업비트 고가임. 없으면 `high`에서 가져옴. |
| `low_u` | 업비트 저가임. 없으면 `low`에서 가져옴. |
| `close_u` | 업비트 종가임. 없으면 `close`에서 가져옴. |
| `volume_u` | 업비트 거래량임. 없으면 `volume`에서 가져옴. |
| `value` | 거래대금임. 없으면 `quote_asset_volume` 또는 `close_u * volume_u`로 계산함. |

### 8.2 선택 외부 컬럼

| 컬럼 | 설명 |
| --- | --- |
| `open_b` | 바이낸스 시가임. |
| `high_b` | 바이낸스 고가임. |
| `low_b` | 바이낸스 저가임. |
| `close_b` | 바이낸스 종가임. |
| `volume_b` | 바이낸스 거래량임. |
| `taker_buy_base_volume` | 바이낸스 테이커 매수 거래량임. 매수 압력 계산에 사용함. |
| `kimp_real` | 김치프리미엄 실측값임. 없고 `close_b`, `market_fx`가 있으면 계산함. |
| `market_fx` | 환율 또는 원화 환산 기준값임. |
| `btc_dominance` | 비트코인 도미넌스임. 없으면 `btc_dominance_pct`, `bitcoin_dominance`, `btc_market_cap_dominance` 후보 컬럼에서 가져옴. |
| `funding_rate` | 펀딩비임. 레버리지 과열도 계산에 사용함. |
| `open_interest` | 미결제약정임. 레버리지 과열도 계산에 사용함. |
| `future_return` | 학습용 미래 수익률임. 없고 `target_return_30m`이 있으면 그 값을 사용함. |

## 9. 모델 피처 컬럼

### 9.1 가격 수익률과 변동성

| 피처 | 설명 |
| --- | --- |
| `ret_1m`, `ret_3m`, `ret_5m`, `ret_15m`, `ret_30m`, `ret_60m`, `ret_120m`, `ret_240m`, `ret_720m`, `ret_1440m`, `ret_2880m` | 각 시간 구간별 업비트 종가 수익률임. |
| `range_pct` | 고가와 저가 차이를 종가로 나눈 캔들 변동폭임. |
| `body_pct` | 종가와 시가 차이를 시가로 나눈 캔들 몸통 비율임. |
| `upper_wick_pct` | 전체 캔들 범위 중 윗꼬리 비율임. |
| `lower_wick_pct` | 전체 캔들 범위 중 아랫꼬리 비율임. |
| `volatility_5m`, `volatility_15m`, `volatility_30m_rt`, `volatility_60m`, `volatility_240m`, `volatility_1440m` | 구간별 단기 수익률 표준편차 기반 변동성임. |
| `realized_vol_30m`, `realized_vol_120m`, `realized_vol_240m`, `realized_vol_1440m` | 로그수익률 제곱합 기반 실현 변동성임. |

### 9.2 추세와 기술 지표

| 피처 | 설명 |
| --- | --- |
| `ema_12_ratio`, `ema_26_ratio`, `ema_60_ratio`, `ema_120_ratio`, `ema_240_ratio`, `ema_1440_ratio` | 현재가가 각 지수이동평균 대비 얼마나 위아래에 있는지 나타내는 비율임. |
| `macd_ratio` | MACD 값을 종가로 나눈 비율임. |
| `macd_signal_ratio` | MACD 시그널 값을 종가로 나눈 비율임. |
| `macd_hist_ratio` | MACD 히스토그램을 종가로 나눈 비율임. |
| `rsi_14` | 14기간 RSI 값임. |
| `bb_z_20` | 20기간 볼린저 기준 z 점수임. |
| `dist_high_60` | 최근 60기간 고점 대비 현재가 거리임. |
| `dist_low_60` | 최근 60기간 저점 대비 현재가 거리임. |
| `breakout_20` | 직전 20기간 고점 돌파 여부임. 돌파하면 1, 아니면 0임. |

### 9.3 거래량과 거래대금

| 피처 | 설명 |
| --- | --- |
| `volume_rel_30`, `volume_rel_120`, `volume_rel_1440` | 각 기간 평균 거래량 대비 현재 거래량 비율임. |
| `value_rel_30`, `value_rel_120`, `value_rel_1440` | 각 기간 평균 거래대금 대비 현재 거래대금 비율임. |
| `value_z_120`, `value_z_1440` | 거래대금의 장단기 z 점수임. |

### 9.4 바이낸스와 업비트 괴리

| 피처 | 설명 |
| --- | --- |
| `binance_ret_1m`, `binance_ret_5m`, `binance_ret_15m`, `binance_ret_30m`, `binance_ret_60m`, `binance_ret_120m`, `binance_ret_240m` | 바이낸스 가격 기준 구간별 수익률임. |
| `binance_range_pct` | 바이낸스 캔들의 고저 범위 비율임. |
| `binance_volume_rel_30`, `binance_volume_rel_240` | 바이낸스 평균 거래량 대비 현재 거래량 비율임. |
| `binance_taker_buy_ratio` | 바이낸스 거래량 중 테이커 매수 비중임. |
| `upbit_binance_ret_spread_5m`, `upbit_binance_ret_spread_15m`, `upbit_binance_ret_spread_60m`, `upbit_binance_ret_spread_240m` | 업비트 수익률과 바이낸스 수익률의 차이임. |

### 9.5 김치프리미엄, 환율, 도미넌스

| 피처 | 설명 |
| --- | --- |
| `kimp_real` | 업비트 원화 가격과 바이낸스 환산 가격의 괴리율임. |
| `kimp_velocity_5m`, `kimp_velocity_15m`, `kimp_velocity_60m`, `kimp_velocity_240m` | 김치프리미엄 변화 속도임. |
| `kimp_z_1440` | 장기 평균 대비 김치프리미엄 z 점수임. |
| `market_fx` | 원화 환산에 사용하는 환율 또는 기준값임. |
| `market_fx_change_60m`, `market_fx_change_1440m` | 환율의 60분 및 1440분 변화율임. |
| `btc_dominance` | 비트코인 도미넌스임. |
| `btc_dominance_change_60m`, `btc_dominance_change_1440m` | 비트코인 도미넌스 변화율임. |
| `btc_dominance_z_1440` | 장기 평균 대비 비트코인 도미넌스 z 점수임. |

### 9.6 시장 레짐과 순환매

| 피처 | 설명 |
| --- | --- |
| `btc_ret_15m`, `btc_ret_60m`, `btc_volatility_30m` | 비트코인 기준 단기 수익률과 변동성임. 전체 시장 레짐 판단에 사용함. |
| `eth_ret_15m`, `eth_ret_60m`, `eth_volatility_30m` | 이더리움 기준 단기 수익률과 변동성임. 알트코인 레짐 판단에 사용함. |
| `btc_lead_lag_60m` | 해당 마켓의 60분 수익률과 비트코인 60분 수익률의 차이임. |
| `alt_rotation_pressure` | 비트코인 상승 이후 알트코인으로 자금이 이동할 가능성을 나타내는 압력 점수임. |

### 9.7 행동재무와 마이크로스트럭처

| 피처 | 설명 |
| --- | --- |
| `rsi_overbought` | RSI 과매수 정도를 0에서 1 사이로 정규화한 값임. |
| `rsi_oversold` | RSI 과매도 정도를 0에서 1 사이로 정규화한 값임. |
| `fomo_chase_score` | 추격 매수 과열 가능성을 거래량, 돌파, 상승 충격으로 계산한 점수임. |
| `capitulation_score` | 패닉셀 또는 투매 가능성을 거래량, 하락 충격, 아랫꼬리로 계산한 점수임. |
| `round_figure_distance` | 1, 2, 5, 10 계열 라운드 피겨와 현재 가격의 상대 거리임. |
| `near_round_figure` | 라운드 피겨 근접도를 0에서 1 사이로 변환한 값임. |
| `liquidity_pool_pressure_up` | 직전 고점 부근 상방 유동성 풀 압력임. |
| `liquidity_pool_pressure_down` | 직전 저점 부근 하방 유동성 풀 압력임. |
| `stop_hunt_up` | 고점 돌파 후 되밀림이 발생한 상방 유동성 사냥 신호임. |
| `stop_hunt_down` | 저점 이탈 후 회복이 발생한 하방 유동성 사냥 신호임. |
| `funding_rate` | 파생시장 펀딩비임. 과열 판단에 사용함. |
| `open_interest_change_60m` | 60분 미결제약정 변화율임. |
| `leverage_overheat` | 펀딩비, 미결제약정 증가, 추격 매수 점수를 결합한 레버리지 과열도임. |

### 9.8 시간대 피처

| 피처 | 설명 |
| --- | --- |
| `us_session` | 미국 활동 시간대 여부임. |
| `asia_session` | 아시아 활동 시간대 여부임. |
| `session_overlap` | 주요 시장 활동 시간이 겹치는 구간 여부임. |
| `weekend_activity` | 주말 거래량 활동성을 반영한 값임. |
| `hour_sin`, `hour_cos` | 하루 중 시간을 주기형 값으로 표현한 피처임. |
| `dow_sin`, `dow_cos` | 요일을 주기형 값으로 표현한 피처임. |

## 10. 운영 시 주의할 파라미터

| 파라미터 | 주의점 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | 실제 토큰은 로컬 `.env`에만 두고 GitHub에 올리지 않음. |
| `TELEGRAM_CHAT_ID` | 개인 채팅 ID나 채널 ID도 민감정보로 보고 공개 저장소에 올리지 않음. |
| `MODEL_FILE` | 모델 파일은 용량이 크거나 내부 학습 정보가 포함될 수 있으므로 필요할 때만 별도 배포함. |
| `TAKE_PROFIT`, `STOP_LOSS` | 너무 좁게 잡으면 수수료와 노이즈에 자주 청산될 수 있음. |
| `SWITCH_MIN_CONFIDENCE_DELTA` | 0에 가까우면 더 좋은 신호가 보일 때 즉시 교체가 잦아지고, 높게 잡으면 회전매매가 줄어듦. |
| `FEE_BPS` | 실제 거래 수수료보다 낮게 잡으면 백테스트나 모의투자 성과가 과대평가될 수 있음. |
| `MARKETS` | 너무 많은 마켓을 넣으면 API 호출량과 지연 시간이 늘어남. |
