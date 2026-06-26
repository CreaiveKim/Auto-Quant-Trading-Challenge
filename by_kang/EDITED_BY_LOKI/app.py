"""
텔레그램 알림을 포함한 AI 기반 암호화폐 매매 시스템.

주요 기능:
- XGBoost 모델 기반 실시간 거래 신호
- 텔레그램 알림과 모니터링
- 위험 성향 기반 포트폴리오 배분
- 포지션 관리
"""

import os
import pickle
import logging
import json
from datetime import datetime
from typing import Dict, Any, List

import pandas as pd
import numpy as np
from flask import Flask, jsonify, request
import ccxt

# 로컬 모듈 불러오기
from config import config
from paper_trader import PaperTradingEngine
from telegram_bot.notifier import TelegramNotifier, AlertType
from risk_manager.portfolio import PortfolioRiskManager, RiskProfile
from quant_app.realtime_model import build_realtime_features

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 플라스크 앱 초기화
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# 전역 상태
model = None
exchange = None
notifier = None
portfolio_manager = None
paper_trader = None


def initialize_app():
    """애플리케이션 초기화."""
    global model, exchange, notifier, portfolio_manager, paper_trader

    # 1. 모델 로드
    try:
        model_path = config.MODEL_FILE
        if not os.path.exists(model_path):
            logger.warning(f"Model file not found: {model_path}")
            model = None
        else:
            try:
                with open(model_path, "rb") as f:
                    model = pickle.load(f)
            except ModuleNotFoundError as mnfe:
                # 피클에 저장된 모듈 경로가 현재 경로와 다를 수 있음.
                # ai-server2 사본이 있으면 sys.path에 추가해 호환 로드를 시도함.
                import sys
                candidate = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ai-server2"))
                if os.path.isdir(candidate) and candidate not in sys.path:
                    sys.path.insert(0, candidate)
                    logger.info(f"Added to sys.path for model unpickle: {candidate}")
                with open(model_path, "rb") as f:
                    model = pickle.load(f)
            
            # XGBoost 구버전 속성 호환 보정
            if hasattr(model, 'available_horizons'):
                for h in model.available_horizons():
                    if hasattr(model, 'models') and h in model.models:
                        xgb = model.models[h].model
                        patches = {
                            "use_label_encoder": False,
                            "gpu_id": None,
                            "predictor": None,
                        }
                        for k, v in patches.items():
                            if not hasattr(xgb, k):
                                setattr(xgb, k, v)
            logger.info(f"Model loaded successfully: {model_path}")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        model = None

    # 2. 거래소 연결 초기화
    try:
        exchange = ccxt.upbit()
        logger.info("Exchange (Upbit) initialized")
    except Exception as e:
        logger.error(f"Failed to initialize exchange: {e}")
        exchange = None

    # 3. 텔레그램 알림 초기화
    if config.telegram.ENABLED:
        try:
            notifier = TelegramNotifier(
                token=config.telegram.TOKEN,
                chat_id=config.telegram.CHAT_ID,
                enabled=config.telegram.ENABLED,
            )
            if notifier.test_connection():
                logger.info("Telegram bot initialized successfully")
            else:
                logger.warning("Telegram bot connection test failed")
                notifier = None
        except Exception as e:
            logger.error(f"Failed to initialize Telegram bot: {e}")
            notifier = None
    else:
        logger.info("Telegram bot disabled (no token provided)")
        notifier = None

    # 4. 포트폴리오와 모의투자 엔진 초기화
    try:
        risk_profile = RiskProfile.NEUTRAL  # 기본 위험 성향
        if config.trade.PAPER_TRADING_ENABLED:
            paper_trader = PaperTradingEngine(
                trade_config=config.trade,
                risk_profile=risk_profile,
                model=model,
            )
            portfolio_manager = paper_trader.portfolio_manager
            logger.info(
                f"Paper trading engine initialized with {config.trade.INITIAL_CAPITAL:.0f} KRW capital"
            )
        else:
            portfolio_manager = PortfolioRiskManager(
                initial_capital=config.trade.INITIAL_CAPITAL,
                risk_profile=risk_profile,
                fee_bps=config.trade.FEE_BPS,
            )
            logger.info(f"Portfolio manager initialized: {risk_profile.value} profile")
    except Exception as e:
        logger.error(f"Failed to initialize portfolio manager: {e}")
        portfolio_manager = None


@app.before_request
def before_request():
    """요청 전 시스템 상태 점검."""
    # 상태 확인과 모의투자 제어 엔드포인트는 초기화가 덜 된 상태에서도 허용함.
    if request.endpoint in [
        "health_check",
        "paper_status",
        "start_paper_trading",
        "stop_paper_trading",
    ]:
        return None

    if not model or not exchange:
        return jsonify({"error": "System not properly initialized"}), 500


def build_ohlcv_frame(market: str, ohlcv: List[List[float]]) -> pd.DataFrame:
    """ccxt OHLCV 행을 실시간 피처 입력 스키마로 변환."""

    rows = []
    for candle in ohlcv:
        ts, open_, high, low, close, volume = candle
        rows.append({
            "market": market,
            "timestamp_utc": pd.to_datetime(ts, unit="ms"),
            "open_u": open_,
            "high_u": high,
            "low_u": low,
            "close_u": close,
            "volume_u": volume,
        })
    return pd.DataFrame(rows)


def predict_market_signal(
    market: str,
    ohlcv: List[List[float]],
    horizon: str = "short_30m",
) -> Dict[str, Any]:
    """배포된 실시간 모델로 단일 업비트 마켓 신호 계산."""

    if not ohlcv:
        raise ValueError("No OHLCV data")

    frame = build_ohlcv_frame(market, ohlcv)
    features = build_realtime_features(frame, include_target=False)
    if features.empty:
        raise ValueError("No realtime features could be built")

    latest = (
        features
        .sort_values("timestamp_utc")
        .groupby("market")
        .tail(1)
    )
    pred = model.predict_signal(latest, horizon=horizon)
    row = pred.iloc[0]
    probability = float(row["trend_probability"])

    if probability >= 0.75:
        confidence_level = "high"
    elif probability >= 0.60:
        confidence_level = "medium"
    else:
        confidence_level = "low"

    def safe_float(value: Any, default: float = 0.0) -> float:
        try:
            out = float(value)
        except (TypeError, ValueError):
            return default
        return out if np.isfinite(out) else default

    return {
        "market": market,
        "price": float(row["close_u"]),
        "probability": probability,
        "signal": int(row["signal"]),
        "threshold": float(row["threshold"]),
        "confidence_level": confidence_level,
        "return_5m": safe_float(row.get("ret_5m", 0.0)),
        "return_30m": safe_float(row.get("ret_30m", 0.0)),
        "horizon": horizon,
    }


def build_signal_response() -> Dict[str, Any]:
    """/signal 응답에 사용할 실시간 신호와 포트폴리오 정보 생성."""

    results = []
    market_prices = {}

    for market in config.trade.MARKETS:
        try:
            ohlcv = exchange.fetch_ohlcv(market, timeframe="1m", limit=200)
            result = predict_market_signal(market, ohlcv)
            result["allocation"] = 0.0
            market_prices[market] = result["price"]
            results.append(result)

            if result["signal"] == 1 and notifier:
                notifier.send_signal_alert(
                    market=market,
                    signal_type=AlertType.BUY_SIGNAL,
                    probability=result["probability"],
                    price=result["price"],
                    features={
                        "return_5m": f"{result['return_5m']:+.2%}",
                        "return_30m": f"{result['return_30m']:+.2%}",
                        "confidence": f"{result['probability']:.1%}",
                    },
                )
        except Exception as exc:
            logger.error(f"Error processing market {market}: {exc}")
            results.append({
                "market": market,
                "error": str(exc),
            })

    if portfolio_manager and results:
        signal_candidates = [
            {
                "market": row["market"],
                "trend_probability": row["probability"],
            }
            for row in results
            if row.get("signal") == 1 and "probability" in row
        ]
        if signal_candidates:
            current_position_value = sum(
                pos.quantity * market_prices.get(pos.market, pos.entry_price)
                for pos in portfolio_manager.positions.values()
            )
            if paper_trader:
                available_capital = paper_trader.cash
                total_equity = paper_trader.cash + current_position_value
            else:
                total_equity = max(portfolio_manager.initial_capital, current_position_value)
                available_capital = max(0.0, total_equity - current_position_value)

            signal_allocations = portfolio_manager.calculate_allocation(
                pd.DataFrame(signal_candidates),
                available_capital=available_capital,
                total_equity=total_equity,
                current_position_value=current_position_value,
            )
            for row in results:
                if row.get("signal") == 1:
                    row["allocation"] = float(signal_allocations.get(row["market"], 0.0))

    if portfolio_manager and market_prices:
        portfolio_metrics = portfolio_manager.calculate_portfolio_metrics(market_prices)
        risk_summary = portfolio_manager.get_risk_summary(market_prices)
        portfolio_info = {
            "total_value": portfolio_metrics["total_value"],
            "active_positions": portfolio_metrics["active_positions"],
            "portfolio_return": portfolio_metrics["total_return"],
            "max_drawdown": risk_summary["max_drawdown"],
            "risk_level": risk_summary["risk_level"],
        }
    else:
        portfolio_info = {}

    return {
        "timestamp": datetime.now().isoformat(),
        "results": results,
        "portfolio": portfolio_info,
    }


@app.route("/health", methods=["GET"])
def health_check():
    """서비스 상태 반환."""
    return jsonify({
        "status": "healthy" if model and exchange else "degraded",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": model is not None,
        "exchange_connected": exchange is not None,
        "telegram_enabled": notifier is not None,
        "paper_trading": paper_trader.running if paper_trader else False,
    }), 200


@app.route("/paper/start", methods=["POST"])
def start_paper_trading():
    """모의투자 루프 시작."""
    if not paper_trader or not exchange:
        return jsonify({"error": "Paper trading engine or exchange not initialized"}), 500

    if paper_trader.running:
        return jsonify({"status": "already_running"}), 200

    success = paper_trader.start(exchange, notifier=notifier)
    return jsonify({"status": "started" if success else "failed"}), 200 if success else 500


@app.route("/paper/stop", methods=["POST"])
def stop_paper_trading():
    """모의투자 루프 중지."""
    if not paper_trader:
        return jsonify({"error": "Paper trading engine not initialized"}), 500

    if not paper_trader.running:
        return jsonify({"status": "already_stopped"}), 200

    success = paper_trader.stop()
    return jsonify({"status": "stopped" if success else "failed"}), 200 if success else 500


@app.route("/paper/status", methods=["GET"])
def paper_status():
    """모의투자 상태 반환."""
    if not paper_trader or not exchange:
        return jsonify({"error": "Paper trading engine not initialized"}), 500

    market_prices = {}
    for market in config.trade.MARKETS:
        try:
            ticker = exchange.fetch_ticker(market)
            market_prices[market] = float(ticker["last"])
        except Exception as e:
            logger.warning(f"Error fetching price for {market}: {e}")

    snapshot = paper_trader.get_portfolio_snapshot(market_prices)
    snapshot["running"] = paper_trader.running
    return jsonify(snapshot), 200


@app.route("/signal", methods=["GET"])
def signal():
    """실시간 거래 신호와 포트폴리오 요약 반환.
    
    반환:
        {
            "timestamp": "2026-06-16T10:30:00",
            "results": [
                {
                    "market": "KRW-BTC",
                    "price": 75000000,
                    "probability": 0.65,
                    "signal": 1,
                    "allocation": 50000,
                    "confidence_level": "high"
                }
            ],
            "portfolio": {
                "total_value": 1000000,
                "active_positions": 1,
                "portfolio_return": 0.05
            }
        }
    """
    return jsonify(build_signal_response()), 200

@app.route("/allocation", methods=["POST"])
def get_allocation():
    """현재 후보 신호 기준으로 투자금 배분 계산.
    
    요청:
        {
            "capital": 1000000,
            "risk_profile": "neutral"
        }
    """
    try:
        data = request.get_json()
        capital = data.get("capital", 1_000_000)
        risk_profile_str = data.get("risk_profile", "neutral")

        # 현재 마켓별 실시간 신호 수집
        ohlcv_data = []
        for market in config.trade.MARKETS:
            try:
                ohlcv = exchange.fetch_ohlcv(market, timeframe="1m", limit=200)
                if ohlcv:
                    _, _, _, _, close, _ = ohlcv[-1]
                    ohlcv_data.append({
                        "market": market,
                        "trend_probability": predict_market_signal(market, ohlcv)["probability"],
                    })
            except Exception as e:
                logger.error(f"Error fetching {market}: {e}")

        candidates_df = pd.DataFrame(ohlcv_data)

        if candidates_df.empty:
            return jsonify({"error": "No market data available"}), 400

        # 위험 성향별 배분 계산
        allocation = portfolio_manager.calculate_allocation(candidates_df, capital)

        total_allocated = sum(allocation.values())

        return jsonify({
            "capital": capital,
            "risk_profile": risk_profile_str,
            "allocation": allocation,
            "total_allocated": total_allocated,
            "cash_reserve": max(0.0, capital - total_allocated),
            "allocated_pct": total_allocated / capital if capital else 0.0,
        }), 200

    except Exception as e:
        logger.error(f"Allocation calculation error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/portfolio", methods=["GET"])
def get_portfolio():
    """포트폴리오 상태 반환."""
    if not portfolio_manager:
        return jsonify({"error": "Portfolio manager not initialized"}), 500

    # 현재 가격 조회
    market_prices = {}
    for market in config.trade.MARKETS:
        try:
            ticker = exchange.fetch_ticker(market)
            market_prices[market] = ticker["last"]
        except Exception as e:
            logger.warning(f"Error fetching price for {market}: {e}")

    metrics = portfolio_manager.calculate_portfolio_metrics(market_prices)
    risk_summary = portfolio_manager.get_risk_summary(market_prices)

    portfolio_response = {
        "metrics": metrics,
        "risk": risk_summary,
        "positions": [
            {
                "market": pos.market,
                "quantity": pos.quantity,
                "entry_price": pos.entry_price,
                "current_price": market_prices.get(pos.market, pos.entry_price),
                "confidence": pos.confidence,
            }
            for pos in portfolio_manager.positions.values()
        ],
    }

    if paper_trader:
        portfolio_response["cash"] = round(paper_trader.cash, 2)
        portfolio_response["total_equity"] = round(
            paper_trader.cash + sum(
                pos.quantity * market_prices.get(pos.market, pos.entry_price)
                for pos in portfolio_manager.positions.values()
            ),
            2,
        )

    return jsonify(portfolio_response), 200


@app.route("/test-telegram", methods=["POST"])
def test_telegram():
    """텔레그램 테스트 메시지 발송."""
    if not notifier:
        return jsonify({"error": "Telegram bot not initialized"}), 400

    try:
        result = notifier.send_message("Telegram bot 연결 테스트 - 알림 기능이 정상 동작함.")
        return jsonify({
            "success": result,
            "message": "Test message sent" if result else "Failed to send test message",
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/metrics", methods=["GET"])
def get_metrics():
    """서비스 메트릭 반환."""
    if not portfolio_manager:
        return jsonify({"error": "Portfolio manager not initialized"}), 500

    return jsonify({
        "timestamp": datetime.now().isoformat(),
        "system": {
            "model_loaded": model is not None,
            "exchange_connected": exchange is not None,
            "telegram_enabled": notifier is not None,
        },
        "portfolio": {
            "total_trades": portfolio_manager.total_trades,
            "winning_trades": portfolio_manager.winning_trades,
            "win_rate": (
                portfolio_manager.winning_trades / portfolio_manager.total_trades
                if portfolio_manager.total_trades > 0
                else 0
            ),
            "equity": portfolio_manager.equity_curve[-1],
        },
    }), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    # 애플리케이션 초기화
    initialize_app()

    # 플라스크 서버 실행
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG,
    )
