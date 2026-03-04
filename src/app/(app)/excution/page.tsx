"use client";

import React, { useMemo, useState } from "react";

function Card({
  title,
  children,
  className = "",
  right,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-800/70 bg-[#0F1B2D] shadow-[0_10px_35px_rgba(0,0,0,0.35)] ${className}`}
    >
      {(title || right) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {right}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function Pill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const toneCls =
    tone === "good"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : tone === "warn"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : tone === "bad"
          ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
          : "bg-slate-500/10 text-slate-200 border-slate-600/30";

  return (
    <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`rounded-lg border px-2 py-1 ${toneCls}`}>{value}</span>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-[#0B1420]/60 px-4 py-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

type StrategyKey = "MeanReversion" | "Momentum" | "Breakout";

export default function ExcutionPage() {
  const [isRunning, setIsRunning] = useState(false);

  const [strategy, setStrategy] = useState<StrategyKey>("Momentum");
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState("1m");

  const [risk, setRisk] = useState(0.8); // %
  const [leverage, setLeverage] = useState(3);
  const [maxPos, setMaxPos] = useState(2);
  const [dailyLossLimit, setDailyLossLimit] = useState(2.5); // %

  const modelName = "LSTM-v0.3";
  const exchange = "Binance";

  const statusTone = isRunning ? "good" : "warn";

  const signals = useMemo(
    () => [
      {
        t: "12:31:04",
        s: "BTCUSDT",
        side: "LONG",
        conf: 0.72,
        note: "Momentum > threshold",
      },
      {
        t: "12:29:12",
        s: "ETHUSDT",
        side: "FLAT",
        conf: 0.55,
        note: "No edge",
      },
      {
        t: "12:26:50",
        s: "BTCUSDT",
        side: "SHORT",
        conf: 0.68,
        note: "Reversal detected",
      },
    ],
    [],
  );

  const logs = useMemo(
    () => [
      "Connected to exchange ✅",
      "Loaded model weights: LSTM-v0.3",
      "Streaming candles: 1m",
      "Risk guard: daily loss limit enabled",
      isRunning ? "Auto-trading loop started..." : "Auto-trading is idle",
    ],
    [isRunning],
  );

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Excution</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill
            label="Status"
            value={isRunning ? "RUNNING" : "PAUSED"}
            tone={statusTone}
          />
          <Pill label="Model" value={modelName} />
          <Pill label="Exchange" value={exchange} />
          <Pill
            label="Risk"
            value={`${risk.toFixed(1)}% / trade`}
            tone="neutral"
          />
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Controls */}
        <Card title="Strategy & Controls" className="lg:col-span-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strategy */}
            <div className="space-y-3">
              <label className="text-xs text-slate-400">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as StrategyKey)}
                className="w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
              >
                <option value="Momentum">Momentum</option>
                <option value="MeanReversion">Mean Reversion</option>
                <option value="Breakout">Breakout</option>
              </select>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Symbol</label>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="mt-2 w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                    placeholder="BTCUSDT"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="mt-2 w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                  >
                    <option value="1m">1m</option>
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-[#0B1420]/50 p-4 text-xs text-slate-300">
                <div className="text-slate-400 mb-2">
                  Active Rules (preview)
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    Signal threshold:{" "}
                    {strategy === "Momentum" ? "0.65" : "0.70"}
                  </li>
                  <li>Cooldown: 90s</li>
                  <li>Slippage guard: enabled</li>
                </ul>
              </div>
            </div>

            {/* Risk */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Risk / Trade (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={risk}
                    onChange={(e) => setRisk(Number(e.target.value))}
                    className="mt-2 w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Leverage</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={leverage}
                    onChange={(e) => setLeverage(Number(e.target.value))}
                    className="mt-2 w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Max Positions
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxPos}
                    onChange={(e) => setMaxPos(Number(e.target.value))}
                    className="mt-2 w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">
                    Daily Loss Limit (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={dailyLossLimit}
                    onChange={(e) => setDailyLossLimit(Number(e.target.value))}
                    className="mt-2 w-full h-11 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/70 bg-[#0B1420]/50 p-4 text-xs text-slate-300">
                <div className="text-slate-400 mb-2">Guards</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-lg border border-slate-700/60 bg-slate-900/30">
                    Stop-loss: enabled
                  </span>
                  <span className="px-2 py-1 rounded-lg border border-slate-700/60 bg-slate-900/30">
                    Max drawdown: 8%
                  </span>
                  <span className="px-2 py-1 rounded-lg border border-slate-700/60 bg-slate-900/30">
                    Kill-switch: manual
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setIsRunning(true)}
                  disabled={isRunning}
                  className={`h-11 flex-1 rounded-xl border transition text-sm font-semibold
                    ${
                      isRunning
                        ? "border-slate-800/70 bg-slate-900/30 text-slate-500 cursor-not-allowed"
                        : "border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                    }`}
                >
                  Run
                </button>
                <button
                  onClick={() => setIsRunning(false)}
                  disabled={!isRunning}
                  className={`h-11 flex-1 rounded-xl border transition text-sm font-semibold
                    ${
                      !isRunning
                        ? "border-slate-800/70 bg-slate-900/30 text-slate-500 cursor-not-allowed"
                        : "border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/20"
                    }`}
                >
                  Stop
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Right: Status */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title="Account Snapshot"
            right={
              <span className="text-xs text-slate-400">
                Updated <span className="text-slate-200">now</span>
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <SmallStat label="Equity" value="$12,480" />
              <SmallStat label="Available" value="$8,210" />
              <SmallStat label="Unrealized PnL" value="+$142" />
              <SmallStat
                label="Open Positions"
                value={`${isRunning ? "1" : "0"}/${maxPos}`}
              />
            </div>
          </Card>

          <Card title="AI Signals (latest)">
            <div className="space-y-3">
              {signals.map((x, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800/70 bg-[#0B1420]/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{x.s}</div>
                    <div className="text-xs text-slate-400">{x.t}</div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <span
                      className={`px-2 py-1 rounded-lg border ${
                        x.side === "LONG"
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                          : x.side === "SHORT"
                            ? "border-rose-500/30 bg-rose-500/15 text-rose-200"
                            : "border-slate-600/40 bg-slate-700/10 text-slate-200"
                      }`}
                    >
                      {x.side}
                    </span>
                    <span className="text-slate-400">confidence</span>
                    <span className="text-slate-200">
                      {Math.round(x.conf * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{x.note}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="System Log">
            <div className="h-44 overflow-auto rounded-xl border border-slate-800/70 bg-[#0B1420]/60 p-3 text-xs text-slate-300">
              <ul className="space-y-2">
                {logs.map((line, idx) => (
                  <li key={idx} className="whitespace-pre-wrap">
                    <span className="text-slate-500">• </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Today PnL">
          <div className="text-3xl font-semibold text-slate-100">+$212</div>
          <div className="mt-2 text-sm text-slate-400">vs yesterday +$98</div>
        </Card>
        <Card title="Win Rate">
          <div className="text-3xl font-semibold text-slate-100">54%</div>
          <div className="mt-2 text-sm text-slate-400">last 30 trades</div>
        </Card>
        <Card title="Avg. Holding">
          <div className="text-3xl font-semibold text-slate-100">18m</div>
          <div className="mt-2 text-sm text-slate-400">median duration</div>
        </Card>
        <Card title="Max Drawdown">
          <div className="text-3xl font-semibold text-slate-100">-3.1%</div>
          <div className="mt-2 text-sm text-slate-400">rolling 7d</div>
        </Card>
      </div>
    </div>
  );
}
