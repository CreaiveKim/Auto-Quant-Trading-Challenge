from types import SimpleNamespace

from paper_trader import PaperTradingEngine
from risk_manager.portfolio import RiskProfile


def _trade_config(**overrides):
    config = {
        "INITIAL_CAPITAL": 1_000_000,
        "FEE_BPS": 0,
        "TAKE_PROFIT": 0.02,
        "STOP_LOSS": -0.03,
        "MAX_HOLD_MINUTES": 30,
        "SWITCH_MIN_CONFIDENCE_DELTA": 0.0,
        "MARKETS": ["KRW-BTC", "KRW-ETH", "KRW-XRP"],
        "PAPER_TRADING_ENABLED": True,
        "SIMULATION_INTERVAL_SECONDS": 60,
    }
    config.update(overrides)
    return SimpleNamespace(**config)


def test_rotates_weak_position_to_stronger_unheld_signal():
    engine = PaperTradingEngine(_trade_config(), RiskProfile.NEUTRAL)
    engine._buy_market("KRW-BTC", price=100.0, confidence=0.61, allocation=100_000, notifier=None)

    signals = [
        {
            "market": "KRW-BTC",
            "price": 101.0,
            "trend_probability": 0.61,
            "signal": 1,
            "confidence": "medium",
        },
        {
            "market": "KRW-ETH",
            "price": 50.0,
            "trend_probability": 0.72,
            "signal": 1,
            "confidence": "medium",
        },
    ]
    market_prices = {"KRW-BTC": 101.0, "KRW-ETH": 50.0}

    assert engine._rotate_to_stronger_signal(signals, market_prices, notifier=None) is True

    assert "KRW-BTC" not in engine.portfolio_manager.positions
    assert "KRW-ETH" in engine.portfolio_manager.positions
    assert engine.portfolio_manager.positions["KRW-ETH"].confidence == 0.72
    assert [event.action for event in engine.trade_history[-2:]] == ["SELL", "BUY"]


def test_does_not_rotate_when_replacement_confidence_is_not_better():
    engine = PaperTradingEngine(_trade_config(), RiskProfile.NEUTRAL)
    engine._buy_market("KRW-BTC", price=100.0, confidence=0.80, allocation=100_000, notifier=None)

    signals = [
        {
            "market": "KRW-ETH",
            "price": 50.0,
            "trend_probability": 0.79,
            "signal": 1,
            "confidence": "high",
        },
    ]

    assert engine._rotate_to_stronger_signal(signals, {"KRW-BTC": 100.0, "KRW-ETH": 50.0}, None) is False

    assert "KRW-BTC" in engine.portfolio_manager.positions
    assert "KRW-ETH" not in engine.portfolio_manager.positions
