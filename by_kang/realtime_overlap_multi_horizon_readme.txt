업비트-바이낸스 중복 코인 멀티 호라이즌 모델 README
============================================================

1. 산출물
- 모델 pkl: C:\Quant\models\realtime_overlap_multi_horizon_model.pkl
- 성능 JSON: C:\Quant\models\realtime_overlap_multi_horizon_metrics.json
- pkl 타입: RealtimeCryptoModelSuite
- 학습 장치: cuda
- 추론 기본 장치: cpu

2. 데이터 범위
- 학습 대상은 업비트와 바이낸스 데이터가 모두 존재하는 중복 코인만 사용했습니다.
- 로드 방식: overlap-only-merged-cache
- 전체 캐시 기간: 2017-09-01 00:00:00 ~ 2026-02-26 05:49:00
- 최근 4년 컷오프: 2022-02-26 05:49:00
- 사용 행 수: 10,702,258
- 사용 마켓: KRW-BTC, KRW-DOGE, KRW-ENSO, KRW-ETH, KRW-SOL, KRW-XRP
- 바이낸스 심볼: BTCUSDT, DOGEUSDT, ENSOUSDT, ETHUSDT, SOLUSDT, XRPUSDT

3. 투자 기간별 모델
- short_30m: horizon=30분, 양성 기준=12.0bp
  선택 후보=xgb_gpu_depth3_regularized, threshold=0.611646, test AP=0.454693, ROC-AUC=0.609005, net=0.000377, hit=0.5331, trades=30138
- short_4h: horizon=240분, 양성 기준=40.0bp
  선택 후보=xgb_gpu_depth2_low_latency, threshold=0.580446, test AP=0.390320, ROC-AUC=0.554856, net=-0.000546, hit=0.4737, trades=39255
- long_2d: horizon=2880분, 양성 기준=150.0bp
  선택 후보=xgb_gpu_depth3_regularized, threshold=0.509135, test AP=0.435845, ROC-AUC=0.657996, net=0.012369, hit=0.4210, trades=145369
- long_30d: horizon=43200분, 양성 기준=500.0bp
  선택 후보=xgb_gpu_depth3_regularized, threshold=0.553982, test AP=0.082291, ROC-AUC=0.420002, net=-0.210097, hit=0.0729, trades=101298
- long_60d: horizon=86400분, 양성 기준=800.0bp
  선택 후보=xgb_gpu_depth3_regularized, threshold=0.480575, test AP=0.000000, ROC-AUC=0.000000, net=-0.244404, hit=0.0000, trades=51944

4. 성능테스트 결과
- 성능테스트는 최신 구간을 test set으로 고정한 시간 순서 검증입니다.
- 각 horizon마다 train/validation/test를 다시 나누고, horizon 길이만큼 purge gap을 둬서 미래 수익률 라벨이 학습 구간에 새지 않게 했습니다.
- AP는 Average Precision입니다. 양성 라벨 비율이 일정하지 않은 금융 데이터에서는 ROC-AUC보다 매수 후보 랭킹 품질을 더 직접적으로 보여줍니다.
- net은 선택 threshold 이상 신호에서 수수료 5bp를 차감한 평균 미래 수익률입니다.
- latency20은 20개 종목을 한 번에 추론할 때의 평균 지연 시간입니다.
- 이번 버전은 인간 투자자 행동 패턴을 실시간 계산 가능한 경량 피처로 반영했습니다: FOMO 추격매수, 패닉 투매, 라운드 피겨/유동성 풀, 시간대별 활동성, BTC 이후 알트 순환매 프록시.
- 현재 parquet에는 funding rate와 open interest 히스토리가 없어 해당 피처는 중립값으로 저장됩니다. 파생상품 히스토리를 추가한 뒤 재학습하면 leverage overheat 교차검증 피처가 활성화됩니다.

성능테스트 요약:
- short_30m
  test 시작=2025-07-22T02:41:00, purge=30분, test rows=160,000
  선택 모델=xgb_gpu_depth3_regularized, threshold=0.611646
  AP=0.454693, ROC-AUC=0.609005, MCC=0.117605, Brier=0.241560
  신호 수=30,138, 신호 커버리지=18.84%, hit rate=53.31%, 비용 차감 평균 수익률=0.0377%
  20종목 추론 지연=2.7958ms
- short_4h
  test 시작=2025-07-21T23:46:00, purge=240분, test rows=160,000
  선택 모델=xgb_gpu_depth2_low_latency, threshold=0.580446
  AP=0.390320, ROC-AUC=0.554856, MCC=0.059103, Brier=0.259294
  신호 수=39,255, 신호 커버리지=24.53%, hit rate=47.37%, 비용 차감 평균 수익률=-0.0546%
  20종목 추론 지연=2.6680ms
- long_2d
  test 시작=2025-07-20T11:00:00, purge=2880분, test rows=160,000
  선택 모델=xgb_gpu_depth3_regularized, threshold=0.509135
  AP=0.435845, ROC-AUC=0.657996, MCC=0.180175, Brier=0.255838
  신호 수=145,369, 신호 커버리지=90.86%, hit rate=42.10%, 비용 차감 평균 수익률=1.2369%
  20종목 추론 지연=2.8825ms
- long_30d
  test 시작=2025-06-26T19:40:00, purge=43200분, test rows=160,000
  선택 모델=xgb_gpu_depth3_regularized, threshold=0.553982
  AP=0.082291, ROC-AUC=0.420002, MCC=-0.093512, Brier=0.281101
  신호 수=101,298, 신호 커버리지=63.31%, hit rate=7.29%, 비용 차감 평균 수익률=-21.0097%
  20종목 추론 지연=3.0507ms
- long_60d
  test 시작=2025-06-01T18:12:00, purge=86400분, test rows=160,000
  선택 모델=xgb_gpu_depth3_regularized, threshold=0.480575
  AP=0.000000, ROC-AUC=0.000000, MCC=0.000000, Brier=0.000000
  신호 수=51,944, 신호 커버리지=32.46%, hit rate=0.00%, 비용 차감 평균 수익률=-24.4404%
  20종목 추론 지연=2.9063ms

성능테스트 해석:
- AP와 ROC-AUC는 방향성 랭킹 품질, net과 hit rate는 threshold 통과 신호의 거래 품질을 봅니다.
- trade coverage가 높으면 모델이 너무 자주 진입할 수 있으므로, 실거래에서는 리스크 가드와 포지션 사이징을 함께 확인해야 합니다.
- funding rate와 open interest는 현재 학습 데이터에 없어 직접 학습되지 않았습니다. 파생상품 히스토리를 추가하면 같은 피처 이름으로 재학습할 수 있습니다.
- CPU 추론 지연은 latency20 항목으로 확인합니다. 후보 모델은 depth 2~3 XGBoost로 제한해 실시간 추론을 가볍게 유지했습니다.

5. 실시간 반영 변수
- 김치프리미엄: `kimp_real`을 직접 넣거나, 업비트 가격 `close_u`, 바이낸스 가격 `close_b`, 원/달러 환율 `market_fx`로 자동 계산합니다.
- 원/달러 환율: `market_fx`와 60분/1440분 변화율을 피처로 사용합니다.
- 비트코인 도미넌스: 실시간 API에서 `btc_dominance` 컬럼을 넣으면 현재값, 60분/1440분 변화율, 1440분 z-score를 계산합니다.
- 단, 현재 학습 데이터에는 과거 비트코인 도미넌스 시계열이 없어 해당 피처의 학습된 영향은 제한적입니다. 과거 도미넌스 데이터를 붙이면 같은 스크립트로 재학습하면 됩니다.
- 파생상품 과열도: `funding_rate`, `open_interest` 컬럼을 넣으면 funding/OI 기반 과열 프록시를 계산합니다. 현재 학습 parquet에는 히스토리가 없어 기본 모델에서는 중립값입니다.

6. 폭락 리스크 방어
- `src/quant_app/risk_guard.py`에 모델과 독립적인 하드 리스크 가드를 추가했습니다.
- 모델이 매수 신호를 내더라도 risk guard가 `block_new_entries`, `reduce_only`, `kill_switch`를 반환하면 신규 주문을 막습니다.
- 전역 차단 조건: BTC/ETH 급락, 중복 코인 다수가 동시에 하락하는 breadth crash, 원/달러 환율 급변, 김치프리미엄 급변, 비트코인 도미넌스 급변, 데이터 지연/누락.
- breadth crash는 최소 4개 이상 중복 코인이 관측될 때만 발동해, 일부 데이터만 들어온 테스트 상황에서 과도하게 전체 차단하지 않도록 했습니다.
- 종목별 차단 조건: 해당 코인의 5분/15분/60분 급락, 변동성 폭증, 업비트-바이낸스 수익률 괴리, 거래대금 급감, 호가 스프레드 확대.
- 종목별 위험은 해당 코인의 신호만 0으로 바꾸고 전체 시스템은 `caution`으로 낮춰 포지션 크기를 줄이도록 설계했습니다.
- `long_30d`, `long_60d`는 현재 성능테스트가 좋지 않으므로 risk guard 기본 설정에서 실거래 신규 진입을 차단합니다.
- 이 장치는 예상치 못한 폭락 상황에서 모델 확률보다 우선합니다. 자동매매에서는 risk guard 통과 후에만 주문 API를 호출해야 합니다.

7. API 연동 가능 여부
- 가능합니다. 이 pkl은 모델과 피처 순서, threshold, horizon 설정을 모두 담고 있습니다.
- 나중에 Upbit/Binance/환율/도미넌스 API에서 최근 1분봉 히스토리를 DataFrame으로 만든 뒤 `build_realtime_features(..., include_target=False)`를 호출하면 됩니다.
- 완성된 1분봉만 넣어야 하며, 진행 중인 캔들은 확정 전까지 제외하는 것이 안전합니다.

8. 사용 예시
```python
import pickle
from quant_app.realtime_model import build_realtime_features
from quant_app.risk_guard import evaluate_risk, apply_risk_guard

with open('models/realtime_overlap_multi_horizon_model.pkl', 'rb') as f:
    suite = pickle.load(f)

features = build_realtime_features(live_frame, include_target=False)
latest = features.sort_values('timestamp_utc').groupby('market').tail(1)
short_signals = suite.predict_signal(latest, horizon='short_30m')
risk = evaluate_risk(latest, expected_markets=suite.metadata['source_meta']['markets'])
safe_short_signals = apply_risk_guard(short_signals, risk, horizon='short_30m')
```

9. 과적합 방지
- 시간 순서 train/validation/test split을 사용하고 horizon 길이만큼 purge gap을 둡니다.
- XGBoost 후보는 얕은 트리, subsample, colsample, min_child_weight, L1/L2 정규화, early stopping을 사용합니다.
- 선택 점수는 test/validation AP, ROC-AUC, 비용 차감 평균 수익률, hit rate, 추론 지연을 함께 봅니다.

10. 후보별 전체 실험
- short_30m
  xgb_gpu_depth2_low_latency: val AP=0.490036, test AP=0.455125, test net=0.000326, latency20=2.7460ms
  xgb_gpu_depth3_regularized: val AP=0.496601, test AP=0.454693, test net=0.000377, latency20=2.7958ms
- short_4h
  xgb_gpu_depth2_low_latency: val AP=0.458687, test AP=0.390320, test net=-0.000546, latency20=2.6680ms
  xgb_gpu_depth3_regularized: val AP=0.460912, test AP=0.386099, test net=-0.000561, latency20=3.1720ms
- long_2d
  xgb_gpu_depth2_low_latency: val AP=0.559607, test AP=0.417163, test net=0.009631, latency20=2.7539ms
  xgb_gpu_depth3_regularized: val AP=0.571618, test AP=0.435845, test net=0.012369, latency20=2.8825ms
- long_30d
  xgb_gpu_depth2_low_latency: val AP=0.160305, test AP=0.068056, test net=-0.330019, latency20=2.9733ms
  xgb_gpu_depth3_regularized: val AP=0.103846, test AP=0.082291, test net=-0.210097, latency20=3.0507ms
- long_60d
  xgb_gpu_depth2_low_latency: val AP=0.768471, test AP=0.000000, test net=-0.247435, latency20=3.0685ms
  xgb_gpu_depth3_regularized: val AP=0.848579, test AP=0.000000, test net=-0.244404, latency20=2.9063ms
