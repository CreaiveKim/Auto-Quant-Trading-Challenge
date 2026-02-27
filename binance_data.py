#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Binance top-20 USDT pairs historical klines -> PostgreSQL (Cloud SQL)

- Select top 20 symbols by 24h quoteVolume among *USDT* symbols
- Fetch full history for intervals: 1m, 1h, 1d, 1w, 1M
- Store into Postgres with UPSERT (PK: symbol, interval, open_time)
- Optional: derive yearly (1y) candles from monthly (1M) candles and store too.

Usage:
  python binance_data.py
  python binance_data.py --intervals 1h 1d
  python binance_data.py --symbols BTCUSDT ETHUSDT --intervals 1m
  python binance_data.py --compute-yearly
"""

import os
import sys
import time
import math
import argparse
from datetime import datetime, timezone
from dateutil import parser as dtparser

import requests
import psycopg2
from psycopg2.extras import execute_values


BINANCE_BASE = os.getenv("BINANCE_BASE", "https://api.binance.com")
USER_AGENT = os.getenv("USER_AGENT", "Mozilla/5.0 (compatible; data-ingestor/1.0)")

DEFAULT_INTERVALS = ["1m", "1h", "1d", "1w", "1M"]  # Binance-supported
DERIVED_YEARLY_INTERVAL = "1y"  # derived from monthly

# Binance kline response fields:
# [
#   0 Open time (ms)
#   1 Open
#   2 High
#   3 Low
#   4 Close
#   5 Volume
#   6 Close time (ms)
#   7 Quote asset volume
#   8 Number of trades
#   9 Taker buy base asset volume
#   10 Taker buy quote asset volume
#   11 Ignore
# ]

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS public.binance_klines (
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  open_time TIMESTAMPTZ NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume NUMERIC,
  close_time TIMESTAMPTZ,
  quote_asset_volume NUMERIC,
  number_of_trades BIGINT,
  taker_buy_base_volume NUMERIC,
  taker_buy_quote_volume NUMERIC,
  ignore NUMERIC,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(symbol, interval, open_time)
);
"""

# Helpful index for querying ranges
CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_binance_klines_symbol_interval_time
ON public.binance_klines(symbol, interval, open_time);
"""


def env_or_fail(key: str) -> str:
    v = os.getenv(key)
    if not v:
        print(f"[FATAL] Missing env var: {key}", file=sys.stderr)
        sys.exit(1)
    return v


def pg_connect():
    host = env_or_fail("DB_HOST")
    port = int(os.getenv("DB_PORT", "5432"))
    dbname = env_or_fail("DB_NAME")
    user = env_or_fail("DB_USER")
    password = env_or_fail("DB_PASSWORD")
    sslmode = os.getenv("DB_SSLMODE", "disable")

    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
        sslmode=sslmode,
        connect_timeout=10,
    )
    conn.autocommit = True
    return conn


def http_get(path: str, params: dict):
    url = BINANCE_BASE + path
    headers = {"User-Agent": USER_AGENT}
    r = requests.get(url, params=params, headers=headers, timeout=20)
    r.raise_for_status()
    return r.json(), r.headers


def pick_top_usdt_symbols(limit=20):
    # 24hr ticker stats; choose USDT symbols by quoteVolume (rough proxy for "top")
    data, _ = http_get("/api/v3/ticker/24hr", {})
    usdt = []
    for item in data:
        sym = item.get("symbol", "")
        if not sym.endswith("USDT"):
            continue
        # skip leveraged tokens if you want (UP/DOWN), optional:
        # if sym.endswith(("UPUSDT", "DOWNUSDT", "BULLUSDT", "BEARUSDT")): continue
        try:
            qv = float(item.get("quoteVolume", 0.0))
        except ValueError:
            qv = 0.0
        usdt.append((sym, qv))
    usdt.sort(key=lambda x: x[1], reverse=True)
    return [s for s, _ in usdt[:limit]]


def ensure_schema(conn):
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
        cur.execute(CREATE_INDEX_SQL)


def get_last_open_time_ms(conn, symbol: str, interval: str):
    sql = """
    SELECT EXTRACT(EPOCH FROM open_time) * 1000
    FROM public.binance_klines
    WHERE symbol = %s AND interval = %s
    ORDER BY open_time DESC
    LIMIT 1;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (symbol, interval))
        row = cur.fetchone()
        if not row:
            return None
        return int(row[0])


def get_earliest_open_time_ms(symbol: str, interval: str):
    # Ask Binance for earliest kline by starting from 0 and limit=1
    data, _ = http_get("/api/v3/klines", {"symbol": symbol, "interval": interval, "startTime": 0, "limit": 1})
    if not data:
        return None
    return int(data[0][0])


def ms_to_dt(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)


def dt_to_ms(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp() * 1000)


def chunked_fetch_klines(symbol: str, interval: str, start_ms: int, end_ms: int | None):
    """
    Generator yielding lists of klines (each list <= 1000 rows) from start_ms to end_ms.
    Binance API max limit=1000.
    """
    next_start = start_ms
    while True:
        params = {"symbol": symbol, "interval": interval, "startTime": next_start, "limit": 1000}
        if end_ms is not None:
            params["endTime"] = end_ms

        klines, headers = http_get("/api/v3/klines", params)

        # rate limit guard: if close to limit, sleep a bit
        # Binance returns headers like: X-MBX-USED-WEIGHT-1M
        used_weight = headers.get("X-MBX-USED-WEIGHT-1M")
        if used_weight is not None:
            try:
                if int(used_weight) > 1000:
                    time.sleep(1.0)
            except:
                pass

        if not klines:
            break

        yield klines

        last_open = int(klines[-1][0])
        # If API keeps returning same last_open, stop to avoid infinite loop
        if last_open <= next_start:
            break

        # move start forward by 1 ms after last open_time to avoid duplication
        next_start = last_open + 1

        # small sleep to respect rate limits
        time.sleep(0.2)


def insert_klines(conn, symbol: str, interval: str, klines: list):
    rows = []
    for k in klines:
        open_time_ms = int(k[0])
        close_time_ms = int(k[6])
        rows.append((
            symbol,
            interval,
            ms_to_dt(open_time_ms),
            k[1], k[2], k[3], k[4], k[5],
            ms_to_dt(close_time_ms),
            k[7],
            int(k[8]),
            k[9],
            k[10],
            k[11],
        ))

    sql = """
    INSERT INTO public.binance_klines (
      symbol, interval, open_time,
      open, high, low, close, volume,
      close_time, quote_asset_volume, number_of_trades,
      taker_buy_base_volume, taker_buy_quote_volume, ignore
    )
    VALUES %s
    ON CONFLICT (symbol, interval, open_time) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      close_time = EXCLUDED.close_time,
      quote_asset_volume = EXCLUDED.quote_asset_volume,
      number_of_trades = EXCLUDED.number_of_trades,
      taker_buy_base_volume = EXCLUDED.taker_buy_base_volume,
      taker_buy_quote_volume = EXCLUDED.taker_buy_quote_volume,
      ignore = EXCLUDED.ignore;
    """
    with conn.cursor() as cur:
        execute_values(cur, sql, rows, page_size=1000)


def derive_yearly_from_monthly(conn, symbols: list[str]):
    """
    Create derived yearly candles (1y) from monthly (1M) data already stored.
    Yearly candle definition:
      - open: first month open
      - high: max monthly high
      - low: min monthly low
      - close: last month close
      - volume: sum monthly volume
    Stored with interval='1y' and open_time = Jan 1st 00:00:00 UTC
    """
    print("[INFO] Deriving yearly candles from monthly (1M) ...")

    # We do it in SQL for speed and correctness.
    # Note: date_trunc('year', open_time) groups months per year.
    sql = """
    WITH m AS (
      SELECT
        symbol,
        date_trunc('year', open_time) AS y,
        MIN(open_time) AS first_ot,
        MAX(open_time) AS last_ot
      FROM public.binance_klines
      WHERE interval='1M' AND symbol = ANY(%s)
      GROUP BY symbol, date_trunc('year', open_time)
    ),
    first_rows AS (
      SELECT k.symbol, m.y,
             k.open AS open
      FROM m
      JOIN public.binance_klines k
        ON k.symbol = m.symbol AND k.interval='1M' AND k.open_time = m.first_ot
    ),
    last_rows AS (
      SELECT k.symbol, m.y,
             k.close AS close
      FROM m
      JOIN public.binance_klines k
        ON k.symbol = m.symbol AND k.interval='1M' AND k.open_time = m.last_ot
    ),
    agg AS (
      SELECT
        k.symbol,
        date_trunc('year', k.open_time) AS y,
        MAX(k.high) AS high,
        MIN(k.low) AS low,
        SUM(k.volume) AS volume,
        SUM(k.quote_asset_volume) AS quote_asset_volume,
        SUM(k.number_of_trades) AS number_of_trades,
        SUM(k.taker_buy_base_volume) AS taker_buy_base_volume,
        SUM(k.taker_buy_quote_volume) AS taker_buy_quote_volume
      FROM public.binance_klines k
      WHERE k.interval='1M' AND k.symbol = ANY(%s)
      GROUP BY k.symbol, date_trunc('year', k.open_time)
    )
    INSERT INTO public.binance_klines (
      symbol, interval, open_time,
      open, high, low, close, volume,
      close_time, quote_asset_volume, number_of_trades,
      taker_buy_base_volume, taker_buy_quote_volume, ignore
    )
    SELECT
      a.symbol,
      %s AS interval,
      a.y AS open_time,
      f.open,
      a.high,
      a.low,
      l.close,
      a.volume,
      (a.y + INTERVAL '1 year' - INTERVAL '1 millisecond') AS close_time,
      a.quote_asset_volume,
      a.number_of_trades,
      a.taker_buy_base_volume,
      a.taker_buy_quote_volume,
      NULL::numeric AS ignore
    FROM agg a
    JOIN first_rows f ON f.symbol=a.symbol AND f.y=a.y
    JOIN last_rows  l ON l.symbol=a.symbol AND l.y=a.y
    ON CONFLICT (symbol, interval, open_time) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      close_time = EXCLUDED.close_time,
      quote_asset_volume = EXCLUDED.quote_asset_volume,
      number_of_trades = EXCLUDED.number_of_trades,
      taker_buy_base_volume = EXCLUDED.taker_buy_base_volume,
      taker_buy_quote_volume = EXCLUDED.taker_buy_quote_volume,
      ignore = EXCLUDED.ignore;
    """
    with conn.cursor() as cur:
        cur.execute(sql, (symbols, symbols, DERIVED_YEARLY_INTERVAL))


def parse_args():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=20, help="Top N USDT symbols by 24h quoteVolume")
    ap.add_argument("--symbols", nargs="*", default=None, help="Explicit symbols list (overrides --top)")
    ap.add_argument("--intervals", nargs="*", default=DEFAULT_INTERVALS, help="Intervals, e.g. 1m 1h 1d 1w 1M")
    ap.add_argument("--since", default=None, help="Optional start datetime (UTC). e.g. 2020-01-01 or 2020-01-01T00:00:00Z")
    ap.add_argument("--until", default=None, help="Optional end datetime (UTC). default=now")
    ap.add_argument("--compute-yearly", action="store_true", help="Derive 1y candles from monthly and store")
    return ap.parse_args()


def main():
    args = parse_args()

    conn = pg_connect()
    ensure_schema(conn)

    if args.symbols and len(args.symbols) > 0:
        symbols = args.symbols
    else:
        symbols = pick_top_usdt_symbols(args.top)

    # time window
    since_ms = None
    until_ms = None
    if args.since:
        since_ms = dt_to_ms(dtparser.parse(args.since))
    if args.until:
        until_ms = dt_to_ms(dtparser.parse(args.until))
    else:
        until_ms = dt_to_ms(datetime.now(timezone.utc))

    print(f"[INFO] Symbols ({len(symbols)}): {', '.join(symbols)}")
    print(f"[INFO] Intervals: {args.intervals}")
    if since_ms:
        print(f"[INFO] Since: {ms_to_dt(since_ms).isoformat()}")
    print(f"[INFO] Until: {ms_to_dt(until_ms).isoformat()}")

    for symbol in symbols:
        for interval in args.intervals:
            # Determine start point:
            # 1) if DB has last open_time -> resume from next ms
            # 2) else if --since given -> start from since
            # 3) else start from earliest available on Binance for that symbol/interval
            last_ms = get_last_open_time_ms(conn, symbol, interval)
            if last_ms is not None:
                start_ms = last_ms + 1
                reason = "resume-from-db"
            else:
                if since_ms is not None:
                    start_ms = since_ms
                    reason = "since-arg"
                else:
                    e = get_earliest_open_time_ms(symbol, interval)
                    if e is None:
                        print(f"[WARN] No data for {symbol} {interval}")
                        continue
                    start_ms = e
                    reason = "earliest-binance"

            if start_ms >= until_ms:
                print(f"[SKIP] {symbol} {interval} up-to-date ({reason})")
                continue

            print(f"\n[FETCH] {symbol} {interval} start={ms_to_dt(start_ms).isoformat()} ({reason})")

            total = 0
            for chunk in chunked_fetch_klines(symbol, interval, start_ms, until_ms):
                insert_klines(conn, symbol, interval, chunk)
                total += len(chunk)
                last_open = int(chunk[-1][0])
                print(f"  inserted +{len(chunk)} (total {total}) last_open={ms_to_dt(last_open).isoformat()}")

            print(f"[DONE] {symbol} {interval} inserted {total} rows")

    if args.compute_yearly:
        # Ensure monthly exists (interval '1M'); derived yearly will be computed from DB monthly
        derive_yearly_from_monthly(conn, symbols)
        print("[DONE] Derived yearly (1y) inserted/updated")

    conn.close()
    print("\n[ALL DONE]")


if __name__ == "__main__":
    main()