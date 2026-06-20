"""Mock Upbit auto-trading engine for paper trading."""

import ccxt
import logging
from datetime import datetime, timedelta
from threading import Event, Thread
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from config import config
from quant_app.realtime_model import build_realtime_features
from risk_manager.portfolio import PortfolioRiskManager, RiskProfile, Position
from telegram_bot.notifier import AlertType, TelegramNotifier

logger = logging.getLogger(__name__)


class TradeEvent:
    def __init__(self, market: str, action: str, price: float, quantity: float, reason: str):
        self.timestamp = datetime.now()
        self.market = market
        self.action = action
        self.price = price
        self.quantity = quantity
        self.reason = reason

    def to_dict(self):
        return {
            "timestamp": self.timestamp.isoformat(),
            "market": self.market,
            "action": self.action,
            "price": self.price,
            "quantity": self.quantity,
            "reason": self.reason,
        }


class PaperTradingEngine:
    def __init__(self, trade_config, risk_profile: RiskProfile = RiskProfile.NEUTRAL, model: Optional[Any] = None):
        self.trade_config = trade_config
        self.risk_profile = risk_profile
        self.model = model
        self.portfolio_manager = PortfolioRiskManager(
            initial_capital=trade_config.INITIAL_CAPITAL,
            risk_profile=risk_profile,
            fee_bps=trade_config.FEE_BPS,
        )
        self.cash = trade_config.INITIAL_CAPITAL
        self.trade_history: List[TradeEvent] = []
        self.running = False
        self._thread: Optional[Thread] = None
        self._stop_event: Optional[Event] = None

    def _calculate_position_value(self, market_prices: Dict[str, float]) -> float:
        return sum(
            pos.quantity * market_prices.get(pos.market, pos.entry_price)
            for pos in self.portfolio_manager.positions.values()
        )

    def get_portfolio_snapshot(self, market_prices: Dict[str, float]) -> Dict:
        position_value = self._calculate_position_value(market_prices)
        total_equity = self.cash + position_value
        return {
            "cash": round(self.cash, 2),
            "position_value": round(position_value, 2),
            "total_equity": round(total_equity, 2),
            "positions": [
                {
                    "market": pos.market,
                    "entry_price": pos.entry_price,
                    "quantity": pos.quantity,
                    "confidence": pos.confidence,
                    "target_allocation": pos.target_allocation,
                    "current_price": market_prices.get(pos.market, pos.entry_price),
                }
                for pos in self.portfolio_manager.positions.values()
            ],
            "trade_history": [event.to_dict() for event in self.trade_history[-20:]],
            "metrics": self.portfolio_manager.calculate_portfolio_metrics(market_prices),
        }

    def _send_trade_alert(self, notifier: Optional[TelegramNotifier], event: TradeEvent):
        if not notifier:
            return

        text = (
            f"📈 Paper Trade {event.action}\n"
            f"시장: {event.market}\n"
            f"가격: {event.price:.0f} KRW\n"
            f"수량: {event.quantity:.6f}\n"
            f"사유: {event.reason}"
        )
        notifier.send_message(text)

    def _buy_market(
        self,
        market: str,
        price: float,
        confidence: float,
        allocation: float,
        notifier: Optional[TelegramNotifier],
        reason: str = "Auto-entry signal",
    ):
        if self.cash <= 0 or allocation <= 0:
            return None

        max_cost = min(self.cash, allocation)
        quantity = max_cost / price
        if quantity <= 0:
            return None

        fee = max_cost * (self.portfolio_manager.fee_bps / 10000)
        total_cost = max_cost + fee
        if total_cost > self.cash:
            total_cost = self.cash
            quantity = (self.cash - fee) / price

        if quantity <= 0:
            return None

        self.cash -= total_cost
        position = self.portfolio_manager.add_position(
            market=market,
            entry_price=price,
            quantity=quantity,
            confidence=confidence,
            target_allocation=allocation,
        )
        event = TradeEvent(
            market=market,
            action="BUY",
            price=price,
            quantity=quantity,
            reason=reason,
        )
        self.trade_history.append(event)
        self._send_trade_alert(notifier, event)
        logger.info(f"Paper buy executed: {market} qty={quantity:.6f} cost={total_cost:.0f}")
        return position

    def _sell_market(self, market: str, price: float, exit_reason: str, notifier: Optional[TelegramNotifier]):
        if market not in self.portfolio_manager.positions:
            return None

        position = self.portfolio_manager.positions[market]
        fee = position.quantity * price * (self.portfolio_manager.fee_bps / 10000)
        proceeds = position.quantity * price - fee
        pnl, pnl_pct = self.portfolio_manager.close_position(market, price, reason=exit_reason)
        self.cash += proceeds
        event = TradeEvent(
            market=market,
            action="SELL",
            price=price,
            quantity=position.quantity,
            reason=exit_reason,
        )
        self.trade_history.append(event)
        self._send_trade_alert(notifier, event)
        logger.info(f"Paper sell executed: {market} qty={position.quantity:.6f} proceeds={proceeds:.0f} pnl={pnl:.0f}")
        return pnl, pnl_pct

    def _confidence_score(self, signal: Dict[str, Any]) -> float:
        try:
            return float(signal.get("trend_probability", 0.0))
        except (TypeError, ValueError):
            return 0.0

    def _find_rotation_candidate(self, signals: List[Dict[str, Any]]) -> Optional[tuple[str, Dict[str, Any]]]:
        if not self.portfolio_manager.positions:
            return None

        open_markets = set(self.portfolio_manager.positions)
        eligible = [
            signal
            for signal in signals
            if int(signal.get("signal", 0)) == 1 and signal.get("market") not in open_markets
        ]
        if not eligible:
            return None

        replacement = max(eligible, key=self._confidence_score)
        weakest_position = min(
            self.portfolio_manager.positions.values(),
            key=lambda position: float(position.confidence or 0.0),
        )
        min_delta = max(0.0, float(getattr(self.trade_config, "SWITCH_MIN_CONFIDENCE_DELTA", 0.0)))
        replacement_confidence = self._confidence_score(replacement)

        if replacement_confidence <= float(weakest_position.confidence or 0.0) + min_delta:
            return None

        return weakest_position.market, replacement

    def _rotate_to_stronger_signal(
        self,
        signals: List[Dict[str, Any]],
        market_prices: Dict[str, float],
        notifier: Optional[TelegramNotifier],
    ) -> bool:
        rotation = self._find_rotation_candidate(signals)
        if rotation is None:
            return False

        exit_market, replacement = rotation
        exit_price = market_prices.get(exit_market)
        if exit_price is None:
            logger.warning(f"Skip rotation because current price is unavailable for {exit_market}")
            return False

        replacement_market = str(replacement["market"])
        replacement_price = float(replacement["price"])
        replacement_confidence = self._confidence_score(replacement)
        current_confidence = float(self.portfolio_manager.positions[exit_market].confidence or 0.0)

        self._sell_market(
            market=exit_market,
            price=exit_price,
            exit_reason=(
                f"Rotate to {replacement_market}: "
                f"confidence {replacement_confidence:.2%} > {current_confidence:.2%}"
            ),
            notifier=notifier,
        )

        position_value = self._calculate_position_value(market_prices)
        total_equity = self.cash + position_value
        allocations = self.portfolio_manager.calculate_allocation(
            pd.DataFrame([replacement]),
            available_capital=self.cash,
            total_equity=total_equity,
            current_position_value=position_value,
        )
        allocation = allocations.get(replacement_market, 0.0)
        if allocation <= 0:
            logger.info(f"Rotation sold {exit_market}, but no allocation was available for {replacement_market}")
            return True

        self._buy_market(
            market=replacement_market,
            price=replacement_price,
            confidence=replacement_confidence,
            allocation=allocation,
            notifier=notifier,
            reason=f"Rotate from {exit_market} to stronger confidence signal",
        )
        return True

    def _build_signals(self, exchange: ccxt.Exchange) -> List[Dict[str, Any]]:
        signals = []
        candidates = []

        if self.model is None:
            logger.error("Paper trader cannot build signals without a realtime model")
            return candidates

        for market in self.trade_config.MARKETS:
            try:
                ohlcv = exchange.fetch_ohlcv(market, timeframe="1m", limit=200)
                if not ohlcv:
                    continue

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

                features = build_realtime_features(pd.DataFrame(rows), include_target=False)
                latest = (
                    features
                    .sort_values("timestamp_utc")
                    .groupby("market")
                    .tail(1)
                )
                pred = self.model.predict_signal(latest, horizon="short_30m")
                row = pred.iloc[0]
                last_price = float(row["close_u"])
                trend_probability = float(row["trend_probability"])
                signal = int(row["signal"])
                confidence = "high" if trend_probability >= 0.75 else "medium" if trend_probability >= 0.60 else "low"
                candidates.append({
                    "market": market,
                    "price": last_price,
                    "trend_probability": trend_probability,
                    "signal": signal,
                    "confidence": confidence,
                })
            except Exception as exc:
                logger.warning(f"Paper trader signal build failed for {market}: {exc}")

        return candidates

    def run_step(self, exchange: ccxt.Exchange, notifier: Optional[TelegramNotifier] = None) -> Dict:
        market_prices = {}
        ohlcv_results = []

        signals = self._build_signals(exchange)
        if not signals:
            return {"error": "No signals could be generated"}

        for signal in signals:
            market_prices[signal["market"]] = signal["price"]

        self._rotate_to_stronger_signal(signals, market_prices, notifier)

        candidates_df = pd.DataFrame(signals)
        position_value = self._calculate_position_value(market_prices)
        total_equity = self.cash + position_value
        allocations = self.portfolio_manager.calculate_allocation(
            candidates_df,
            available_capital=self.cash,
            total_equity=total_equity,
            current_position_value=position_value,
        )

        for signal in signals:
            market = signal["market"]
            price = signal["price"]
            if signal["signal"] != 1:
                continue

            if market in self.portfolio_manager.positions:
                continue

            allocation = allocations.get(market, 0.0)
            if allocation > 0:
                self._buy_market(
                    market=market,
                    price=price,
                    confidence=self._confidence_score(signal),
                    allocation=allocation,
                    notifier=notifier,
                )

        now = datetime.now()
        for market, position in list(self.portfolio_manager.positions.items()):
            current_price = market_prices.get(market)
            if current_price is None:
                continue

            holding_minutes = (now - position.entry_time.to_pydatetime()) / timedelta(minutes=1)
            pnl_pct = (current_price / position.entry_price - 1)

            if pnl_pct >= self.trade_config.TAKE_PROFIT or pnl_pct <= self.trade_config.STOP_LOSS or holding_minutes >= self.trade_config.MAX_HOLD_MINUTES:
                self._sell_market(
                    market=market,
                    price=current_price,
                    exit_reason=(
                        "Take profit"
                        if pnl_pct >= self.trade_config.TAKE_PROFIT
                        else "Stop loss"
                        if pnl_pct <= self.trade_config.STOP_LOSS
                        else "Max hold time"
                    ),
                    notifier=notifier,
                )

        snapshot = self.get_portfolio_snapshot(market_prices)
        return {
            "step_timestamp": datetime.now().isoformat(),
            "cash": snapshot["cash"],
            "position_value": snapshot["position_value"],
            "total_equity": snapshot["total_equity"],
            "open_positions": len(self.portfolio_manager.positions),
            "trade_history": [event.to_dict() for event in self.trade_history[-10:]],
            "signals": signals,
        }

    def start(self, exchange: ccxt.Exchange, notifier: Optional[TelegramNotifier] = None):
        if self.running:
            return False

        self._stop_event = Event()
        self.running = True

        def loop():
            while not self._stop_event.is_set():
                try:
                    self.run_step(exchange, notifier=notifier)
                except Exception as exc:
                    logger.error(f"Paper trading loop error: {exc}")
                self._stop_event.wait(self.trade_config.SIMULATION_INTERVAL_SECONDS)

        self._thread = Thread(target=loop, daemon=True)
        self._thread.start()
        logger.info("Paper trading engine started")
        return True

    def stop(self):
        if not self.running or self._stop_event is None:
            return False
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self.running = False
        logger.info("Paper trading engine stopped")
        return True
