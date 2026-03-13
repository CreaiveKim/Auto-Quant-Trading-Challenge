"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type SymbolKey = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";
type AutoStatus = "IDLE" | "RUNNING" | "PAUSED" | "STOPPED";

type Position = {
  symbol: SymbolKey;
  qty: number;
  avgPrice: number;
  investedUsd: number;
  openedAt: string;
  source?: "AUTO";
};

type TradeHistoryItem = {
  id: string;
  type: "BUY" | "SELL";
  symbol: SymbolKey;
  qty: number;
  price: number;
  usd: number;
  pnl?: number;
  source: "AUTO";
  createdAt: string;
};

type PaperAccount = {
  cash: number;
  position: Position | null;
  history: TradeHistoryItem[];
};

type TickerItem = {
  symbol: SymbolKey;
  label: string;
  price: number;
  changePct: number;
};

const WATCHLIST: { symbol: SymbolKey; label: string }[] = [
  { symbol: "BTCUSDT", label: "Bitcoin" },
  { symbol: "ETHUSDT", label: "Ethereum" },
  { symbol: "SOLUSDT", label: "Solana" },
];

function safeNumber(value: unknown, fallback = 0) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(n) ? n : fallback;
}

function formatUsd(value: unknown) {
  const amount = safeNumber(value, 0);

  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: amount < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(value: unknown) {
  const num = safeNumber(value, 0);
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function classByNumber(value: unknown) {
  const num = safeNumber(value, 0);

  if (num > 0) return "text-emerald-300";
  if (num < 0) return "text-rose-300";
  return "text-slate-100";
}

function getDefaultAccount(): PaperAccount {
  return {
    cash: 10000,
    position: null,
    history: [],
  };
}

function loadAccount(): PaperAccount {
  if (typeof window === "undefined") return getDefaultAccount();

  const raw = localStorage.getItem("paper_account_auto_quant");

  if (!raw) {
    const init = getDefaultAccount();
    localStorage.setItem("paper_account_auto_quant", JSON.stringify(init));
    return init;
  }

  try {
    const parsed = JSON.parse(raw);

    return {
      cash: safeNumber(parsed.cash, 10000),
      position: parsed.position
        ? {
            symbol: parsed.position.symbol ?? "BTCUSDT",
            qty: safeNumber(parsed.position.qty, 0),
            avgPrice: safeNumber(parsed.position.avgPrice, 0),
            investedUsd: safeNumber(parsed.position.investedUsd, 0),
            openedAt: parsed.position.openedAt ?? new Date().toISOString(),
            source: "AUTO",
          }
        : null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    const init = getDefaultAccount();
    localStorage.setItem("paper_account_auto_quant", JSON.stringify(init));
    return init;
  }
}

function saveAccount(account: PaperAccount) {
  localStorage.setItem("paper_account_auto_quant", JSON.stringify(account));
}

async function getPrice(symbol: SymbolKey): Promise<number> {
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    { cache: "no-store" },
  );
  const data = await res.json();
  return safeNumber(data.price, 0);
}

async function get24hr(symbol: SymbolKey) {
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
    { cache: "no-store" },
  );
  const data = await res.json();

  return {
    price: safeNumber(data.lastPrice, 0),
    changePct: safeNumber(data.priceChangePercent, 0),
  };
}

function Card({
  title,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-slate-800/70 bg-[#0F1B2D] shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3 lg:px-5">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {right}
        </div>
      )}
      <div className={`p-4 lg:p-5 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

function StatBox({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] px-4 py-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

function MiniTicker({ item }: { item: TickerItem }) {
  const up = item.changePct >= 0;

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-400">{item.label}</div>
          <div className="mt-1 text-sm font-semibold text-slate-100">
            {item.symbol}
          </div>
        </div>

        <span
          className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
            up
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/15 text-rose-300"
          }`}
        >
          {formatPct(item.changePct)}
        </span>
      </div>

      <div className="mt-4 text-2xl font-semibold text-slate-100">
        {formatUsd(item.price)}
      </div>
    </div>
  );
}

export default function ExcutionPage() {
  const [account, setAccount] = useState<PaperAccount | null>(null);

  const [tickers, setTickers] = useState<Record<SymbolKey, TickerItem>>({
    BTCUSDT: { symbol: "BTCUSDT", label: "Bitcoin", price: 0, changePct: 0 },
    ETHUSDT: { symbol: "ETHUSDT", label: "Ethereum", price: 0, changePct: 0 },
    SOLUSDT: { symbol: "SOLUSDT", label: "Solana", price: 0, changePct: 0 },
  });

  const [autoStatus, setAutoStatus] = useState<AutoStatus>("IDLE");
  const [aiCapital, setAiCapital] = useState("3000");
  const [riskPerTrade, setRiskPerTrade] = useState("2");
  const [maxPositions, setMaxPositions] = useState("1");
  const [dailyLossLimit, setDailyLossLimit] = useState("5");
  const [rebalanceCycle, setRebalanceCycle] = useState("5");

  const [expectedReturn, setExpectedReturn] = useState(2.4);
  const [confidence, setConfidence] = useState(76);
  const [riskLevel, setRiskLevel] = useState<"LOW" | "MID" | "HIGH">("MID");
  const [watchingCoins, setWatchingCoins] = useState<SymbolKey[]>([
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
  ]);
  const [signalLabel, setSignalLabel] = useState("Neutral Bias");
  const [engineMode, setEngineMode] = useState("Momentum + Risk Filter");

  const [aiLogs, setAiLogs] = useState<string[]>([]);
  const [activityLogs, setActivityLogs] = useState<string[]>([]);

  const autoLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStatusRef = useRef<AutoStatus>("IDLE");

  useEffect(() => {
    setAccount(loadAccount());
  }, []);

  useEffect(() => {
    autoStatusRef.current = autoStatus;
  }, [autoStatus]);

  useEffect(() => {
    let alive = true;

    const fetchTickers = async () => {
      try {
        const results = await Promise.all(
          WATCHLIST.map(async ({ symbol, label }) => {
            const data = await get24hr(symbol);
            return {
              symbol,
              label,
              price: data.price,
              changePct: data.changePct,
            } as TickerItem;
          }),
        );

        if (!alive) return;

        const next = results.reduce(
          (acc, cur) => {
            acc[cur.symbol] = cur;
            return acc;
          },
          {} as Record<SymbolKey, TickerItem>,
        );

        setTickers(next);
      } catch {
        // noop
      }
    };

    fetchTickers();
    const timer = setInterval(fetchTickers, 3000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autoLoopRef.current) clearInterval(autoLoopRef.current);
    };
  }, []);

  const updateAccount = (next: PaperAccount) => {
    saveAccount(next);
    setAccount(next);
  };

  const addAiLog = (text: string) => {
    const line = `${new Date().toLocaleTimeString()}  ${text}`;
    setAiLogs((prev) => [line, ...prev].slice(0, 120));
    setActivityLogs((prev) => [line, ...prev].slice(0, 150));
  };

  const currentPosition = account?.position ?? null;
  const currentPositionPrice = currentPosition
    ? (tickers[currentPosition.symbol]?.price ?? 0)
    : 0;
  const cash = account?.cash ?? 0;
  const positionValue = currentPosition
    ? currentPosition.qty * currentPositionPrice
    : 0;
  const investedUsd = currentPosition?.investedUsd ?? 0;
  const pnlUsd = currentPosition ? positionValue - investedUsd : 0;
  const pnlPct =
    currentPosition && investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : 0;
  const totalEquity = cash + positionValue;

  const aiCapitalNumber = useMemo(() => safeNumber(aiCapital, 0), [aiCapital]);
  const riskPerTradeNumber = useMemo(
    () => safeNumber(riskPerTrade, 0),
    [riskPerTrade],
  );
  const dailyLossLimitNumber = useMemo(
    () => safeNumber(dailyLossLimit, 0),
    [dailyLossLimit],
  );
  const rebalanceCycleNumber = useMemo(
    () => Math.max(3, safeNumber(rebalanceCycle, 5)),
    [rebalanceCycle],
  );

  const modelHealth = useMemo(() => {
    if (confidence >= 82 && expectedReturn >= 2.5) return "Strong";
    if (confidence >= 72 && expectedReturn >= 1.5) return "Stable";
    return "Cautious";
  }, [confidence, expectedReturn]);

  const cashUsage = totalEquity > 0 ? (investedUsd / totalEquity) * 100 : 0;

  const pickTopCoin = (symbols?: SymbolKey[]) => {
    const base = (symbols ?? WATCHLIST.map((v) => v.symbol)).map((symbol) => ({
      symbol,
      changePct: tickers[symbol]?.changePct ?? -999,
    }));

    const sorted = base.sort((a, b) => b.changePct - a.changePct);
    return sorted[0]?.symbol ?? "BTCUSDT";
  };

  const executeBuy = async (symbol: SymbolKey, usd: number) => {
    const live = loadAccount();
    if (live.position) return false;
    if (usd <= 0 || usd > live.cash) return false;

    const price = await getPrice(symbol);
    if (price <= 0) return false;

    const qty = usd / price;

    const nextPosition: Position = {
      symbol,
      qty,
      avgPrice: price,
      investedUsd: usd,
      openedAt: new Date().toISOString(),
      source: "AUTO",
    };

    const trade: TradeHistoryItem = {
      id: `${Date.now()}-AUTO-buy`,
      type: "BUY",
      symbol,
      qty,
      price,
      usd,
      source: "AUTO",
      createdAt: new Date().toISOString(),
    };

    const updated: PaperAccount = {
      cash: live.cash - usd,
      position: nextPosition,
      history: [trade, ...live.history],
    };

    updateAccount(updated);
    addAiLog(
      `🟢 AUTO BUY ${symbol} / capital ${formatUsd(usd)} / entry ${formatUsd(price)}`,
    );

    return true;
  };

  const executeSell = async (reason: "AUTO" | "STOP") => {
    const live = loadAccount();
    if (!live.position) return false;

    const symbol = live.position.symbol;
    const price = await getPrice(symbol);
    if (price <= 0) return false;

    const value = live.position.qty * price;
    const pnl = value - live.position.investedUsd;

    const trade: TradeHistoryItem = {
      id: `${Date.now()}-${reason}-sell`,
      type: "SELL",
      symbol,
      qty: live.position.qty,
      price,
      usd: value,
      pnl,
      source: "AUTO",
      createdAt: new Date().toISOString(),
    };

    const updated: PaperAccount = {
      cash: live.cash + value,
      position: null,
      history: [trade, ...live.history],
    };

    updateAccount(updated);

    if (reason === "STOP") {
      addAiLog(
        `⛔ FORCE EXIT ${symbol} / realized ${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}`,
      );
    } else {
      addAiLog(
        `🔴 AUTO SELL ${symbol} / realized ${pnl >= 0 ? "+" : ""}${formatUsd(pnl)}`,
      );
    }

    return true;
  };

  const simulateSignals = () => {
    const nextExpected = Number((Math.random() * 4 + 0.8).toFixed(1));
    const nextConfidence = Math.floor(Math.random() * 18) + 70;
    const riskRand = Math.random();
    const nextRisk = riskRand > 0.72 ? "HIGH" : riskRand > 0.34 ? "MID" : "LOW";

    const candidates: SymbolKey[] = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const nextWatching = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

    setExpectedReturn(nextExpected);
    setConfidence(nextConfidence);
    setRiskLevel(nextRisk);
    setWatchingCoins(nextWatching);

    if (nextExpected >= 3 && nextConfidence >= 80) {
      setSignalLabel("Aggressive Long Bias");
      setEngineMode("Momentum Breakout");
    } else if (nextExpected <= 1.4 || nextRisk === "HIGH") {
      setSignalLabel("Defensive Filter");
      setEngineMode("Capital Protection");
    } else {
      setSignalLabel("Selective Long Bias");
      setEngineMode("Momentum + Risk Filter");
    }

    return {
      nextExpected,
      nextConfidence,
      nextRisk,
      nextWatching,
    };
  };

  const startAutoTrading = async () => {
    if (!account) return;

    if (autoLoopRef.current) {
      clearInterval(autoLoopRef.current);
      autoLoopRef.current = null;
    }

    setAutoStatus("RUNNING");
    autoStatusRef.current = "RUNNING";

    addAiLog(
      `🤖 engine started / max capital ${formatUsd(aiCapitalNumber)} / risk ${riskPerTradeNumber}% / cycle ${rebalanceCycleNumber}s`,
    );

    const first = simulateSignals();
    const live = loadAccount();

    if (!live.position) {
      const target = pickTopCoin(first.nextWatching);
      const alloc = Math.min(aiCapitalNumber, live.cash);

      if (alloc > 0) {
        try {
          await executeBuy(target, alloc);
        } catch {
          addAiLog("❌ initial auto entry failed");
        }
      } else {
        addAiLog("⚠️ no available cash for auto trading");
      }
    }

    autoLoopRef.current = setInterval(async () => {
      if (autoStatusRef.current === "PAUSED") return;
      if (autoStatusRef.current !== "RUNNING") return;

      const { nextExpected, nextWatching } = simulateSignals();
      const liveAccount = loadAccount();

      if (!liveAccount.position) {
        const target = pickTopCoin(nextWatching);
        const alloc = Math.min(aiCapitalNumber, liveAccount.cash);

        if (alloc > 0) {
          try {
            await executeBuy(target, alloc);
          } catch {
            addAiLog("❌ auto re-entry failed");
          }
        }
        return;
      }

      const currentSymbol = liveAccount.position.symbol;
      const currentLivePrice = await getPrice(currentSymbol);
      if (currentLivePrice <= 0) return;

      const currentPnlPct =
        ((currentLivePrice - liveAccount.position.avgPrice) /
          liveAccount.position.avgPrice) *
        100;

      addAiLog(
        `monitoring ${currentSymbol} / live ${formatUsd(currentLivePrice)} / pnl ${formatPct(currentPnlPct)} / signal ${signalLabel}`,
      );

      const stopLossTriggered = currentPnlPct <= -dailyLossLimitNumber;
      const takeProfitTriggered = currentPnlPct >= nextExpected;
      const rotationTriggered =
        nextWatching[0] !== currentSymbol &&
        (tickers[nextWatching[0]]?.changePct ?? 0) >
          (tickers[currentSymbol]?.changePct ?? 0) + 0.8;
      const randomExitTriggered = Math.random() > 0.84;

      if (
        stopLossTriggered ||
        takeProfitTriggered ||
        rotationTriggered ||
        randomExitTriggered
      ) {
        try {
          await executeSell("AUTO");
        } catch {
          addAiLog("❌ auto exit failed");
          return;
        }

        const afterExit = loadAccount();
        const nextTarget = pickTopCoin(nextWatching);
        const nextAlloc = Math.min(aiCapitalNumber, afterExit.cash);

        if (nextAlloc > 0 && autoStatusRef.current === "RUNNING") {
          try {
            await executeBuy(nextTarget, nextAlloc);
          } catch {
            addAiLog("❌ rotation entry failed");
          }
        }
      }
    }, rebalanceCycleNumber * 1000);
  };

  const pauseAutoTrading = () => {
    setAutoStatus("PAUSED");
    autoStatusRef.current = "PAUSED";
    addAiLog("⏸ paused / 신규 진입 및 자동청산 대기");
  };

  const stopAutoTrading = async () => {
    if (autoLoopRef.current) {
      clearInterval(autoLoopRef.current);
      autoLoopRef.current = null;
    }

    try {
      const live = loadAccount();
      if (live.position) {
        await executeSell("STOP");
      }
    } catch {
      addAiLog("❌ forced liquidation failed");
    }

    setAutoStatus("STOPPED");
    autoStatusRef.current = "STOPPED";
    addAiLog("⏹ engine stopped");
  };

  const resetPaperAccount = () => {
    if (autoLoopRef.current) {
      clearInterval(autoLoopRef.current);
      autoLoopRef.current = null;
    }

    const fresh = getDefaultAccount();
    saveAccount(fresh);
    setAccount(fresh);
    setAutoStatus("IDLE");
    autoStatusRef.current = "IDLE";
    setAiLogs([]);
    setActivityLogs([]);
    setExpectedReturn(2.4);
    setConfidence(76);
    setRiskLevel("MID");
    setWatchingCoins(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
    setSignalLabel("Neutral Bias");
    setEngineMode("Momentum + Risk Filter");
  };

  return (
    <div className="space-y-4 overflow-y-auto md:h-[calc(100dvh-120px)] md:overflow-hidden">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MiniTicker item={tickers.BTCUSDT} />
        <MiniTicker item={tickers.ETHUSDT} />
        <MiniTicker item={tickers.SOLUSDT} />

        <div className="rounded-2xl border border-slate-800/70 bg-[linear-gradient(135deg,#132238_0%,#0F1B2D_100%)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-400">Quant Signal</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                {signalLabel}
              </div>
            </div>

            <span
              className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                riskLevel === "LOW"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : riskLevel === "HIGH"
                    ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
                    : "border-amber-500/30 bg-amber-500/15 text-amber-300"
              }`}
            >
              {riskLevel}
            </span>
          </div>

          <div className="mt-4 text-2xl font-semibold text-slate-100">
            +{expectedReturn.toFixed(1)}%
          </div>
          <div className="mt-2 text-sm text-slate-400">
            model expected edge / confidence {confidence}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 xl:grid-cols-12">
        <Card
          title="Auto Quant Engine"
          className="xl:col-span-5 md:min-h-0"
          bodyClassName="space-y-4 md:flex md:min-h-0 md:flex-col"
          right={
            <span
              className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                autoStatus === "RUNNING"
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : autoStatus === "PAUSED"
                    ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                    : autoStatus === "STOPPED"
                      ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
                      : "border-slate-600/40 bg-slate-700/20 text-slate-300"
              }`}
            >
              {autoStatus}
            </span>
          }
        >
          <div className="rounded-2xl border border-slate-800/70 bg-[linear-gradient(135deg,#101C2E_0%,#0B1420_100%)] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  AI-driven Paper Quant
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-400">
                  실시간 시세 기반으로 진입, 모니터링, 손절, 익절, 로테이션까지
                  자동으로 수행하는 모의 자동매매 엔진
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-[#0B1420] px-4 py-3">
                <div className="text-[11px] text-slate-400">Engine Mode</div>
                <div className="mt-1 text-sm font-semibold text-slate-100">
                  {engineMode}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400">Max Auto Capital</label>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={aiCapital}
                onChange={(e) => setAiCapital(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Risk / Trade (%)</label>
              <input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={riskPerTrade}
                onChange={(e) => setRiskPerTrade(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Max Positions</label>
              <input
                type="number"
                min={1}
                value={maxPositions}
                onChange={(e) => setMaxPositions(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">
                Auto Stop Loss (%)
              </label>
              <input
                type="number"
                min={0}
                step="0.1"
                inputMode="decimal"
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm text-slate-100 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-slate-400">
                Rebalance Cycle (sec)
              </label>
              <input
                type="number"
                min={3}
                step={1}
                inputMode="numeric"
                value={rebalanceCycle}
                onChange={(e) => setRebalanceCycle(e.target.value)}
                className="mt-2 h-11 w-full rounded-2xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm text-slate-100 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatBox
              label="Expected Return"
              value={`+${expectedReturn.toFixed(1)}%`}
              valueClassName="text-emerald-300"
            />
            <StatBox
              label="Confidence"
              value={`${confidence}%`}
              valueClassName="text-sky-300"
            />
            <StatBox label="Watching Coins" value={`${watchingCoins.length}`} />
            <StatBox
              label="Model Health"
              value={modelHealth}
              valueClassName={
                modelHealth === "Strong"
                  ? "text-emerald-300"
                  : modelHealth === "Stable"
                    ? "text-sky-300"
                    : "text-amber-300"
              }
            />
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">Current Watchlist</div>
              <div className="text-xs text-slate-500">rotation candidates</div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {watchingCoins.map((coin) => (
                <span
                  key={coin}
                  className="rounded-xl border border-slate-700/60 bg-[#0B1420] px-3 py-2 text-xs text-slate-200"
                >
                  {coin}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              onClick={startAutoTrading}
              className="h-11 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Start
            </button>
            <button
              onClick={pauseAutoTrading}
              className="h-11 rounded-2xl border border-amber-500/30 bg-amber-500/15 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20"
            >
              Pause
            </button>
            <button
              onClick={stopAutoTrading}
              className="h-11 rounded-2xl border border-rose-500/30 bg-rose-500/15 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
            >
              Stop
            </button>
            <button
              onClick={resetPaperAccount}
              className="h-11 rounded-2xl border border-slate-700/60 bg-slate-800/40 text-sm font-semibold text-slate-200 transition hover:bg-slate-700/40"
            >
              Reset
            </button>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] md:min-h-0 md:flex-1">
            <div className="border-b border-slate-800/70 px-4 py-3 text-sm font-semibold text-slate-100">
              AI Activity
            </div>
            <div className="max-h-[260px] overflow-auto px-4 py-3 text-xs text-slate-300 md:h-full md:max-h-none">
              <ul className="space-y-2">
                {aiLogs.length === 0 ? (
                  <li className="text-slate-500">no activity yet</li>
                ) : (
                  aiLogs.map((line, idx) => (
                    <li key={idx} className="whitespace-pre-wrap">
                      <span className="text-slate-500">• </span>
                      {line}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </Card>

        <Card
          title="Quant Portfolio"
          className="xl:col-span-7 md:min-h-0"
          bodyClassName="space-y-4 md:flex md:min-h-0 md:flex-col"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatBox label="Current Balance" value={formatUsd(cash)} />
            <StatBox label="Position Value" value={formatUsd(positionValue)} />
            <StatBox
              label="PnL"
              value={formatPct(pnlPct)}
              valueClassName={classByNumber(pnlPct)}
            />
            <StatBox label="Total Equity" value={formatUsd(totalEquity)} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7 md:min-h-0 md:flex md:flex-col">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] p-4">
                  <div className="text-xs text-slate-400">Capital Usage</div>
                  <div className="mt-2 text-3xl font-semibold text-slate-100">
                    {cashUsage.toFixed(0)}%
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800/70">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, cashUsage))}%`,
                      }}
                    />
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    allocated capital vs total equity
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] p-4">
                  <div className="text-xs text-slate-400">Risk Summary</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-3xl font-semibold text-slate-100">
                      {riskPerTradeNumber.toFixed(1)}%
                    </div>
                    <span
                      className={`rounded-lg border px-2 py-1 text-[11px] font-medium ${
                        riskLevel === "LOW"
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                          : riskLevel === "HIGH"
                            ? "border-rose-500/30 bg-rose-500/15 text-rose-300"
                            : "border-amber-500/30 bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {riskLevel}
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    stop loss {dailyLossLimitNumber.toFixed(1)}% / max positions{" "}
                    {maxPositions}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-100">
                    Active Quant Position
                  </div>
                  <div className="text-xs text-slate-500">live position</div>
                </div>

                {currentPosition ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] text-slate-400">
                            Symbol
                          </div>
                          <div className="mt-1 text-lg font-semibold text-slate-100">
                            {currentPosition.symbol}
                          </div>
                        </div>

                        <span className="rounded-lg border border-sky-500/30 bg-sky-500/15 px-2 py-1 text-[11px] font-medium text-sky-300">
                          AUTO
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                        <div className="text-[11px] text-slate-400">
                          Quantity
                        </div>
                        <div className="mt-1 font-semibold text-slate-100">
                          {safeNumber(currentPosition.qty).toFixed(6)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                        <div className="text-[11px] text-slate-400">
                          Avg Price
                        </div>
                        <div className="mt-1 font-semibold text-slate-100">
                          {formatUsd(currentPosition.avgPrice)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                        <div className="text-[11px] text-slate-400">
                          Invested
                        </div>
                        <div className="mt-1 font-semibold text-slate-100">
                          {formatUsd(currentPosition.investedUsd)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                        <div className="text-[11px] text-slate-400">
                          Current Value
                        </div>
                        <div className="mt-1 font-semibold text-slate-100">
                          {formatUsd(positionValue)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                      <div className="text-[11px] text-slate-400">
                        Live Profit / Loss
                      </div>
                      <div
                        className={`mt-1 text-xl font-semibold ${classByNumber(
                          pnlPct,
                        )}`}
                      >
                        {formatPct(pnlPct)}
                      </div>
                      <div className={`mt-1 text-sm ${classByNumber(pnlUsd)}`}>
                        {pnlUsd >= 0 ? "+" : ""}
                        {formatUsd(pnlUsd)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-700/70 bg-[#0B1420] px-4 py-10 text-center text-sm text-slate-500">
                    no active quant position
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 lg:col-span-5 md:min-h-0 md:flex md:flex-col">
              <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-100">
                    Strategy Snapshot
                  </div>
                  <div className="text-xs text-slate-500">live model state</div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                    <div className="text-[11px] text-slate-400">
                      Primary Mode
                    </div>
                    <div className="mt-1 font-semibold text-slate-100">
                      {engineMode}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                    <div className="text-[11px] text-slate-400">
                      Signal Bias
                    </div>
                    <div className="mt-1 font-semibold text-slate-100">
                      {signalLabel}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800/70 bg-[#0B1420] px-4 py-3">
                    <div className="text-[11px] text-slate-400">
                      Rebalance Cycle
                    </div>
                    <div className="mt-1 font-semibold text-slate-100">
                      {rebalanceCycleNumber}s
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-[#101C2E] md:min-h-0 md:flex-1">
                <div className="border-b border-slate-800/70 px-4 py-3 text-sm font-semibold text-slate-100">
                  Recent Trades
                </div>
                <div className="max-h-[340px] overflow-auto px-4 py-3 md:h-full md:max-h-none">
                  <div className="space-y-3">
                    {(account?.history ?? []).length === 0 ? (
                      <div className="text-sm text-slate-500">
                        no trade history
                      </div>
                    ) : (
                      account!.history.slice(0, 10).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-slate-800/70 bg-[#0B1420] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div
                              className={`text-sm font-semibold ${
                                item.type === "BUY"
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              {item.type} {item.symbol}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString()}
                            </div>
                          </div>

                          <div className="mt-1 text-[11px] text-slate-500">
                            {item.source}
                          </div>

                          <div className="mt-2 text-xs text-slate-300">
                            qty {safeNumber(item.qty).toFixed(6)} / price{" "}
                            {formatUsd(item.price)}
                          </div>

                          <div className="mt-1 text-xs text-slate-400">
                            value {formatUsd(item.usd)}
                          </div>

                          {typeof item.pnl === "number" && (
                            <div
                              className={`mt-2 text-xs ${
                                safeNumber(item.pnl) >= 0
                                  ? "text-emerald-300"
                                  : "text-rose-300"
                              }`}
                            >
                              realized {safeNumber(item.pnl) >= 0 ? "+" : ""}
                              {formatUsd(item.pnl)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card
        title="Execution Activity"
        className="md:h-[170px]"
        bodyClassName="md:h-[calc(100%-57px)]"
      >
        <div className="max-h-[180px] overflow-auto text-xs text-slate-300 md:h-full md:max-h-none">
          <ul className="space-y-2">
            {activityLogs.length === 0 ? (
              <li className="text-slate-500">no activity yet</li>
            ) : (
              activityLogs.map((line, idx) => (
                <li key={idx} className="whitespace-pre-wrap">
                  <span className="text-slate-500">• </span>
                  {line}
                </li>
              ))
            )}
          </ul>
        </div>
      </Card>
    </div>
  );
}
