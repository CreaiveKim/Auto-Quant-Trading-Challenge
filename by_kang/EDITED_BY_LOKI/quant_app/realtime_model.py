from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


REALTIME_FEATURE_COLUMNS = [
    "ret_1m",
    "ret_3m",
    "ret_5m",
    "ret_15m",
    "ret_30m",
    "ret_60m",
    "ret_120m",
    "ret_240m",
    "ret_720m",
    "ret_1440m",
    "ret_2880m",
    "range_pct",
    "body_pct",
    "upper_wick_pct",
    "lower_wick_pct",
    "volatility_5m",
    "volatility_15m",
    "volatility_30m_rt",
    "volatility_60m",
    "volatility_240m",
    "volatility_1440m",
    "realized_vol_30m",
    "realized_vol_120m",
    "realized_vol_240m",
    "realized_vol_1440m",
    "ema_12_ratio",
    "ema_26_ratio",
    "ema_60_ratio",
    "ema_120_ratio",
    "ema_240_ratio",
    "ema_1440_ratio",
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
    "volume_rel_1440",
    "value_rel_30",
    "value_rel_120",
    "value_rel_1440",
    "value_z_120",
    "value_z_1440",
    "binance_ret_1m",
    "binance_ret_5m",
    "binance_ret_15m",
    "binance_ret_30m",
    "binance_ret_60m",
    "binance_ret_120m",
    "binance_ret_240m",
    "binance_range_pct",
    "binance_volume_rel_30",
    "binance_volume_rel_240",
    "binance_taker_buy_ratio",
    "upbit_binance_ret_spread_5m",
    "upbit_binance_ret_spread_15m",
    "upbit_binance_ret_spread_60m",
    "upbit_binance_ret_spread_240m",
    "kimp_real",
    "kimp_velocity_5m",
    "kimp_velocity_15m",
    "kimp_velocity_60m",
    "kimp_velocity_240m",
    "kimp_z_1440",
    "market_fx",
    "market_fx_change_60m",
    "market_fx_change_1440m",
    "btc_dominance",
    "btc_dominance_change_60m",
    "btc_dominance_change_1440m",
    "btc_dominance_z_1440",
    "btc_ret_15m",
    "btc_ret_60m",
    "btc_volatility_30m",
    "eth_ret_15m",
    "eth_ret_60m",
    "eth_volatility_30m",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
]


@dataclass(frozen=True)
class RealtimeFeatureConfig:
    horizon_minutes: int = 30
    min_return_bps: float = 12.0
    fee_bps: float = 5.0

    @property
    def positive_return_threshold(self) -> float:
        return self.min_return_bps / 10_000.0


class RealtimeCryptoModel:
    """Small pickle-friendly inference wrapper for the Upbit realtime model."""

    def __init__(
        self,
        model: Any,
        feature_columns: list[str],
        threshold: float,
        config: RealtimeFeatureConfig,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.model = model
        self.feature_columns = feature_columns
        self.threshold = float(threshold)
        self.config = config
        self.metadata = metadata or {}

    def predict_proba(self, feature_frame: pd.DataFrame) -> np.ndarray:
        frame = align_feature_frame(feature_frame, self.feature_columns)
        return self.model.predict_proba(frame)[:, 1]

    def predict_signal(self, feature_frame: pd.DataFrame) -> pd.DataFrame:
        out = feature_frame.copy()
        proba = self.predict_proba(out)
        out["trend_probability"] = proba
        out["signal"] = (proba >= self.threshold).astype(int)
        out["threshold"] = self.threshold
        return out


class RealtimeCryptoModelSuite:
    """Pickle-friendly container for multiple horizons in one deployment artifact."""

    def __init__(self, models: dict[str, RealtimeCryptoModel], metadata: dict[str, Any] | None = None) -> None:
        self.models = models
        self.metadata = metadata or {}
        self.feature_columns = REALTIME_FEATURE_COLUMNS

    def available_horizons(self) -> list[str]:
        return sorted(self.models)

    def predict_proba(self, feature_frame: pd.DataFrame, horizon: str = "short_30m") -> np.ndarray:
        return self.models[horizon].predict_proba(feature_frame)

    def predict_signal(self, feature_frame: pd.DataFrame, horizon: str = "short_30m") -> pd.DataFrame:
        out = self.models[horizon].predict_signal(feature_frame)
        out["horizon"] = horizon
        return out


def build_realtime_features(
    frame: pd.DataFrame,
    config: RealtimeFeatureConfig | None = None,
    include_target: bool = True,
) -> pd.DataFrame:
    """Create causal 1-minute features that are computable during live trading."""
    config = config or RealtimeFeatureConfig()
    df = _standardize_columns(frame)
    if df.empty:
        return df

    df = df.sort_values(["market", "timestamp_utc"]).reset_index(drop=True)
    grouped = df.groupby("market", group_keys=False, sort=False)

    close = df["close_u"].astype("float64")
    open_ = df["open_u"].astype("float64")
    high = df["high_u"].astype("float64")
    low = df["low_u"].astype("float64")
    volume = df["volume_u"].astype("float64")
    value = df["value"].astype("float64")

    for window in (1, 3, 5, 15, 30, 60, 120, 240, 720, 1440, 2880):
        df[f"ret_{window}m"] = grouped["close_u"].pct_change(window, fill_method=None)

    df["range_pct"] = (high - low) / close.replace(0, np.nan)
    df["body_pct"] = (close - open_) / open_.replace(0, np.nan)
    candle_high_low = (high - low).replace(0, np.nan)
    df["upper_wick_pct"] = (high - np.maximum(open_, close)) / candle_high_low
    df["lower_wick_pct"] = (np.minimum(open_, close) - low) / candle_high_low

    log_ret = grouped["close_u"].transform(lambda s: np.log(s).diff())
    df["_log_ret"] = log_ret
    for window in (5, 15, 30, 60, 240, 1440):
        df[f"volatility_{window}m"] = grouped["ret_1m"].transform(
            lambda s, w=window: s.rolling(w, min_periods=max(3, w // 3)).std()
        )
    df = df.rename(columns={"volatility_30m": "volatility_30m_rt"})
    for window, min_periods in ((30, 10), (120, 30), (240, 60), (1440, 240)):
        df[f"realized_vol_{window}m"] = grouped["_log_ret"].transform(
            lambda s, w=window, mp=min_periods: np.sqrt((s * s).rolling(w, min_periods=mp).sum())
        )

    for window in (12, 26, 60, 120, 240, 1440):
        ema = grouped["close_u"].transform(lambda s, w=window: s.ewm(span=w, adjust=False).mean())
        df[f"ema_{window}_ratio"] = close / ema.replace(0, np.nan) - 1

    ema_12 = grouped["close_u"].transform(lambda s: s.ewm(span=12, adjust=False).mean())
    ema_26 = grouped["close_u"].transform(lambda s: s.ewm(span=26, adjust=False).mean())
    macd = ema_12 - ema_26
    macd_signal = macd.groupby(df["market"]).transform(lambda s: s.ewm(span=9, adjust=False).mean())
    df["macd_ratio"] = macd / close.replace(0, np.nan)
    df["macd_signal_ratio"] = macd_signal / close.replace(0, np.nan)
    df["macd_hist_ratio"] = (macd - macd_signal) / close.replace(0, np.nan)

    delta = grouped["close_u"].diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.groupby(df["market"]).transform(lambda s: s.ewm(alpha=1 / 14, adjust=False).mean())
    avg_loss = loss.groupby(df["market"]).transform(lambda s: s.ewm(alpha=1 / 14, adjust=False).mean())
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi_14"] = 100 - (100 / (1 + rs))

    rolling_mean_20 = grouped["close_u"].transform(lambda s: s.rolling(20, min_periods=10).mean())
    rolling_std_20 = grouped["close_u"].transform(lambda s: s.rolling(20, min_periods=10).std())
    df["bb_z_20"] = (close - rolling_mean_20) / rolling_std_20.replace(0, np.nan)
    high_60 = grouped["high_u"].transform(lambda s: s.rolling(60, min_periods=20).max())
    low_60 = grouped["low_u"].transform(lambda s: s.rolling(60, min_periods=20).min())
    high_20_prev = grouped["high_u"].transform(lambda s: s.rolling(20, min_periods=10).max().shift(1))
    df["dist_high_60"] = close / high_60.replace(0, np.nan) - 1
    df["dist_low_60"] = close / low_60.replace(0, np.nan) - 1
    df["breakout_20"] = (close > high_20_prev).astype("float32")

    for source_col, prefix in (("volume_u", "volume"), ("value", "value")):
        for window in (30, 120, 1440):
            rolling = grouped[source_col].transform(lambda s, w=window: s.rolling(w, min_periods=max(10, w // 4)).mean())
            df[f"{prefix}_rel_{window}"] = df[source_col] / rolling.replace(0, np.nan)
    value_mean_120 = grouped["value"].transform(lambda s: s.rolling(120, min_periods=30).mean())
    value_std_120 = grouped["value"].transform(lambda s: s.rolling(120, min_periods=30).std())
    df["value_z_120"] = (value - value_mean_120) / value_std_120.replace(0, np.nan)
    value_mean_1440 = grouped["value"].transform(lambda s: s.rolling(1440, min_periods=240).mean())
    value_std_1440 = grouped["value"].transform(lambda s: s.rolling(1440, min_periods=240).std())
    df["value_z_1440"] = (value - value_mean_1440) / value_std_1440.replace(0, np.nan)

    if "close_b" in df.columns:
        for window in (1, 5, 15, 30, 60, 120, 240):
            df[f"binance_ret_{window}m"] = grouped["close_b"].pct_change(window, fill_method=None)
        df["binance_range_pct"] = (df["high_b"] - df["low_b"]) / df["close_b"].replace(0, np.nan)
        binance_volume_ma = grouped["volume_b"].transform(lambda s: s.rolling(30, min_periods=10).mean())
        df["binance_volume_rel_30"] = df["volume_b"] / binance_volume_ma.replace(0, np.nan)
        binance_volume_ma_240 = grouped["volume_b"].transform(lambda s: s.rolling(240, min_periods=60).mean())
        df["binance_volume_rel_240"] = df["volume_b"] / binance_volume_ma_240.replace(0, np.nan)
        df["binance_taker_buy_ratio"] = df["taker_buy_base_volume"] / df["volume_b"].replace(0, np.nan)
        df["upbit_binance_ret_spread_5m"] = df["ret_5m"] - df["binance_ret_5m"]
        df["upbit_binance_ret_spread_15m"] = df["ret_15m"] - df["binance_ret_15m"]
        df["upbit_binance_ret_spread_60m"] = df["ret_60m"] - df["binance_ret_60m"]
        df["upbit_binance_ret_spread_240m"] = df["ret_240m"] - df["binance_ret_240m"]

    if "kimp_real" in df.columns:
        for window in (5, 15, 60, 240):
            df[f"kimp_velocity_{window}m"] = grouped["kimp_real"].diff(window)
        kimp_mean = grouped["kimp_real"].transform(lambda s: s.rolling(1440, min_periods=240).mean())
        kimp_std = grouped["kimp_real"].transform(lambda s: s.rolling(1440, min_periods=240).std())
        df["kimp_z_1440"] = (df["kimp_real"] - kimp_mean) / kimp_std.replace(0, np.nan)

    if "market_fx" in df.columns:
        df["market_fx_change_60m"] = grouped["market_fx"].pct_change(60, fill_method=None)
        df["market_fx_change_1440m"] = grouped["market_fx"].pct_change(1440, fill_method=None)

    if "btc_dominance" in df.columns:
        df["btc_dominance_change_60m"] = grouped["btc_dominance"].pct_change(60, fill_method=None)
        df["btc_dominance_change_1440m"] = grouped["btc_dominance"].pct_change(1440, fill_method=None)
        dom_mean = grouped["btc_dominance"].transform(lambda s: s.rolling(1440, min_periods=240).mean())
        dom_std = grouped["btc_dominance"].transform(lambda s: s.rolling(1440, min_periods=240).std())
        df["btc_dominance_z_1440"] = (df["btc_dominance"] - dom_mean) / dom_std.replace(0, np.nan)

    df = _add_market_regime_features(df)
    df = _add_time_features(df)

    if include_target:
        df["future_return"] = grouped["close_u"].shift(-config.horizon_minutes) / close - 1
        df["target"] = (df["future_return"] > config.positive_return_threshold).astype("int8")

    df = df.replace([np.inf, -np.inf], np.nan)
    return df


def align_feature_frame(frame: pd.DataFrame, feature_columns: list[str] | None = None) -> pd.DataFrame:
    columns = feature_columns or REALTIME_FEATURE_COLUMNS
    out = pd.DataFrame(index=frame.index)
    for column in columns:
        out[column] = pd.to_numeric(frame[column], errors="coerce") if column in frame.columns else np.nan
    out = out.replace([np.inf, -np.inf], np.nan)
    medians = out.median(numeric_only=True).replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return out.fillna(medians).astype("float32")


def _standardize_columns(frame: pd.DataFrame) -> pd.DataFrame:
    df = frame.copy()
    if "timestamp_utc" not in df.columns:
        time_col = "time" if "time" in df.columns else "open_time"
        df["timestamp_utc"] = pd.to_datetime(df[time_col], errors="coerce", utc=False)
    else:
        df["timestamp_utc"] = pd.to_datetime(df["timestamp_utc"], errors="coerce", utc=False)

    if "market" not in df.columns:
        if "asset" in df.columns:
            df["market"] = df["asset"].astype(str)
        elif "symbol" in df.columns:
            df["market"] = df["symbol"].astype(str)
        else:
            df["market"] = "UNKNOWN"

    rename_map = {
        "open": "open_u",
        "high": "high_u",
        "low": "low_u",
        "close": "close_u",
        "volume": "volume_u",
    }
    for source, target in rename_map.items():
        if target not in df.columns and source in df.columns:
            df[target] = df[source]
    if "value" not in df.columns:
        df["value"] = df.get("quote_asset_volume", df["close_u"] * df["volume_u"])
    if "future_return" not in df.columns and "target_return_30m" in df.columns:
        df["future_return"] = df["target_return_30m"]
    if "btc_dominance" not in df.columns:
        for candidate in ("btc_dominance_pct", "bitcoin_dominance", "btc_market_cap_dominance"):
            if candidate in df.columns:
                df["btc_dominance"] = df[candidate]
                break

    numeric_cols = [
        "open_u",
        "high_u",
        "low_u",
        "close_u",
        "volume_u",
        "value",
        "open_b",
        "high_b",
        "low_b",
        "close_b",
        "volume_b",
        "taker_buy_base_volume",
        "kimp_real",
        "market_fx",
        "btc_dominance",
        "future_return",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
        elif col.endswith("_b") or col in {"taker_buy_base_volume", "kimp_real", "market_fx", "btc_dominance"}:
            df[col] = np.nan

    if "kimp_real" in df.columns and df["kimp_real"].isna().all() and {"close_b", "market_fx"}.issubset(df.columns):
        denominator = df["close_b"] * df["market_fx"]
        df["kimp_real"] = df["close_u"] / denominator.replace(0, np.nan) - 1

    df = df.dropna(subset=["timestamp_utc", "market", "open_u", "high_u", "low_u", "close_u"])
    return df


def _add_market_regime_features(df: pd.DataFrame) -> pd.DataFrame:
    regime_parts = []
    for market, prefix in (("KRW-BTC", "btc"), ("KRW-ETH", "eth")):
        source = df.loc[df["market"] == market, ["timestamp_utc", "ret_15m", "ret_60m", "volatility_30m_rt"]].copy()
        if source.empty:
            continue
        source = source.rename(
            columns={
                "ret_15m": f"{prefix}_ret_15m",
                "ret_60m": f"{prefix}_ret_60m",
                "volatility_30m_rt": f"{prefix}_volatility_30m",
            }
        )
        regime_parts.append(source.drop_duplicates("timestamp_utc"))

    for regime in regime_parts:
        df = df.merge(regime, on="timestamp_utc", how="left")
    return df


def _add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    ts = pd.to_datetime(df["timestamp_utc"], errors="coerce")
    minute_of_day = ts.dt.hour * 60 + ts.dt.minute
    df["hour_sin"] = np.sin(2 * np.pi * minute_of_day / 1440)
    df["hour_cos"] = np.cos(2 * np.pi * minute_of_day / 1440)
    dow = ts.dt.dayofweek
    df["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    df["dow_cos"] = np.cos(2 * np.pi * dow / 7)
    return df
