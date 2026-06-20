"""
Risk Manager - split-investment portfolio allocation and risk management.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


class RiskProfile(Enum):
    """Investment style."""

    CONSERVATIVE = "conservative"
    NEUTRAL = "neutral"
    AGGRESSIVE = "aggressive"


@dataclass
class Position:
    """Open position."""

    market: str
    entry_price: float
    quantity: float
    entry_time: pd.Timestamp
    confidence: float
    target_allocation: float

    @property
    def position_value(self) -> float:
        """Entry-value of the position."""

        return self.entry_price * self.quantity

    @property
    def unrealized_return(self) -> float:
        """Placeholder return value; current price is needed for a real PnL."""

        return self.quantity * self.entry_price


@dataclass
class AllocationRule:
    """Split-investment allocation rule."""

    high_confidence_allocation: float
    medium_confidence_allocation: float
    low_confidence_allocation: float
    max_per_market: float = 0.15
    max_active_positions: int = 5
    max_total_allocation: float = 0.95


class PortfolioRiskManager:
    """Portfolio risk manager and split-investment allocator."""

    def __init__(
        self,
        initial_capital: float,
        risk_profile: RiskProfile = RiskProfile.NEUTRAL,
        fee_bps: float = 5.0,
    ):
        self.initial_capital = initial_capital
        self.risk_profile = risk_profile
        self.fee_bps = fee_bps

        self.positions: Dict[str, Position] = {}
        self.equity_curve: List[float] = [initial_capital]
        self.total_trades = 0
        self.winning_trades = 0

        self.allocation_rules = self._get_allocation_rules()

    def _get_allocation_rules(self) -> AllocationRule:
        """Return allocation rules for the selected risk profile."""

        rules_map = {
            RiskProfile.CONSERVATIVE: AllocationRule(
                high_confidence_allocation=0.30,
                medium_confidence_allocation=0.15,
                low_confidence_allocation=0.05,
                max_per_market=0.10,
                max_active_positions=3,
                max_total_allocation=0.60,
            ),
            RiskProfile.NEUTRAL: AllocationRule(
                high_confidence_allocation=0.50,
                medium_confidence_allocation=0.30,
                low_confidence_allocation=0.10,
                max_per_market=0.15,
                max_active_positions=5,
                max_total_allocation=0.80,
            ),
            RiskProfile.AGGRESSIVE: AllocationRule(
                high_confidence_allocation=0.60,
                medium_confidence_allocation=0.40,
                low_confidence_allocation=0.20,
                max_per_market=0.20,
                max_active_positions=8,
                max_total_allocation=0.95,
            ),
        }
        return rules_map[self.risk_profile]

    def calculate_allocation(
        self,
        candidates: pd.DataFrame,
        available_capital: float,
        total_equity: Optional[float] = None,
        current_position_value: Optional[float] = None,
    ) -> Dict[str, float]:
        """
        Calculate split allocations from confidence.

        The allocator does not force all available cash into the market. It only
        deploys up to the profile's max_total_allocation after accounting for
        positions that are already open.
        """

        allocation: Dict[str, float] = {}

        if candidates.empty or available_capital <= 0:
            return allocation

        if current_position_value is None:
            current_position_value = sum(pos.position_value for pos in self.positions.values())

        if total_equity is None:
            total_equity = available_capital + current_position_value

        total_equity = max(float(total_equity), 0.0)
        current_position_value = max(float(current_position_value), 0.0)
        available_capital = max(float(available_capital), 0.0)

        max_invested_value = total_equity * self.allocation_rules.max_total_allocation
        deployment_budget = min(
            available_capital,
            max(0.0, max_invested_value - current_position_value),
        )
        available_position_slots = self.allocation_rules.max_active_positions - len(self.positions)

        if deployment_budget <= 0 or available_position_slots <= 0:
            return allocation

        candidates = candidates.copy()
        if self.positions:
            candidates = candidates[~candidates["market"].isin(self.positions.keys())]

        if candidates.empty:
            return allocation

        candidates = candidates.sort_values("trend_probability", ascending=False)
        high_conf = candidates[candidates["trend_probability"] >= 0.75]
        medium_conf = candidates[
            (candidates["trend_probability"] >= 0.60) & (candidates["trend_probability"] < 0.75)
        ]
        low_conf = candidates[candidates["trend_probability"] < 0.60]

        allocated_gross = 0.0

        def add_group(group: pd.DataFrame, allocation_pct: float) -> None:
            nonlocal allocated_gross

            for _, row in group.iterrows():
                if len(allocation) >= available_position_slots:
                    break

                remaining_budget = deployment_budget - allocated_gross
                if remaining_budget <= 0:
                    break

                market = row["market"]
                alloc_pct = min(allocation_pct, self.allocation_rules.max_per_market)
                gross_amount = min(total_equity * alloc_pct, remaining_budget)
                if gross_amount <= 0:
                    continue

                allocation[market] = gross_amount
                allocated_gross += gross_amount

        add_group(high_conf, self.allocation_rules.high_confidence_allocation)
        add_group(medium_conf, self.allocation_rules.medium_confidence_allocation)

        if self.risk_profile != RiskProfile.CONSERVATIVE:
            add_group(low_conf, self.allocation_rules.low_confidence_allocation)

        for market in list(allocation):
            fee = allocation[market] * (self.fee_bps / 10000)
            allocation[market] = max(0.0, allocation[market] - fee)
            if allocation[market] <= 0:
                del allocation[market]

        return allocation

    def add_position(
        self,
        market: str,
        entry_price: float,
        quantity: float,
        confidence: float,
        target_allocation: float,
    ) -> Position:
        """Add a position."""

        position = Position(
            market=market,
            entry_price=entry_price,
            quantity=quantity,
            entry_time=pd.Timestamp.now(),
            confidence=confidence,
            target_allocation=target_allocation,
        )
        self.positions[market] = position
        self.total_trades += 1
        logger.info(f"Position added: {market} @ {entry_price:.2f}, qty={quantity:.4f}")
        return position

    def close_position(
        self,
        market: str,
        exit_price: float,
        reason: str = "Manual",
    ) -> Tuple[float, float]:
        """Close a position and return PnL and PnL percent."""

        if market not in self.positions:
            logger.warning(f"Position not found: {market}")
            return 0.0, 0.0

        position = self.positions[market]
        position_value = position.quantity * position.entry_price
        exit_value = position.quantity * exit_price
        pnl = exit_value - position_value
        pnl_pct = pnl / position_value if position_value > 0 else 0

        if pnl > 0:
            self.winning_trades += 1

        self.equity_curve.append(self.equity_curve[-1] + pnl)

        del self.positions[market]
        logger.info(f"Position closed: {market}, PnL={pnl:+.2f} ({pnl_pct:+.2%}), reason={reason}")
        return pnl, pnl_pct

    def calculate_portfolio_metrics(self, market_prices: Dict[str, float]) -> Dict:
        """Calculate portfolio metrics."""

        total_value = 0.0
        total_unrealized_pnl = 0.0

        for market, position in self.positions.items():
            if market not in market_prices:
                continue
            current_price = market_prices[market]
            position_value = position.quantity * current_price
            total_value += position_value
            unrealized_pnl = position_value - (position.quantity * position.entry_price)
            total_unrealized_pnl += unrealized_pnl

        total_value += self.equity_curve[-1] - sum(
            pos.quantity * pos.entry_price for pos in self.positions.values()
        )

        portfolio_return = (total_value - self.initial_capital) / self.initial_capital

        return {
            "total_value": total_value,
            "unrealized_pnl": total_unrealized_pnl,
            "total_return": portfolio_return,
            "active_positions": len(self.positions),
            "win_rate": (
                self.winning_trades / self.total_trades
                if self.total_trades > 0
                else 0
            ),
            "max_drawdown": self._calculate_max_drawdown(),
            "sharpe_ratio": self._calculate_sharpe_ratio(),
        }

    def _calculate_max_drawdown(self) -> float:
        """Calculate max drawdown."""

        if not self.equity_curve:
            return 0.0
        equity = np.array(self.equity_curve)
        peak = np.maximum.accumulate(equity)
        dd = (equity - peak) / peak
        return float(np.min(dd))

    def _calculate_sharpe_ratio(self, risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio using a daily risk-free rate assumption."""

        if len(self.equity_curve) < 2:
            return 0.0
        returns = np.diff(self.equity_curve) / np.array(self.equity_curve[:-1])
        if len(returns) == 0:
            return 0.0
        excess_return = np.mean(returns) - (risk_free_rate / 252)
        return float((excess_return / np.std(returns)) * np.sqrt(252)) if np.std(returns) > 0 else 0.0

    def get_risk_summary(self, market_prices: Dict[str, float]) -> Dict:
        """Summarize portfolio risk."""

        metrics = self.calculate_portfolio_metrics(market_prices)
        max_dd = metrics["max_drawdown"]

        if max_dd < -0.05:
            risk_level = "CRITICAL"
        elif max_dd < -0.02:
            risk_level = "HIGH"
        elif max_dd < -0.01:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "risk_level": risk_level,
            "max_drawdown": max_dd,
            "total_return": metrics["total_return"],
            "sharpe_ratio": metrics["sharpe_ratio"],
            "active_positions": metrics["active_positions"],
        }
