"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  UTCTimestamp,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import { useExchange } from "@/contexts/exchange-context";

/** =========================
 *  Interval (봉) 설정
 *  - Binance: 아래 전부 지원
 *  - Upbit: 분봉 1/3/5/10/15/30/60/240, 일/주/월 지원 (2h 같은 건 없어서 매핑)
 * ========================= */
const INTERVALS = [
  "1m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
  "1M",
] as const;
type Interval = (typeof INTERVALS)[number];

type Exchange = "binance" | "upbit";

/** =========================
 *  Binance types
 * ========================= */
type MiniTicker = {
  s: string;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q?: string;
};

type AggTrade = {
  e: "aggTrade";
  E: number;
  s: string;
  a: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
};

type Depth20 = {
  e: "depthUpdate";
  E: number;
  s: string;
  bids: [string, string][];
  asks: [string, string][];
};

type Kline = {
  e: "kline";
  E: number;
  s: string;
  k: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
    x: boolean;
    i: string;
  };
};

type Ticker24h = {
  e: "24hrTicker";
  E: number;
  s: string;
  c: string;
  P: string;
  h: string;
  l: string;
  v: string;
  q: string;
};

/** =========================
 *  Upbit types
 * ========================= */
type UpbitMarket = {
  market: string;
  korean_name: string;
  english_name: string;
};

type UpbitTicker = {
  type?: string;
  code: string;
  trade_price: number;
  signed_change_rate: number;
  high_price: number;
  low_price: number;
  acc_trade_price_24h: number;
  timestamp: number;
};

type UpbitOrderbook = {
  code: string;
  orderbook_units: Array<{
    ask_price: number;
    ask_size: number;
    bid_price: number;
    bid_size: number;
  }>;
  timestamp: number;
};

type UpbitTrade = {
  code: string;
  trade_price: number;
  trade_volume: number;
  ask_bid: "ASK" | "BID";
  timestamp: number;
  sequential_id?: number;
};

type UpbitTradeRow = UpbitTrade & {
  _k: string;
};

/** =========================
 *  Utils
 * ========================= */
function fmtNum(n: number, d = 2) {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(d) + "B";
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(d) + "M";
  if (abs >= 1_000) return (n / 1_000).toFixed(d) + "K";
  return n.toFixed(d);
}

function fmtPrice(n: number) {
  if (!Number.isFinite(n)) return "-";
  if (n >= 1000) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (n >= 1) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function pctClass(pct: number) {
  if (!Number.isFinite(pct)) return "text-slate-200";
  if (pct > 0) return "text-emerald-400";
  if (pct < 0) return "text-rose-400";
  return "text-slate-200";
}

function wsUrlCombined(streams: string[]) {
  return `wss://stream.binance.com:9443/stream?streams=${streams.join("/")}`;
}
function wsUrlSingle(stream: string) {
  return `wss://stream.binance.com:9443/ws/${stream}`;
}

/** =========================
 *  Binance REST: klines
 * ========================= */
async function fetchBinanceKlines(
  symbolUpper: string,
  interval: string,
  limit = 300,
) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbolUpper}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`binance klines failed: ${res.status}`);
  const rows: any[] = await res.json();
  return rows.map((r) => ({
    time: Math.floor(r[0] / 1000) as UTCTimestamp,
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

/** =========================
 *  Upbit: WS message parse
 * ========================= */
async function upbitParseMessage(data: any) {
  if (data instanceof Blob) {
    const buf = await data.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(buf);
    return JSON.parse(text);
  }
  if (data instanceof ArrayBuffer) {
    const text = new TextDecoder("utf-8").decode(data);
    return JSON.parse(text);
  }
  if (typeof data === "string") return JSON.parse(data);
  return null;
}

/** =========================
 *  Upbit REST: markets KRW
 * ========================= */
async function fetchUpbitMarketsKRW() {
  const res = await fetch(
    "https://api.upbit.com/v1/market/all?isDetails=false",
  );
  if (!res.ok) throw new Error(`upbit market/all failed: ${res.status}`);
  const all: UpbitMarket[] = await res.json();
  return all.filter((m) => m.market.startsWith("KRW-"));
}

/** =========================
 *  Upbit REST: candles
 * ========================= */
function mapUpbitInterval(interval: Interval) {
  if (interval === "1m") return { kind: "minutes" as const, unit: 1 };
  if (interval === "3m") return { kind: "minutes" as const, unit: 3 };
  if (interval === "5m") return { kind: "minutes" as const, unit: 5 };
  if (interval === "10m") return { kind: "minutes" as const, unit: 10 };
  if (interval === "15m") return { kind: "minutes" as const, unit: 15 };
  if (interval === "30m") return { kind: "minutes" as const, unit: 30 };
  if (interval === "1h") return { kind: "minutes" as const, unit: 60 };
  if (interval === "4h") return { kind: "minutes" as const, unit: 240 };
  if (interval === "1d") return { kind: "days" as const };
  if (interval === "1w") return { kind: "weeks" as const };
  return { kind: "months" as const };
}

async function fetchUpbitCandles(
  market: string,
  interval: Interval,
  count = 200,
) {
  const m = mapUpbitInterval(interval);

  let url = "";
  if (m.kind === "minutes") {
    url = `https://api.upbit.com/v1/candles/minutes/${m.unit}?market=${market}&count=${count}`;
  } else if (m.kind === "days") {
    url = `https://api.upbit.com/v1/candles/days?market=${market}&count=${count}`;
  } else if (m.kind === "weeks") {
    url = `https://api.upbit.com/v1/candles/weeks?market=${market}&count=${count}`;
  } else {
    url = `https://api.upbit.com/v1/candles/months?market=${market}&count=${count}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`upbit candles failed: ${res.status}`);
  const rows: any[] = await res.json();

  return rows
    .map((r) => ({
      time: Math.floor(r.timestamp / 1000) as UTCTimestamp,
      open: Number(r.opening_price),
      high: Number(r.high_price),
      low: Number(r.low_price),
      close: Number(r.trade_price),
      volume: Number(r.candle_acc_trade_volume),
    }))
    .sort((a, b) => a.time - b.time);
}

/** =========================
 *  Hook: Binance mini ticker list
 * ========================= */
function useBinanceMiniTickers(enabled: boolean) {
  const [tickers, setTickers] = useState<MiniTicker[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTickers([]);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
      return;
    }

    const ws = new WebSocket(wsUrlSingle("!miniTicker@arr"));
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const arr = JSON.parse(e.data) as MiniTicker[];
        setTickers(arr);
      } catch {}
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled]);

  return tickers;
}

/** =========================
 *  UI components
 * ========================= */
function MetricCard({
  title,
  value,
  sub,
  valueClass,
}: {
  title: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex h-24 flex-col justify-between rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80 px-4 py-3">
      <div className="text-xs text-slate-400">{title}</div>
      <div
        className={`text-lg font-semibold ${valueClass ?? "text-slate-100"}`}
      >
        {value}
      </div>
      {sub ? (
        <div className="text-xs text-slate-500">{sub}</div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}

function ChartPanel({
  title,
  exchange,
  symbol,
  interval,
  enabled,
  liveKline,
}: {
  title: string;
  exchange: Exchange;
  symbol: string;
  interval: Interval;
  enabled: boolean;
  liveKline: Kline | null;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;

    const chart = createChart(wrapRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(226,232,240,0.9)",
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.15)" },
      timeScale: {
        borderColor: "rgba(148,163,184,0.15)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(148,163,184,0.25)" },
        horzLine: { color: "rgba(148,163,184,0.25)" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(16,185,129,0.9)",
      downColor: "rgba(244,63,94,0.9)",
      borderVisible: false,
      wickUpColor: "rgba(16,185,129,0.9)",
      wickDownColor: "rgba(244,63,94,0.9)",
    }) as unknown as ISeriesApi<"Candlestick">;

    chartRef.current = chart;
    candleRef.current = series;

    const ro = new ResizeObserver(() => {
      const el = wrapRef.current;
      if (!el) return;
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
      chart.timeScale().fitContent();
    });
    ro.observe(wrapRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let canceled = false;

    (async () => {
      try {
        if (exchange === "binance") {
          const data = await fetchBinanceKlines(
            symbol.toUpperCase(),
            interval,
            300,
          );
          if (canceled) return;
          candleRef.current?.setData(
            data.map((d) => ({
              time: d.time,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            })),
          );
          chartRef.current?.timeScale().fitContent();
        } else {
          const data = await fetchUpbitCandles(symbol, interval, 200);
          if (canceled) return;
          candleRef.current?.setData(
            data.map((d) => ({
              time: d.time,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
            })),
          );
          chartRef.current?.timeScale().fitContent();
        }
      } catch {}
    })();

    return () => {
      canceled = true;
    };
  }, [enabled, exchange, symbol, interval]);

  useEffect(() => {
    if (!enabled) return;
    if (exchange !== "binance") return;
    if (!liveKline) return;

    const k = liveKline.k;
    const t = Math.floor(k.t / 1000) as UTCTimestamp;
    candleRef.current?.update({
      time: t,
      open: Number(k.o),
      high: Number(k.h),
      low: Number(k.l),
      close: Number(k.c),
    });
  }, [enabled, exchange, liveKline]);

  useEffect(() => {
    if (!enabled) return;
    if (exchange !== "upbit") return;

    let stop = false;

    const tick = async () => {
      try {
        const data = await fetchUpbitCandles(symbol, interval, 200);
        if (stop) return;
        candleRef.current?.setData(
          data.map((d) => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          })),
        );
      } catch {}
    };

    const id = window.setInterval(tick, 10_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [enabled, exchange, symbol, interval]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80">
      <div className="flex h-12 items-center justify-between border-b border-slate-800/60 px-4">
        <div className="text-sm text-slate-200">{title}</div>
        <div className="text-xs text-slate-400">
          {exchange === "binance" ? symbol.toUpperCase() : symbol} · {interval}
        </div>
      </div>
      <div className="h-[520px] p-2">
        <div ref={wrapRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function OrderBookPanel({
  exchange,
  symbol,
  enabled,
  binanceDepth,
  binanceBookTicker,
  upbitOrderbook,
}: {
  exchange: Exchange;
  symbol: string;
  enabled: boolean;
  binanceDepth: Depth20 | null;
  binanceBookTicker: any | null;
  upbitOrderbook: UpbitOrderbook | null;
}) {
  let asks: Array<[number, number]> = [];
  let bids: Array<[number, number]> = [];

  if (exchange === "binance") {
    asks = (binanceDepth?.asks ?? [])
      .slice(0, 20)
      .map(([p, q]) => [Number(p), Number(q)]);
    bids = (binanceDepth?.bids ?? [])
      .slice(0, 20)
      .map(([p, q]) => [Number(p), Number(q)]);
  } else {
    const units = upbitOrderbook?.orderbook_units ?? [];
    asks = units.slice(0, 20).map((u) => [u.ask_price, u.ask_size]);
    bids = units.slice(0, 20).map((u) => [u.bid_price, u.bid_size]);
  }

  const bestBid =
    exchange === "binance"
      ? binanceBookTicker
        ? Number(binanceBookTicker.b)
        : bids[0]?.[0]
      : bids[0]?.[0];

  const bestAsk =
    exchange === "binance"
      ? binanceBookTicker
        ? Number(binanceBookTicker.a)
        : asks[0]?.[0]
      : asks[0]?.[0];

  const spread =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk)
      ? bestAsk - bestBid
      : NaN;

  const spreadPct =
    Number.isFinite(bestBid) && Number.isFinite(bestAsk) && bestBid !== 0
      ? (spread / bestBid) * 100
      : NaN;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80">
      <div className="flex h-12 items-center justify-between border-b border-slate-800/60 px-4">
        <div className="text-sm text-slate-200">Order Book</div>
        <div className="text-xs text-slate-400">
          {exchange === "binance" ? symbol.toUpperCase() : symbol} ·{" "}
          {Number.isFinite(spread) ? (
            <>
              Spread {fmtPrice(spread)} ({fmtNum(spreadPct, 3)}%)
            </>
          ) : (
            "—"
          )}
        </div>
      </div>

      {!enabled ? (
        <div className="p-4 text-sm text-slate-400">
          Select an exchange to view order book.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-3">
          <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-black/10">
            <div className="border-b border-slate-800/50 px-3 py-2 text-xs text-slate-400">
              Asks
            </div>
            <div className="max-h-[240px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0F1A2A]">
                  <tr className="text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {asks.map(([p, q], index) => (
                    <tr
                      key={`ask-${p}-${q}-${index}`}
                      className="border-t border-slate-800/30"
                    >
                      <td className="px-3 py-2 text-rose-300">{fmtPrice(p)}</td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {fmtNum(q, 6)}
                      </td>
                    </tr>
                  ))}
                  {asks.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        Waiting for asks...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800/50 bg-black/10">
            <div className="border-b border-slate-800/50 px-3 py-2 text-xs text-slate-400">
              Bids
            </div>
            <div className="max-h-[240px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0F1A2A]">
                  <tr className="text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Price</th>
                    <th className="px-3 py-2 text-right font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map(([p, q], index) => (
                    <tr
                      key={`bid-${p}-${q}-${index}`}
                      className="border-t border-slate-800/30"
                    >
                      <td className="px-3 py-2 text-emerald-300">
                        {fmtPrice(p)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-200">
                        {fmtNum(q, 6)}
                      </td>
                    </tr>
                  ))}
                  {bids.length === 0 && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        Waiting for bids...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TradesPanel({
  exchange,
  symbol,
  enabled,
  binanceTrades,
  upbitTrades,
}: {
  exchange: Exchange;
  symbol: string;
  enabled: boolean;
  binanceTrades: AggTrade[];
  upbitTrades: UpbitTradeRow[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80">
      <div className="flex h-12 items-center justify-between border-b border-slate-800/60 px-4">
        <div className="text-sm text-slate-200">Recent Trades</div>
        <div className="text-xs text-slate-400">
          {exchange === "binance" ? symbol.toUpperCase() : symbol}
        </div>
      </div>

      {!enabled ? (
        <div className="p-4 text-sm text-slate-400">
          Select an exchange to view trades.
        </div>
      ) : (
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0F1A2A]">
              <tr className="text-slate-500">
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-right font-medium">Price</th>
                <th className="px-4 py-2 text-right font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {exchange === "binance"
                ? binanceTrades.map((t) => {
                    const side = t.m ? "sell" : "buy";
                    const time = new Date(t.T).toLocaleTimeString();

                    return (
                      <tr
                        key={`${t.a}-${t.T}`}
                        className="border-t border-slate-800/30"
                      >
                        <td className="px-4 py-2 text-slate-400">{time}</td>
                        <td
                          className={`px-4 py-2 text-right ${side === "buy" ? "text-emerald-300" : "text-rose-300"}`}
                        >
                          {fmtPrice(Number(t.p))}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-200">
                          {fmtNum(Number(t.q), 6)}
                        </td>
                      </tr>
                    );
                  })
                : upbitTrades.map((t) => {
                    const side = t.ask_bid === "BID" ? "buy" : "sell";
                    const time = new Date(t.timestamp).toLocaleTimeString();

                    return (
                      <tr key={t._k} className="border-t border-slate-800/30">
                        <td className="px-4 py-2 text-slate-400">{time}</td>
                        <td
                          className={`px-4 py-2 text-right ${side === "buy" ? "text-emerald-300" : "text-rose-300"}`}
                        >
                          {fmtPrice(t.trade_price)}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-200">
                          {fmtNum(t.trade_volume, 6)}
                        </td>
                      </tr>
                    );
                  })}

              {exchange === "binance" && binanceTrades.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Waiting for trades...
                  </td>
                </tr>
              )}

              {exchange === "upbit" && upbitTrades.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Waiting for trades...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** =========================
 *  Dashboard Page
 * ========================= */
export default function DashboardPage() {
  const { exchange } = useExchange();
  const ex = exchange as Exchange;

  const [interval, setInterval] = useState<Interval>("1m");
  const [search, setSearch] = useState("");

  const [symbolByEx, setSymbolByEx] = useState<Record<Exchange, string>>({
    binance: "BTCUSDT",
    upbit: "KRW-BTC",
  });

  const symbol = symbolByEx[ex];
  const symbolUpper = ex === "binance" ? symbol.toUpperCase() : symbol;
  const symbolLower = ex === "binance" ? symbol.toLowerCase() : symbol;

  /** ===== Binance: right list ===== */
  const binanceMiniTickers = useBinanceMiniTickers(ex === "binance");

  const binanceMarketList = useMemo(() => {
    const filtered = binanceMiniTickers
      .filter((t) => t.s?.endsWith("USDT"))
      .map((t) => {
        const last = Number(t.c);
        const open = Number(t.o);
        const volQ = Number((t as any).q ?? 0);
        const changePct = open ? ((last - open) / open) * 100 : 0;
        return { symbol: t.s, last, volQ, changePct };
      })
      .sort((a, b) => (b.volQ || 0) - (a.volQ || 0));

    if (!search.trim()) return filtered.slice(0, 150);
    const q = search.trim().toUpperCase();
    return filtered.filter((x) => x.symbol.includes(q)).slice(0, 150);
  }, [binanceMiniTickers, search]);

  /** ===== Binance: symbol realtime ===== */
  const [binanceTicker24h, setBinanceTicker24h] = useState<Ticker24h | null>(
    null,
  );
  const [binanceDepth, setBinanceDepth] = useState<Depth20 | null>(null);
  const [binanceBookTicker, setBinanceBookTicker] = useState<any | null>(null);
  const [binanceTrades, setBinanceTrades] = useState<AggTrade[]>([]);
  const [binanceLiveKline, setBinanceLiveKline] = useState<Kline | null>(null);

  useEffect(() => {
    setBinanceTicker24h(null);
    setBinanceDepth(null);
    setBinanceBookTicker(null);
    setBinanceTrades([]);
    setBinanceLiveKline(null);

    if (ex !== "binance") return;

    const streams = [
      `${symbolLower}@ticker`,
      `${symbolLower}@bookTicker`,
      `${symbolLower}@depth20@100ms`,
      `${symbolLower}@aggTrade`,
      `${symbolLower}@kline_${interval}`,
    ];

    const ws = new WebSocket(wsUrlCombined(streams));

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const stream: string = msg.stream;
        const data: any = msg.data;

        if (stream.endsWith("@ticker")) setBinanceTicker24h(data as Ticker24h);
        else if (stream.endsWith("@bookTicker")) setBinanceBookTicker(data);
        else if (stream.includes("@depth20")) setBinanceDepth(data as Depth20);
        else if (stream.endsWith("@aggTrade")) {
          const t = data as AggTrade;
          setBinanceTrades((prev) => [t, ...prev].slice(0, 60));
        } else if (stream.includes("@kline_")) {
          setBinanceLiveKline(data as Kline);
        }
      } catch {}
    };

    return () => ws.close();
  }, [ex, symbolLower, interval]);

  /** ===== Upbit: markets + ticker map for list ===== */
  const [upbitMarkets, setUpbitMarkets] = useState<UpbitMarket[]>([]);
  const [upbitTickerMap, setUpbitTickerMap] = useState<
    Record<string, UpbitTicker>
  >({});

  useEffect(() => {
    if (ex !== "upbit") return;

    let ws: WebSocket | null = null;
    let alive = true;

    (async () => {
      try {
        const markets = await fetchUpbitMarketsKRW();
        if (!alive) return;

        const top = markets.slice(0, 120);
        setUpbitMarkets(top);
        setUpbitTickerMap({});

        ws = new WebSocket("wss://api.upbit.com/websocket/v1");

        ws.onopen = () => {
          const codes = top.map((m) => m.market);
          const msg = [
            { ticket: "upbit-dashboard" },
            { type: "ticker", codes, isOnlyRealtime: true },
          ];
          ws!.send(JSON.stringify(msg));
        };

        ws.onmessage = async (ev) => {
          try {
            const data = (await upbitParseMessage(ev.data)) as UpbitTicker;
            if (!data?.code) return;

            setUpbitTickerMap((prev) => ({
              ...prev,
              [data.code]: data,
            }));
          } catch {}
        };
      } catch {}
    })();

    return () => {
      alive = false;
      if (ws) ws.close();
    };
  }, [ex]);

  const upbitMarketList = useMemo(() => {
    const items = upbitMarkets
      .map((m) => {
        const t = upbitTickerMap[m.market];
        const last = t?.trade_price ?? NaN;
        const changePct = t ? (t.signed_change_rate ?? 0) * 100 : NaN;
        const vol = t?.acc_trade_price_24h ?? NaN;

        return {
          market: m.market,
          name: m.korean_name,
          last,
          changePct,
          vol,
        };
      })
      .sort(
        (a, b) =>
          (Number.isFinite(b.vol) ? b.vol : 0) -
          (Number.isFinite(a.vol) ? a.vol : 0),
      );

    if (!search.trim()) return items.slice(0, 150);
    const q = search.trim().toUpperCase();
    return items
      .filter((x) => x.market.includes(q) || x.name.toUpperCase().includes(q))
      .slice(0, 150);
  }, [upbitMarkets, upbitTickerMap, search]);

  /** ===== Upbit: selected symbol streams ===== */
  const [upbitTicker, setUpbitTicker] = useState<UpbitTicker | null>(null);
  const [upbitOrderbook, setUpbitOrderbook] = useState<UpbitOrderbook | null>(
    null,
  );
  const [upbitTrades, setUpbitTrades] = useState<UpbitTradeRow[]>([]);
  const upbitTradeSeqRef = useRef(0);

  useEffect(() => {
    setUpbitTicker(null);
    setUpbitOrderbook(null);
    setUpbitTrades([]);
    upbitTradeSeqRef.current = 0;

    if (ex !== "upbit") return;

    const ws = new WebSocket("wss://api.upbit.com/websocket/v1");

    ws.onopen = () => {
      const msg = [
        { ticket: "upbit-symbol" },
        { type: "ticker", codes: [symbol], isOnlyRealtime: true },
        { type: "orderbook", codes: [symbol], isOnlyRealtime: true },
        { type: "trade", codes: [symbol], isOnlyRealtime: true },
      ];
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = async (ev) => {
      try {
        const data = await upbitParseMessage(ev.data);
        if (!data) return;

        if (data.orderbook_units) {
          setUpbitOrderbook(data as UpbitOrderbook);
          return;
        }

        if (typeof data.trade_price === "number" && data.ask_bid) {
          const t = data as UpbitTrade;

          const stableId =
            typeof t.sequential_id === "number"
              ? `upbit-${t.code}-${t.sequential_id}`
              : `upbit-${t.code}-${t.timestamp}-${t.trade_price}-${t.trade_volume}-${t.ask_bid}`;

          setUpbitTrades((prev) => {
            const exists = prev.some((item) => item._k === stableId);
            if (exists) return prev;

            const nextItem: UpbitTradeRow = { ...t, _k: stableId };
            return [nextItem, ...prev].slice(0, 60);
          });

          return;
        }

        if (
          typeof data.trade_price === "number" &&
          typeof data.acc_trade_price_24h === "number"
        ) {
          setUpbitTicker(data as UpbitTicker);
          return;
        }
      } catch {}
    };

    return () => ws.close();
  }, [ex, symbol]);

  /** ===== Metrics ===== */
  const metrics = useMemo(() => {
    if (ex === "binance") {
      const last = binanceTicker24h ? Number(binanceTicker24h.c) : NaN;
      const pct = binanceTicker24h ? Number(binanceTicker24h.P) : NaN;
      const high = binanceTicker24h ? Number(binanceTicker24h.h) : NaN;
      const low = binanceTicker24h ? Number(binanceTicker24h.l) : NaN;
      const volQ = binanceTicker24h ? Number(binanceTicker24h.q) : NaN;

      return {
        last,
        pct,
        high,
        low,
        vol: volQ,
        volUnit: "USDT",
      };
    }

    const last = upbitTicker ? upbitTicker.trade_price : NaN;
    const pct = upbitTicker ? (upbitTicker.signed_change_rate ?? 0) * 100 : NaN;
    const high = upbitTicker ? upbitTicker.high_price : NaN;
    const low = upbitTicker ? upbitTicker.low_price : NaN;
    const vol = upbitTicker ? upbitTicker.acc_trade_price_24h : NaN;

    return {
      last,
      pct,
      high,
      low,
      vol,
      volUnit: "KRW",
    };
  }, [ex, binanceTicker24h, upbitTicker]);

  /** ===== UI ===== */
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400">Market Dashboard</div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {ex === "binance" ? symbolUpper : symbol}
            </h1>
            <span className="text-xs text-slate-500">
              {ex === "binance" ? "Binance · Live" : "Upbit(KRW) · Live"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* mobile */}
          <div className="md:hidden w-full">
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as Interval)}
              className="w-full cursor-pointer rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 px-3 py-2 text-sm text-slate-200 outline-none"
            >
              {INTERVALS.map((it) => (
                <option
                  key={it}
                  value={it}
                  className="bg-[#0F1A2A] text-slate-200"
                >
                  {it}
                </option>
              ))}
            </select>
          </div>

          {/* desktop */}
          <div className="hidden md:block">
            <div className="max-w-full overflow-x-auto rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 p-1">
              <div className="flex items-center gap-1">
                {INTERVALS.map((it) => (
                  <button
                    key={it}
                    onClick={() => setInterval(it)}
                    className={[
                      "cursor-pointer whitespace-nowrap rounded-lg px-2 py-1.5 text-xs transition",
                      interval === it
                        ? "bg-white/15 text-white"
                        : "text-slate-300/80 hover:bg-white/10",
                    ].join(" ")}
                  >
                    {it}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard
          title="Last Price"
          value={fmtPrice(metrics.last)}
          sub="Selected symbol"
        />
        <MetricCard
          title="24h Change"
          value={
            Number.isFinite(metrics.pct) ? `${metrics.pct.toFixed(2)}%` : "-"
          }
          valueClass={pctClass(metrics.pct)}
          sub="Percent"
        />
        <MetricCard title="24h High" value={fmtPrice(metrics.high)} />
        <MetricCard title="24h Low" value={fmtPrice(metrics.low)} />
        <MetricCard
          title="24h Quote Vol"
          value={fmtNum(metrics.vol, 2)}
          sub={metrics.volUnit}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_360px]">
        <ChartPanel
          title="Price Chart"
          exchange={ex}
          symbol={symbol}
          interval={interval}
          enabled={true}
          liveKline={ex === "binance" ? binanceLiveKline : null}
        />

        <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80">
          <div className="flex h-12 items-center justify-between border-b border-slate-800/60 px-4">
            <div className="text-sm text-slate-200">Markets</div>
            <div className="text-xs text-slate-500">
              {ex === "binance" ? "USDT" : "KRW"}
            </div>
          </div>

          <div className="p-3">
            <div className="flex h-10 items-center rounded-xl border border-slate-800/70 bg-[#101C2E] px-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-slate-500"
                placeholder={
                  ex === "binance"
                    ? "Search symbol... (BTC, ETH)"
                    : "Search market/name... (BTC, 비트)"
                }
              />
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#0F1A2A]">
                <tr className="border-b border-slate-800/50 text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">
                    {ex === "binance" ? "Symbol" : "Market"}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Last</th>
                  <th className="px-4 py-2 text-right font-medium">24h%</th>
                </tr>
              </thead>
              <tbody>
                {ex === "binance"
                  ? binanceMarketList.map((m) => (
                      <tr
                        key={m.symbol}
                        className={[
                          "cursor-pointer border-t border-slate-800/30",
                          m.symbol === symbolUpper
                            ? "bg-white/5"
                            : "hover:bg-white/5",
                        ].join(" ")}
                        onClick={() =>
                          setSymbolByEx((prev) => ({
                            ...prev,
                            binance: m.symbol,
                          }))
                        }
                      >
                        <td className="px-4 py-2 text-slate-200">{m.symbol}</td>
                        <td className="px-4 py-2 text-right text-slate-200">
                          {fmtPrice(m.last)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${pctClass(m.changePct)}`}
                        >
                          {m.changePct.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  : upbitMarketList.map((m) => (
                      <tr
                        key={m.market}
                        className={[
                          "cursor-pointer border-t border-slate-800/30",
                          m.market === symbol
                            ? "bg-white/5"
                            : "hover:bg-white/5",
                        ].join(" ")}
                        onClick={() =>
                          setSymbolByEx((prev) => ({
                            ...prev,
                            upbit: m.market,
                          }))
                        }
                      >
                        <td className="px-4 py-2">
                          <div className="text-slate-200">{m.market}</div>
                          <div className="text-[11px] text-slate-500">
                            {m.name}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-200">
                          {fmtPrice(m.last)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right ${pctClass(m.changePct)}`}
                        >
                          {Number.isFinite(m.changePct)
                            ? `${m.changePct.toFixed(2)}%`
                            : "-"}
                        </td>
                      </tr>
                    ))}

                {ex === "binance" && binanceMarketList.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Loading Binance markets...
                    </td>
                  </tr>
                )}

                {ex === "upbit" && upbitMarketList.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Loading Upbit(KRW) markets...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {ex === "upbit" && (
            <div className="border-t border-slate-800/50 px-4 py-3 text-[11px] text-slate-500">
              * 업비트 KRW 마켓은 브라우저 부담 때문에 기본 120개만 구독해둠.
              (원하면 늘려줄게)
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <OrderBookPanel
          exchange={ex}
          symbol={symbol}
          enabled={true}
          binanceDepth={binanceDepth}
          binanceBookTicker={binanceBookTicker}
          upbitOrderbook={upbitOrderbook}
        />
        <TradesPanel
          exchange={ex}
          symbol={symbol}
          enabled={true}
          binanceTrades={binanceTrades}
          upbitTrades={upbitTrades}
        />
      </div>

      <div className="text-xs text-slate-500">
        * Binance는 public WS + REST, Upbit은 ticker/orderbook/trade WS + 캔들
        REST(폴링)로 구성.
      </div>
    </div>
  );
}
