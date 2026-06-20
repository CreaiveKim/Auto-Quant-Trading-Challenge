import pandas as pd

from risk_manager.portfolio import PortfolioRiskManager, RiskProfile


def _candidates(count: int, probability: float = 0.9) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "market": [f"KRW-TEST-{idx}" for idx in range(count)],
            "trend_probability": [probability] * count,
        }
    )


def test_neutral_allocation_keeps_cash_reserve_when_candidates_are_many():
    manager = PortfolioRiskManager(
        initial_capital=1_000_000,
        risk_profile=RiskProfile.NEUTRAL,
        fee_bps=0,
    )

    allocation = manager.calculate_allocation(_candidates(10), available_capital=1_000_000)

    assert sum(allocation.values()) == 750_000
    assert sum(allocation.values()) < 1_000_000
    assert len(allocation) == manager.allocation_rules.max_active_positions


def test_aggressive_allocation_does_not_overfill_total_cap():
    manager = PortfolioRiskManager(
        initial_capital=1_000_000,
        risk_profile=RiskProfile.AGGRESSIVE,
        fee_bps=0,
    )

    allocation = manager.calculate_allocation(_candidates(10), available_capital=1_000_000)

    assert sum(allocation.values()) == 950_000
    assert sum(allocation.values()) < 1_000_000
    assert len(allocation) == 5


def test_existing_positions_reduce_remaining_deployment_budget():
    manager = PortfolioRiskManager(
        initial_capital=1_000_000,
        risk_profile=RiskProfile.NEUTRAL,
        fee_bps=0,
    )
    manager.add_position(
        market="KRW-BTC",
        entry_price=1,
        quantity=700_000,
        confidence=0.9,
        target_allocation=700_000,
    )

    allocation = manager.calculate_allocation(
        _candidates(1),
        available_capital=300_000,
        total_equity=1_000_000,
        current_position_value=700_000,
    )

    assert sum(allocation.values()) == 100_000


def test_no_new_allocation_when_total_cap_is_already_filled():
    manager = PortfolioRiskManager(
        initial_capital=1_000_000,
        risk_profile=RiskProfile.NEUTRAL,
        fee_bps=0,
    )
    manager.add_position(
        market="KRW-BTC",
        entry_price=1,
        quantity=800_000,
        confidence=0.9,
        target_allocation=800_000,
    )

    allocation = manager.calculate_allocation(
        _candidates(1),
        available_capital=200_000,
        total_equity=1_000_000,
        current_position_value=800_000,
    )

    assert allocation == {}
