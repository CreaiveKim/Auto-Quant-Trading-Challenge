"""피처 선택 기반 실시간 모델 재학습 스크립트."""

from __future__ import annotations

import json
import os
import pickle
import sys
import time
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.dataset as ds
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    matthews_corrcoef,
    roc_auc_score,
)
from xgboost import XGBClassifier


ROOT = Path(__file__).resolve().parent
WORKSPACE_ROOT = ROOT.parent
PROJECT_ROOT = WORKSPACE_ROOT.parent
REPORT_DIR = ROOT / "reports"
MODEL_DIR = ROOT / "models"
DATA_PATH = PROJECT_ROOT / "master.parquet"

sys.path.insert(0, str(ROOT))
from quant_app.realtime_model import (  # noqa: E402
    REALTIME_FEATURE_COLUMNS,
    RealtimeCryptoModel,
    RealtimeCryptoModelSuite,
    build_realtime_features,
)


RANDOM_STATE = 42
RECENT_CUTOFF = "2024-10-01"
MAX_TRAIN_ROWS = 260_000
MAX_EVAL_ROWS = 90_000
MAX_FINAL_TRAIN_ROWS = 360_000
FEE_BPS = 5.0
MIN_VALID_TRADES = 80
MIN_TEST_TRADES = 100
MIN_STABLE_RATE = 0.50
MAX_SELECTED_FEATURES = 64

HORIZON_CONFIGS = {
    "short_30m": {"minutes": 30, "min_return_bps": 12.0},
    "short_4h": {"minutes": 240, "min_return_bps": 40.0},
    "long_2d": {"minutes": 2880, "min_return_bps": 150.0},
    "long_30d": {"minutes": 43200, "min_return_bps": 500.0},
    "long_60d": {"minutes": 86400, "min_return_bps": 800.0},
}


DOMAIN_CORE_FEATURES = [
    "ret_1m",
    "ret_3m",
    "ret_5m",
    "ret_15m",
    "ret_30m",
    "ret_60m",
    "ret_120m",
    "ret_240m",
    "range_pct",
    "body_pct",
    "upper_wick_pct",
    "lower_wick_pct",
    "volatility_5m",
    "volatility_15m",
    "volatility_30m_rt",
    "volatility_60m",
    "realized_vol_30m",
    "realized_vol_120m",
    "ema_12_ratio",
    "ema_26_ratio",
    "ema_60_ratio",
    "ema_120_ratio",
    "macd_ratio",
    "macd_signal_ratio",
    "macd_hist_ratio",
    "rsi_14",
    "bb_z_20",
    "dist_high_60",
    "dist_low_60",
    "breakout_20",
    "volume_rel_30",
    "volume_rel_120",
    "value_rel_30",
    "value_rel_120",
    "binance_ret_5m",
    "binance_ret_15m",
    "binance_ret_60m",
    "binance_range_pct",
    "binance_volume_rel_30",
    "binance_taker_buy_ratio",
    "upbit_binance_ret_spread_5m",
    "upbit_binance_ret_spread_15m",
    "upbit_binance_ret_spread_60m",
    "kimp_real",
    "kimp_velocity_15m",
    "kimp_velocity_60m",
    "market_fx",
    "market_fx_change_60m",
    "btc_ret_15m",
    "btc_ret_60m",
    "btc_volatility_30m",
    "eth_ret_15m",
    "eth_ret_60m",
    "eth_volatility_30m",
    "rsi_overbought",
    "rsi_oversold",
    "fomo_chase_score",
    "capitulation_score",
    "round_figure_distance",
    "near_round_figure",
    "liquidity_pool_pressure_up",
    "liquidity_pool_pressure_down",
    "stop_hunt_up",
    "stop_hunt_down",
    "us_session",
    "asia_session",
    "session_overlap",
    "weekend_activity",
    "btc_lead_lag_60m",
    "alt_rotation_pressure",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
]


LOW_LATENCY_FEATURES = [
    "ret_1m",
    "ret_3m",
    "ret_5m",
    "ret_15m",
    "ret_30m",
    "ret_60m",
    "range_pct",
    "body_pct",
    "upper_wick_pct",
    "lower_wick_pct",
    "volatility_5m",
    "volatility_15m",
    "volatility_30m_rt",
    "ema_12_ratio",
    "ema_26_ratio",
    "ema_60_ratio",
    "macd_ratio",
    "macd_hist_ratio",
    "rsi_14",
    "bb_z_20",
    "breakout_20",
    "volume_rel_30",
    "value_rel_30",
    "binance_ret_5m",
    "binance_ret_15m",
    "binance_volume_rel_30",
    "upbit_binance_ret_spread_5m",
    "kimp_real",
    "rsi_overbought",
    "rsi_oversold",
    "fomo_chase_score",
    "capitulation_score",
    "near_round_figure",
    "stop_hunt_up",
    "stop_hunt_down",
    "session_overlap",
    "btc_lead_lag_60m",
    "alt_rotation_pressure",
]


def _existing(features: list[str]) -> list[str]:
    return [feature for feature in features if feature in REALTIME_FEATURE_COLUMNS]


def load_recent_frame() -> pd.DataFrame:
    dataset = ds.dataset(str(DATA_PATH), format="parquet")
    cutoff = pa.scalar(np.datetime64(RECENT_CUTOFF, "ns"), type=pa.timestamp("ns"))
    columns = [
        "market",
        "timestamp_utc",
        "open_u",
        "high_u",
        "low_u",
        "close_u",
        "volume_u",
        "value",
        "symbol",
        "open_b",
        "high_b",
        "low_b",
        "close_b",
        "volume_b",
        "taker_buy_base_volume",
        "market_fx",
        "kimp_real",
    ]
    table = dataset.to_table(
        columns=columns,
        filter=ds.field("timestamp_utc") >= cutoff,
    )
    frame = table.to_pandas()
    frame = frame.sort_values(["market", "timestamp_utc"]).reset_index(drop=True)
    return frame


def build_feature_frame(raw: pd.DataFrame) -> pd.DataFrame:
    features = build_realtime_features(raw, include_target=False)
    features = features.sort_values(["market", "timestamp_utc"]).reset_index(drop=True)
    return features


def add_horizon_target(features: pd.DataFrame, horizon_minutes: int, min_return_bps: float) -> pd.DataFrame:
    frame = features.copy()
    grouped = frame.groupby("market", group_keys=False, sort=False)
    frame["future_return"] = grouped["close_u"].shift(-horizon_minutes) / frame["close_u"] - 1.0
    frame["target"] = (frame["future_return"] > (min_return_bps / 10_000.0)).astype("int8")
    frame = frame.dropna(subset=["future_return", "timestamp_utc", "market", "close_u"])
    return frame


def chronological_split(frame: pd.DataFrame, horizon_minutes: int) -> dict[str, pd.DataFrame]:
    ordered = frame.sort_values("timestamp_utc").reset_index(drop=True)
    train_cut = ordered.loc[int(len(ordered) * 0.70), "timestamp_utc"]
    valid_cut = ordered.loc[int(len(ordered) * 0.85), "timestamp_utc"]
    purge = pd.Timedelta(minutes=horizon_minutes)
    train = ordered[ordered["timestamp_utc"] <= train_cut - purge]
    valid = ordered[
        (ordered["timestamp_utc"] >= train_cut + purge)
        & (ordered["timestamp_utc"] <= valid_cut - purge)
    ]
    test = ordered[ordered["timestamp_utc"] >= valid_cut + purge]
    return {"train": train, "valid": valid, "test": test}


def sample_frame(frame: pd.DataFrame, max_rows: int, random_state: int) -> pd.DataFrame:
    if len(frame) <= max_rows:
        return frame
    return frame.sample(n=max_rows, random_state=random_state).sort_values("timestamp_utc")


def matrix(frame: pd.DataFrame, features: list[str]) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    x = frame[features].replace([np.inf, -np.inf], np.nan)
    medians = x.median(numeric_only=True).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    x = x.fillna(medians).astype("float32")
    y = frame["target"].astype("int8").to_numpy()
    returns = frame["future_return"].astype("float32").to_numpy()
    return x, y, returns


def make_model(feature_count: int, device: str) -> XGBClassifier:
    params: dict[str, Any] = {
        "n_estimators": 140,
        "max_depth": 3,
        "learning_rate": 0.045,
        "subsample": 0.78,
        "colsample_bytree": min(0.85, max(0.45, 36 / max(feature_count, 1))),
        "min_child_weight": 60,
        "reg_alpha": 0.8,
        "reg_lambda": 8.0,
        "objective": "binary:logistic",
        "eval_metric": "aucpr",
        "tree_method": "hist",
        "random_state": RANDOM_STATE,
        "n_jobs": max(1, min(8, os.cpu_count() or 4)),
    }
    if device == "cuda":
        params["device"] = "cuda"
    return XGBClassifier(**params)


def fit_model(x_train: pd.DataFrame, y_train: np.ndarray, device: str) -> tuple[XGBClassifier, str]:
    model = make_model(x_train.shape[1], device)
    pos = int(y_train.sum())
    neg = int(len(y_train) - pos)
    if pos > 0:
        model.set_params(scale_pos_weight=min(20.0, max(1.0, neg / pos)))
    try:
        model.fit(x_train, y_train, verbose=False)
        return model, device
    except Exception:
        if device == "cuda":
            model = make_model(x_train.shape[1], "cpu")
            if pos > 0:
                model.set_params(scale_pos_weight=min(20.0, max(1.0, neg / pos)))
            model.fit(x_train, y_train, verbose=False)
            return model, "cpu"
        raise


def safe_auc(y_true: np.ndarray, proba: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return 0.0
    return float(roc_auc_score(y_true, proba))


def safe_ap(y_true: np.ndarray, proba: np.ndarray) -> float:
    if len(np.unique(y_true)) < 2:
        return 0.0
    return float(average_precision_score(y_true, proba))


def choose_threshold(y_true: np.ndarray, proba: np.ndarray, returns: np.ndarray) -> dict[str, float]:
    best: dict[str, float] | None = None
    fee = FEE_BPS / 10_000.0
    thresholds = np.linspace(0.40, 0.85, 46)
    min_trades = max(MIN_VALID_TRADES, int(len(y_true) * 0.004))
    for threshold in thresholds:
        selected = proba >= threshold
        trades = int(selected.sum())
        if trades < min_trades:
            continue
        net = float(np.mean(returns[selected] - fee))
        hit = float(np.mean(y_true[selected])) if trades else 0.0
        coverage = float(trades / len(y_true))
        stability_bonus = min(0.003, max(-0.003, net)) + min(0.003, coverage)
        candidate = {
            "threshold": float(threshold),
            "trade_mean_net_return": net,
            "trade_hit_rate": hit,
            "trade_count": trades,
            "trade_coverage": coverage,
            "threshold_score": net + stability_bonus,
        }
        if best is None or candidate["threshold_score"] > best["threshold_score"]:
            best = candidate
    if best is not None:
        return best
    threshold = 0.60
    selected = proba >= threshold
    trades = int(selected.sum())
    return {
        "threshold": threshold,
        "trade_mean_net_return": float(np.mean(returns[selected] - fee)) if trades else 0.0,
        "trade_hit_rate": float(np.mean(y_true[selected])) if trades else 0.0,
        "trade_count": trades,
        "trade_coverage": float(trades / len(y_true)) if len(y_true) else 0.0,
    }


def _float_or_zero(value: float) -> float:
    if np.isfinite(value):
        return float(value)
    return 0.0


def _max_drawdown(net_returns: np.ndarray) -> float:
    if len(net_returns) == 0:
        return 0.0
    equity = np.cumsum(net_returns)
    peak = np.maximum.accumulate(equity)
    drawdown = equity - peak
    return float(drawdown.min())


def _stability_summary(
    frame: pd.DataFrame,
    selected: np.ndarray,
    trade_net_returns: np.ndarray,
) -> dict[str, float]:
    if frame is None or len(frame) == 0 or int(selected.sum()) == 0:
        return {
            "positive_month_rate": 0.0,
            "worst_month_net_return": 0.0,
            "positive_market_rate": 0.0,
            "worst_market_net_return": 0.0,
        }

    selected_frame = frame.loc[selected, ["timestamp_utc", "market"]].copy()
    selected_frame["net_return"] = trade_net_returns
    selected_frame["month"] = pd.to_datetime(selected_frame["timestamp_utc"]).dt.to_period("M").astype(str)

    month_net = selected_frame.groupby("month")["net_return"].mean()
    market_net = selected_frame.groupby("market")["net_return"].mean()
    return {
        "positive_month_rate": _float_or_zero((month_net > 0).mean()) if len(month_net) else 0.0,
        "worst_month_net_return": _float_or_zero(month_net.min()) if len(month_net) else 0.0,
        "positive_market_rate": _float_or_zero((market_net > 0).mean()) if len(market_net) else 0.0,
        "worst_market_net_return": _float_or_zero(market_net.min()) if len(market_net) else 0.0,
    }


def evaluate(
    y_true: np.ndarray,
    proba: np.ndarray,
    returns: np.ndarray,
    threshold: float,
    frame: pd.DataFrame | None = None,
) -> dict[str, float]:
    pred = (proba >= threshold).astype("int8")
    selected = pred == 1
    trades = int(selected.sum())
    trade_net_returns = returns[selected] - (FEE_BPS / 10_000.0)
    trade_std = float(np.std(trade_net_returns)) if trades else 0.0
    sharpe_like = (
        float(np.mean(trade_net_returns) / trade_std * np.sqrt(trades))
        if trades > 1 and trade_std > 0
        else 0.0
    )
    gross_profit = float(trade_net_returns[trade_net_returns > 0].sum()) if trades else 0.0
    gross_loss = float(-trade_net_returns[trade_net_returns < 0].sum()) if trades else 0.0
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)
    stability = _stability_summary(frame, selected, trade_net_returns)
    return {
        "average_precision": safe_ap(y_true, proba),
        "roc_auc": safe_auc(y_true, proba),
        "brier": float(brier_score_loss(y_true, proba)) if len(np.unique(y_true)) > 1 else 0.0,
        "mcc": float(matthews_corrcoef(y_true, pred)) if len(np.unique(y_true)) > 1 and len(np.unique(pred)) > 1 else 0.0,
        "base_rate": float(np.mean(y_true)) if len(y_true) else 0.0,
        "threshold": float(threshold),
        "trade_count": trades,
        "trade_coverage": float(trades / len(y_true)) if len(y_true) else 0.0,
        "trade_hit_rate": float(np.mean(y_true[selected])) if trades else 0.0,
        "trade_mean_net_return": float(np.mean(trade_net_returns)) if trades else 0.0,
        "trade_median_net_return": float(np.median(trade_net_returns)) if trades else 0.0,
        "trade_total_net_return": float(np.sum(trade_net_returns)) if trades else 0.0,
        "max_drawdown_sum_return": _max_drawdown(trade_net_returns),
        "profit_factor": _float_or_zero(profit_factor),
        "sharpe_like": _float_or_zero(sharpe_like),
        **stability,
    }


def candidate_sets(rank: list[str]) -> dict[str, list[str]]:
    candidates = {
        "low_latency_domain": _existing(LOW_LATENCY_FEATURES),
        "behavior_domain": _existing(DOMAIN_CORE_FEATURES),
        "top_24_importance": rank[:24],
        "top_32_importance": rank[:32],
        "top_48_importance": rank[:48],
        "top_64_importance": rank[:64],
        "all_104_reference": list(REALTIME_FEATURE_COLUMNS),
    }
    return {name: features for name, features in candidates.items() if features}


def selection_score(valid_metrics: dict[str, float], feature_count: int) -> float:
    if feature_count > MAX_SELECTED_FEATURES:
        return -1.0
    ap_lift = valid_metrics["average_precision"] - valid_metrics["base_rate"]
    net_bonus = min(0.060, max(-0.060, valid_metrics["trade_mean_net_return"] * 4.0))
    hit_bonus = min(0.030, max(-0.030, (valid_metrics["trade_hit_rate"] - valid_metrics["base_rate"]) * 0.20))
    month_bonus = 0.025 * valid_metrics["positive_month_rate"]
    market_bonus = 0.025 * valid_metrics["positive_market_rate"]
    mcc_bonus = max(0.0, valid_metrics["mcc"]) * 0.040
    compactness_penalty = 0.0012 * np.sqrt(feature_count)
    sparse_penalty = 0.020 if valid_metrics["trade_count"] < MIN_VALID_TRADES else 0.0
    drawdown_penalty = min(0.030, abs(min(0.0, valid_metrics["max_drawdown_sum_return"])) * 0.10)
    return (
        ap_lift
        + net_bonus
        + hit_bonus
        + month_bonus
        + market_bonus
        + mcc_bonus
        - compactness_penalty
        - sparse_penalty
        - drawdown_penalty
    )


def deployment_recommended(final_test: dict[str, float], y_valid: np.ndarray) -> bool:
    return (
        final_test["trade_mean_net_return"] > 0.0
        and final_test["trade_count"] >= MIN_TEST_TRADES
        and final_test["positive_month_rate"] >= MIN_STABLE_RATE
        and final_test["positive_market_rate"] >= MIN_STABLE_RATE
        and float(y_valid.mean()) >= 0.01
    )


def feature_rank_from_model(model: XGBClassifier, features: list[str]) -> list[str]:
    importances = getattr(model, "feature_importances_", None)
    if importances is None or len(importances) != len(features):
        return list(features)
    order = np.argsort(importances)[::-1]
    return [features[i] for i in order if importances[i] > 0] + [
        features[i] for i in order if importances[i] <= 0
    ]


def train_horizon(features: pd.DataFrame, horizon_name: str, config: dict[str, float], preferred_device: str) -> tuple[Any, dict[str, Any]]:
    started = time.time()
    horizon_frame = add_horizon_target(
        features,
        horizon_minutes=int(config["minutes"]),
        min_return_bps=float(config["min_return_bps"]),
    )
    splits = chronological_split(horizon_frame, int(config["minutes"]))
    train = sample_frame(splits["train"], MAX_TRAIN_ROWS, RANDOM_STATE)
    valid = sample_frame(splits["valid"], MAX_EVAL_ROWS, RANDOM_STATE + 1)
    test = sample_frame(splits["test"], MAX_EVAL_ROWS, RANDOM_STATE + 2)

    x_train_all, y_train, _ = matrix(train, list(REALTIME_FEATURE_COLUMNS))
    x_valid_all, y_valid, valid_returns = matrix(valid, list(REALTIME_FEATURE_COLUMNS))
    x_test_all, y_test, test_returns = matrix(test, list(REALTIME_FEATURE_COLUMNS))

    if len(np.unique(y_train)) < 2 or len(np.unique(y_valid)) < 2 or len(np.unique(y_test)) < 2:
        raise RuntimeError(f"{horizon_name}: target class가 한쪽으로만 구성되어 학습할 수 없음")

    rank_model, used_device = fit_model(x_train_all, y_train, preferred_device)
    rank = feature_rank_from_model(rank_model, list(REALTIME_FEATURE_COLUMNS))
    rows: list[dict[str, Any]] = []
    best_row: dict[str, Any] | None = None
    best_model: XGBClassifier | None = None
    best_features: list[str] = []

    for candidate_name, selected_features in candidate_sets(rank).items():
        x_train = x_train_all[selected_features]
        x_valid = x_valid_all[selected_features]
        x_test = x_test_all[selected_features]
        model, used_device = fit_model(x_train, y_train, used_device)
        valid_proba = model.predict_proba(x_valid)[:, 1]
        threshold_info = choose_threshold(y_valid, valid_proba, valid_returns)
        valid_metrics = evaluate(y_valid, valid_proba, valid_returns, threshold_info["threshold"], valid)
        test_proba = model.predict_proba(x_test)[:, 1]
        test_metrics = evaluate(y_test, test_proba, test_returns, threshold_info["threshold"], test)
        row = {
            "candidate": candidate_name,
            "feature_count": len(selected_features),
            "score": selection_score(valid_metrics, len(selected_features)),
            "threshold": threshold_info["threshold"],
            "valid": valid_metrics,
            "test": test_metrics,
            "features": selected_features,
        }
        rows.append(row)
        if best_row is None or row["score"] > best_row["score"]:
            best_row = row
            best_model = model
            best_features = selected_features

    assert best_row is not None and best_model is not None

    train_valid = pd.concat([train, valid], ignore_index=True).sort_values("timestamp_utc")
    train_valid = sample_frame(train_valid, MAX_FINAL_TRAIN_ROWS, RANDOM_STATE + 3)
    x_final, y_final, _ = matrix(train_valid, best_features)
    final_model, used_device = fit_model(x_final, y_final, used_device)
    final_test_proba = final_model.predict_proba(x_test_all[best_features])[:, 1]
    final_test = evaluate(y_test, final_test_proba, test_returns, best_row["threshold"], test)
    recommended = deployment_recommended(final_test, y_valid)

    realtime_model = RealtimeCryptoModel(
        model=final_model,
        feature_columns=best_features,
        threshold=best_row["threshold"],
        config=None,
        metadata={
            "horizon": horizon_name,
            "horizon_minutes": int(config["minutes"]),
            "min_return_bps": float(config["min_return_bps"]),
            "selected_candidate": best_row["candidate"],
            "selected_feature_count": len(best_features),
            "selected_features": best_features,
            "selection_score": best_row["score"],
            "candidate_test_metrics": best_row["test"],
            "final_test_metrics": final_test,
            "deployment_recommended": recommended,
        },
    )

    meta = {
        "horizon": horizon_name,
        "horizon_minutes": int(config["minutes"]),
        "min_return_bps": float(config["min_return_bps"]),
        "rows": {
            "available": len(horizon_frame),
            "train": len(splits["train"]),
            "valid": len(splits["valid"]),
            "test": len(splits["test"]),
            "train_sample": len(train),
            "valid_sample": len(valid),
            "test_sample": len(test),
        },
        "positive_rate": {
            "train": float(y_train.mean()),
            "valid": float(y_valid.mean()),
            "test": float(y_test.mean()),
        },
        "training_device": used_device,
        "selected_candidate": best_row["candidate"],
        "selected_feature_count": len(best_features),
        "selected_features": best_features,
        "selection_score": best_row["score"],
        "deployment_recommended": recommended,
        "final_test": final_test,
        "candidate_results": sorted(rows, key=lambda item: item["score"], reverse=True),
        "top_importance_features": rank[:30],
        "elapsed_seconds": time.time() - started,
    }
    return realtime_model, meta


def metrics_table(metadata: dict[str, Any]) -> str:
    lines = [
        "| 구간 | 후보 | 피처 수 | 일반화 점수 | test AP | test ROC-AUC | test 평균 순수익 | test 적중률 | 월 안정성 | 종목 안정성 | 권장 |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for horizon, item in metadata["horizon_meta"].items():
        test = item["final_test"]
        lines.append(
            "| {horizon} | {candidate} | {count} | {score:.4f} | {ap:.4f} | {auc:.4f} | {net:.4%} | {hit:.2%} | {month:.2%} | {market:.2%} | {recommended} |".format(
                horizon=horizon,
                candidate=item["selected_candidate"],
                count=item["selected_feature_count"],
                score=item["selection_score"],
                ap=test["average_precision"],
                auc=test["roc_auc"],
                net=test["trade_mean_net_return"],
                hit=test["trade_hit_rate"],
                month=test["positive_month_rate"],
                market=test["positive_market_rate"],
                recommended="예" if item.get("deployment_recommended") else "아니오",
            )
        )
    return "\n".join(lines)


def feature_table(metadata: dict[str, Any]) -> str:
    lines = [
        "| 구간 | 선택 피처 |",
        "| --- | --- |",
    ]
    for horizon, item in metadata["horizon_meta"].items():
        features = ", ".join(f"`{feature}`" for feature in item["selected_features"])
        lines.append(f"| {horizon} | {features} |")
    return "\n".join(lines)


def failure_table(metadata: dict[str, Any]) -> str:
    failures = metadata.get("failures", {})
    if not failures:
        return "실패한 horizon은 없음."
    lines = [
        "| 구간 | 제외 사유 |",
        "| --- | --- |",
    ]
    for horizon, reason in failures.items():
        lines.append(f"| {horizon} | {reason} |")
    return "\n".join(lines)


def create_report_notebook(metadata: dict[str, Any], output_path: Path) -> None:
    summary = metrics_table(metadata)
    features = feature_table(metadata)
    failures = failure_table(metadata)
    markdown = f"""# 피처 일반화 재학습 및 백테스트 보고서

## 실험 개요

- 데이터 구간: `{metadata["data"]["cutoff"]}` 이후 `master.parquet`
- 원본 실시간 피처 수: {len(REALTIME_FEATURE_COLUMNS)}개
- 목표: CPU 실시간 추론이 가능한 범위에서 피처 수를 줄이되, 단일 검증 구간에 과적합되지 않는 조합을 선택함.
- 후보군: 저지연 도메인 피처, 행동재무 도메인 피처, 중요도 상위 24/32/48/64개, 전체 기준 피처를 비교함.
- 선택 제한: 실시간 추론과 과적합 완화를 위해 최종 선택 피처 수는 {MAX_SELECTED_FEATURES}개 이하로 제한함.
- 선정 기준: validation 구간에서 AP 기준 상승폭, 순수익, 적중률 상승폭, 월별 양수 수익 비율, 종목별 양수 수익 비율, MCC, 피처 수 페널티, 드로다운 페널티를 합산함.
- 최종 성능: 선택된 후보를 train+validation 구간으로 다시 학습한 뒤 test 구간에서만 백테스트로 확인함.
- 모델: XGBoost histogram tree, depth 3, L1/L2 정규화, 시간순 train/validation/test split, horizon별 purge 적용

## 최종 선택 결과

{summary}

## 제외 또는 비권장 구간

{failures}

- 권장 여부는 test 평균 순수익이 양수이고, 거래 수가 {MIN_TEST_TRADES}건 이상이며, 월별/종목별 양수 수익 비율이 각각 {MIN_STABLE_RATE:.0%} 이상인지 확인해 표시함.
- 비권장 구간은 모델 파일에 들어 있어도 실거래 기본 진입 신호로 쓰지 않는 것을 권장함.

## 선택된 피처 조합

{features}

## 해석

- 전체 104개 피처를 항상 쓰는 대신 horizon별로 필요한 피처만 선택함.
- `top_k_importance` 후보는 전체 피처 예비 모델의 중요도 순위를 기준으로 만들었고, `low_latency_domain`, `behavior_domain`은 사람이 이해 가능한 도메인 묶음으로 비교함.
- test 성능은 후보 선정에 직접 쓰지 않고, 최종 확인용 백테스트로만 사용함.
- 월별/종목별 안정성 지표를 함께 보므로 특정 장세나 특정 코인에만 맞는 조합을 걸러내는 데 초점을 둠.
- 장기 horizon은 시장 국면 변화와 타깃 희소성 때문에 짧은 구간보다 불안정할 수 있으므로 실거래 기본 진입에는 보수적으로 해석하는 것이 좋음.

## 산출물

- metrics JSON: `reports/feature_generalization_metrics.json`
- 로컬 모델 pkl: `models/feature_selected_realtime_model.pkl`
- 로컬 보고서 ipynb: `reports/feature_generalization_report.ipynb`
- GitHub에는 pkl, env, 민감정보를 올리지 않음.
"""
    notebook = {
        "cells": [
            {"cell_type": "markdown", "metadata": {}, "source": markdown.splitlines(keepends=True)},
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": [
                    "import json\n",
                    "from pathlib import Path\n",
                    "metrics = json.loads(Path('reports/feature_generalization_metrics.json').read_text(encoding='utf-8'))\n",
                    "metrics['metadata']['selected_model_path']\n",
                ],
            },
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {
                "name": "python",
                "version": sys.version.split()[0],
            },
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }
    output_path.write_text(json.dumps(notebook, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    started = time.time()
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    raw = load_recent_frame()
    features = build_feature_frame(raw)
    preferred_device = "cuda"
    models: dict[str, RealtimeCryptoModel] = {}
    horizon_meta: dict[str, Any] = {}
    failures: dict[str, str] = {}

    for horizon_name, config in HORIZON_CONFIGS.items():
        try:
            model, meta = train_horizon(features, horizon_name, config, preferred_device)
            preferred_device = meta["training_device"]
            models[horizon_name] = model
            horizon_meta[horizon_name] = meta
            print(f"{horizon_name}: {meta['selected_candidate']} {meta['selected_feature_count']} features")
        except Exception as exc:
            failures[horizon_name] = str(exc)
            print(f"{horizon_name}: failed: {exc}")

    suite = RealtimeCryptoModelSuite(
        models=models,
        metadata={
            "created_at_local": datetime.now().isoformat(timespec="seconds"),
            "training_device": preferred_device,
            "source": str(DATA_PATH),
            "cutoff": RECENT_CUTOFF,
            "selection_method": "validation_generalization_score_with_stability",
            "horizon_meta": horizon_meta,
            "failures": failures,
        },
    )
    model_path = MODEL_DIR / "feature_selected_realtime_model.pkl"
    with model_path.open("wb") as handle:
        pickle.dump(suite, handle)

    metadata = {
        "metadata": {
            "created_at_local": datetime.now().isoformat(timespec="seconds"),
            "script": str(Path(__file__).name),
            "source": str(DATA_PATH),
            "selected_model_path": str(model_path),
            "pkl_committed": False,
            "training_device": preferred_device,
            "feature_selection_reason": "피처 수 축소, 월별/종목별 안정성 반영, CPU 추론 부담 완화를 함께 달성하기 위함",
            "selection_method": "validation_generalization_score_with_stability",
            "original_feature_count": len(REALTIME_FEATURE_COLUMNS),
            "max_train_rows": MAX_TRAIN_ROWS,
            "max_eval_rows": MAX_EVAL_ROWS,
            "min_valid_trades": MIN_VALID_TRADES,
            "min_test_trades": MIN_TEST_TRADES,
            "min_stable_rate": MIN_STABLE_RATE,
            "fee_bps": FEE_BPS,
        },
        "data": {
            "cutoff": RECENT_CUTOFF,
            "raw_rows": len(raw),
            "feature_rows": len(features),
            "markets": sorted(features["market"].dropna().unique().tolist()),
            "min_timestamp": str(features["timestamp_utc"].min()),
            "max_timestamp": str(features["timestamp_utc"].max()),
        },
        "horizon_meta": horizon_meta,
        "failures": failures,
        "elapsed_seconds": time.time() - started,
    }

    metrics_path = REPORT_DIR / "feature_generalization_metrics.json"
    metrics_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path = REPORT_DIR / "feature_generalization_report.ipynb"
    create_report_notebook(metadata, report_path)
    print(json.dumps({
        "metrics": str(metrics_path),
        "notebook": str(report_path),
        "model": str(model_path),
        "elapsed_seconds": metadata["elapsed_seconds"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
