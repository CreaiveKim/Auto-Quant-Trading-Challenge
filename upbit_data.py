import os
import csv
import time
import argparse
import multiprocessing as mp
from datetime import datetime, timezone
from dateutil import parser as dtparser

import requests

BASE = "https://api.upbit.com/v1"

TIMEFRAMES = [
    "minutes/1", "minutes/3", "minutes/5", "minutes/10",
    "minutes/15", "minutes/30", "minutes/60", "minutes/240",
    "days", "weeks", "months",
]

HEADER = [
    "market", "timeframe", "timestamp_utc", "timestamp_kst",
    "open", "high", "low", "close", "volume", "value",
]


def desktop_dir() -> str:
    return os.path.join(os.path.expanduser("~"), "Desktop")


def candle_endpoint(tf: str) -> str:
    if tf.startswith("minutes/"):
        unit = tf.split("/")[1]
        return f"{BASE}/candles/minutes/{unit}"
    if tf == "days":
        return f"{BASE}/candles/days"
    if tf == "weeks":
        return f"{BASE}/candles/weeks"
    if tf == "months":
        return f"{BASE}/candles/months"
    raise ValueError(tf)


def iso_to_to_param(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_utc(s: str) -> datetime:
    dt = dtparser.isoparse(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def fetch_json(url: str, params: dict | None = None, timeout: int = 30):
    r = requests.get(url, params=params, timeout=timeout)
    if r.status_code == 429:
        raise RuntimeError("RATE_LIMIT")
    r.raise_for_status()
    return r.json()


def get_krw_markets() -> list[str]:
    data = fetch_json(f"{BASE}/market/all", params={"isDetails": "false"})
    return [x["market"] for x in data if x["market"].startswith("KRW-")]


def get_topN_by_24h_value(n: int) -> list[str]:
    markets = get_krw_markets()
    out = []
    chunk = 100
    for i in range(0, len(markets), chunk):
        mk = ",".join(markets[i:i+chunk])
        tickers = fetch_json(f"{BASE}/ticker", params={"markets": mk})
        for t in tickers:
            out.append((t["market"], float(t.get("acc_trade_price_24h") or 0.0)))
        time.sleep(0.08)
    out.sort(key=lambda x: x[1], reverse=True)
    return [m for m, _ in out[:n]]


def worker(job_q: mp.Queue, msg_q: mp.Queue, start_dt: datetime, base_sleep: float):
    """
    job: (market, tf)
    emits messages to msg_q:
      {"type":"rows","rows":[...], "market":..., "tf":..., "oldest_utc":...}
      {"type":"done","market":..., "tf":...}
      {"type":"rl","market":..., "tf":..., "sleep":...}
    """
    while True:
        job = job_q.get()
        if job is None:
            break

        market, tf = job
        url = candle_endpoint(tf)

        to_dt = None
        backoff = base_sleep

        while True:
            params = {"market": market, "count": 200}
            if to_dt is not None:
                params["to"] = iso_to_to_param(to_dt)

            try:
                data = fetch_json(url, params=params)
            except RuntimeError as e:
                if str(e) == "RATE_LIMIT":
                    backoff = min(2.0, max(0.2, backoff * 1.8))
                    msg_q.put({"type": "rl", "market": market, "tf": tf, "sleep": backoff})
                    time.sleep(backoff)
                    continue
                raise

            if not isinstance(data, list) or not data:
                break

            data_rev = list(reversed(data))
            rows = []
            for x in data_rev:
                rows.append([
                    market,
                    tf,
                    x.get("candle_date_time_utc"),
                    x.get("candle_date_time_kst"),
                    x.get("opening_price"),
                    x.get("high_price"),
                    x.get("low_price"),
                    x.get("trade_price"),
                    x.get("candle_acc_trade_volume"),
                    x.get("candle_acc_trade_price"),
                ])

            oldest_utc = parse_utc(data[-1]["candle_date_time_utc"])
            msg_q.put({
                "type": "rows",
                "market": market,
                "tf": tf,
                "oldest_utc": oldest_utc.isoformat(),
                "rows": rows
            })

            to_dt = oldest_utc

            if oldest_utc <= start_dt:
                break

            backoff = base_sleep
            time.sleep(base_sleep)

        msg_q.put({"type": "done", "market": market, "tf": tf})


def writer(msg_q: mp.Queue, out_csv: str, total_jobs: int, log_every_batches: int = 1):
    """
    Single writer: safe append + clean logging.
    log_every_batches=1 means log every batch; 5 means log every 5 batches per job.
    """
    new_file = not (os.path.exists(out_csv) and os.path.getsize(out_csv) > 0)
    batch_counter = {}  # (market,tf) -> batches

    with open(out_csv, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(HEADER)

        done = 0
        while done < total_jobs:
            msg = msg_q.get()

            mtype = msg.get("type")
            if mtype == "rows":
                market = msg["market"]
                tf = msg["tf"]
                key = (market, tf)
                batch_counter[key] = batch_counter.get(key, 0) + 1

                w.writerows(msg["rows"])

                if batch_counter[key] % log_every_batches == 0:
                    print(f"[PROGRESS] {market} {tf} rows={len(msg['rows'])} oldest_utc={msg['oldest_utc']}", flush=True)

            elif mtype == "rl":
                print(f"[RATE_LIMIT] {msg['market']} {msg['tf']} backoff={msg['sleep']:.2f}s", flush=True)

            elif mtype == "done":
                done += 1
                print(f"[DONE] {msg['market']} {msg['tf']} ({done}/{total_jobs})", flush=True)

            else:
                print(f"[WARN] unknown message: {msg}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2018-01-01")
    ap.add_argument("--top", type=int, default=20)
    ap.add_argument("--out", default=os.path.join(desktop_dir(), "upbit_top20_all_parallel.csv"))
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--sleep", type=float, default=0.02)
    ap.add_argument("--markets", default="", help="직접 지정: KRW-BTC,KRW-ETH,... (지정하면 top 계산 안 함)")
    ap.add_argument("--log_every", type=int, default=1, help="배치 로그 주기(1=매번, 5=5배치마다)")
    args = ap.parse_args()

    start_dt = dtparser.isoparse(args.start)
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    start_dt = start_dt.astimezone(timezone.utc)

    if args.markets.strip():
        markets = [x.strip() for x in args.markets.split(",") if x.strip()]
    else:
        markets = get_topN_by_24h_value(args.top)

    jobs = [(m, tf) for m in markets for tf in TIMEFRAMES]
    total_jobs = len(jobs)

    print(f"[INFO] markets={len(markets)} timeframes={len(TIMEFRAMES)} total_jobs={total_jobs}")
    print(f"[INFO] start_utc={start_dt.isoformat()}")
    print(f"[INFO] out={args.out}")
    print(f"[INFO] workers={args.workers} sleep={args.sleep} log_every={args.log_every}")

    ctx = mp.get_context("spawn")
    job_q = ctx.Queue()
    msg_q = ctx.Queue(maxsize=200)

    # writer first
    wp = ctx.Process(target=writer, args=(msg_q, args.out, total_jobs, args.log_every), daemon=True)
    wp.start()

    for j in jobs:
        job_q.put(j)
    for _ in range(args.workers):
        job_q.put(None)

    workers = []
    for _ in range(args.workers):
        p = ctx.Process(target=worker, args=(job_q, msg_q, start_dt, args.sleep))
        p.start()
        workers.append(p)

    for p in workers:
        p.join()
    wp.join()

    print("[ALL DONE] saved:", args.out)


if __name__ == "__main__":
    main()