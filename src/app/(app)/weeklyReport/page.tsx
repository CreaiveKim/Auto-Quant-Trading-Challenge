"use client";

import React from "react";

type SummaryCard = {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
};

type StrategyRow = {
  name: string;
  trades: number;
  winRate: number;
  pnl: number;
};

type DailyPnl = {
  day: string;
  value: number;
};

type MarketItem = {
  label: string;
  value: string;
  sub: string;
  positive?: boolean;
};

type TradeStat = {
  label: string;
  value: string;
};

const summaryCards: SummaryCard[] = [
  {
    label: "Weekly Return",
    value: "+8.42%",
    change: "+2.11% vs last week",
    positive: true,
  },
  { label: "Win Rate", value: "61.2%", change: "+4.8%", positive: true },
  { label: "Profit Factor", value: "1.78", change: "+0.22", positive: true },
  { label: "Max Drawdown", value: "-4.10%", change: "-0.90%", positive: false },
];

const strategyRows: StrategyRow[] = [
  { name: "Momentum", trades: 18, winRate: 66, pnl: 4.3 },
  { name: "Mean Reversion", trades: 14, winRate: 57, pnl: 2.1 },
  { name: "Breakout", trades: 10, winRate: 70, pnl: 2.0 },
];

const dailyPnl: DailyPnl[] = [
  { day: "Mon", value: 1.2 },
  { day: "Tue", value: -0.6 },
  { day: "Wed", value: 2.4 },
  { day: "Thu", value: 1.7 },
  { day: "Fri", value: 3.72 },
];

const marketItems: MarketItem[] = [
  {
    label: "BTC Weekly",
    value: "+4.18%",
    sub: "vs previous close",
    positive: true,
  },
  {
    label: "ETH Weekly",
    value: "+6.84%",
    sub: "stronger than BTC",
    positive: true,
  },
  { label: "Fear & Greed", value: "72", sub: "Greed", positive: true },
  {
    label: "Volatility",
    value: "High",
    sub: "expansion phase",
    positive: false,
  },
];

const tradeStats: TradeStat[] = [
  { label: "Total Trades", value: "42" },
  { label: "Avg Profit Trade", value: "+2.30%" },
  { label: "Avg Loss Trade", value: "-1.10%" },
  { label: "Avg Holding Time", value: "3.2h" },
  { label: "Long / Short", value: "62% / 38%" },
  { label: "Best Trade", value: "+5.91%" },
];

const heatmapData = [
  { day: "Mon", value: "+1.2%" },
  { day: "Tue", value: "-0.6%" },
  { day: "Wed", value: "+2.4%" },
  { day: "Thu", value: "+1.7%" },
  { day: "Fri", value: "+3.7%" },
];

const equityValues = [10000, 10120, 10080, 10330, 10410, 10390, 10620, 10842];

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function getBarHeight(value: number, max: number) {
  return `${Math.max((Math.abs(value) / max) * 100, 8)}%`;
}

function getLinePoints(values: number[], width = 100, height = 100) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function WeeklyReportPage() {
  const maxDaily = Math.max(...dailyPnl.map((d) => Math.abs(d.value)));
  const totalPnl = strategyRows.reduce((acc, cur) => acc + cur.pnl, 0);
  const linePoints = getLinePoints(equityValues);

  return (
    <main className="min-h-screen w-full bg-[#0b1020] text-white">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6 xl:p-8">
        {/* Header */}
        <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-white/60">Weekly Report</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              Trading Performance & Market Insight
            </h1>
            <p className="mt-2 text-sm text-white/60">
              이번 주 자동매매 성과, 전략별 결과, 시장 흐름을 한눈에 확인하세요.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:min-w-[320px]">
            <div className="rounded-2xl border border-white/10 bg-[#10182d] p-4">
              <p className="text-xs text-white/50">Period</p>
              <p className="mt-2 text-sm font-semibold">
                2026.03.02 - 2026.03.06
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#10182d] p-4">
              <p className="text-xs text-white/50">Portfolio</p>
              <p className="mt-2 text-sm font-semibold">2K Quant Alpha</p>
            </div>
          </div>
        </section>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-3xl border border-white/10 bg-[#10182d] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            >
              <p className="text-sm text-white/55">{card.label}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <h2 className="text-3xl font-bold tracking-tight">
                  {card.value}
                </h2>
                {card.change && (
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      card.positive
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300",
                    )}
                  >
                    {card.change}
                  </span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Main Top */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          {/* Equity Curve */}
          <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/55">Equity Curve</p>
                <h3 className="mt-1 text-xl font-bold">
                  Account Growth This Week
                </h3>
              </div>
              <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-right">
                <p className="text-xs text-white/50">Current Balance</p>
                <p className="text-sm font-semibold text-emerald-300">
                  $10,842
                </p>
              </div>
            </div>

            <div className="h-[280px] rounded-2xl border border-white/5 bg-[#0d1426] p-4">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="h-full w-full"
              >
                <defs>
                  <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgba(16,185,129,0.45)" />
                    <stop offset="100%" stopColor="rgba(16,185,129,0)" />
                  </linearGradient>
                </defs>

                <polyline
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="0.4"
                  points="0,85 100,85"
                />
                <polyline
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.4"
                  points="0,60 100,60"
                />
                <polyline
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="0.4"
                  points="0,35 100,35"
                />

                <polygon
                  points={`0,100 ${linePoints} 100,100`}
                  fill="url(#equityFill)"
                />

                <polyline
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2.2"
                  points={linePoints}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Start</p>
                <p className="mt-1 text-sm font-semibold">$10,000</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Peak</p>
                <p className="mt-1 text-sm font-semibold">$10,842</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Net PnL</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">
                  +$842
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-xs text-white/50">Drawdown</p>
                <p className="mt-1 text-sm font-semibold text-rose-300">
                  -4.10%
                </p>
              </div>
            </div>
          </div>

          {/* Market Insight */}
          <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
            <div className="mb-5">
              <p className="text-sm text-white/55">Market Insight</p>
              <h3 className="mt-1 text-xl font-bold">Weekly Market Snapshot</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              {marketItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/8 bg-[#0d1426] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-white/60">{item.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        item.positive
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-orange-500/15 text-orange-300",
                      )}
                    >
                      {item.sub}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/8 bg-[#0d1426] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/60">Sentiment Gauge</p>
                <p className="text-sm font-semibold text-emerald-300">Greed</p>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[72%] rounded-full bg-emerald-400" />
              </div>
              <div className="mt-2 flex justify-between text-xs text-white/45">
                <span>Fear</span>
                <span>Neutral</span>
                <span>Greed</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Bottom */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          {/* Strategy Performance */}
          <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
            <div className="mb-5">
              <p className="text-sm text-white/55">Strategy Performance</p>
              <h3 className="mt-1 text-xl font-bold">Strategy-wise Result</h3>
            </div>

            <div className="space-y-4">
              {strategyRows.map((row) => {
                const width = `${(row.pnl / totalPnl) * 100}%`;

                return (
                  <div
                    key={row.name}
                    className="rounded-2xl border border-white/8 bg-[#0d1426] p-4"
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-base font-semibold">{row.name}</p>
                        <p className="text-xs text-white/50">
                          Trades {row.trades} · Win Rate {row.winRate}%
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-lg font-bold text-emerald-300">
                          +{row.pnl.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/8">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-white/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Strategy</th>
                    <th className="px-4 py-3 font-medium">Trades</th>
                    <th className="px-4 py-3 font-medium">WinRate</th>
                    <th className="px-4 py-3 font-medium">PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyRows.map((row) => (
                    <tr
                      key={row.name}
                      className="border-t border-white/8 bg-[#0d1426]"
                    >
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.trades}</td>
                      <td className="px-4 py-3">{row.winRate}%</td>
                      <td className="px-4 py-3 font-semibold text-emerald-300">
                        +{row.pnl.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily PnL + Trade Analytics */}
          <div className="flex flex-col gap-6">
            <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
              <div className="mb-5">
                <p className="text-sm text-white/55">Daily PnL</p>
                <h3 className="mt-1 text-xl font-bold">
                  This Week Performance by Day
                </h3>
              </div>

              <div className="flex h-[240px] items-end justify-between gap-3 rounded-2xl border border-white/8 bg-[#0d1426] p-4">
                {dailyPnl.map((item) => (
                  <div
                    key={item.day}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-3"
                  >
                    <div className="flex h-[170px] items-end">
                      <div
                        className={cn(
                          "w-full max-w-[46px] rounded-t-2xl",
                          item.value >= 0 ? "bg-emerald-400" : "bg-rose-400",
                        )}
                        style={{ height: getBarHeight(item.value, maxDaily) }}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-white/50">{item.day}</p>
                      <p
                        className={cn(
                          "mt-1 text-xs font-semibold",
                          item.value >= 0
                            ? "text-emerald-300"
                            : "text-rose-300",
                        )}
                      >
                        {item.value >= 0 ? "+" : ""}
                        {item.value}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
              <div className="mb-5">
                <p className="text-sm text-white/55">Trade Analytics</p>
                <h3 className="mt-1 text-xl font-bold">Execution Overview</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {tradeStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/8 bg-[#0d1426] p-4"
                  >
                    <p className="text-xs text-white/50">{item.label}</p>
                    <p className="mt-2 text-lg font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Row */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          {/* Heatmap */}
          <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
            <div className="mb-5">
              <p className="text-sm text-white/55">Weekly Heatmap</p>
              <h3 className="mt-1 text-xl font-bold">Profit Concentration</h3>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {heatmapData.map((item) => {
                const isPositive = item.value.startsWith("+");
                return (
                  <div
                    key={item.day}
                    className={cn(
                      "rounded-2xl p-4 text-center",
                      isPositive ? "bg-emerald-500/15" : "bg-rose-500/15",
                    )}
                  >
                    <p className="text-xs text-white/50">{item.day}</p>
                    <p
                      className={cn(
                        "mt-3 text-base font-bold",
                        isPositive ? "text-emerald-300" : "text-rose-300",
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insight */}
          <div className="rounded-3xl border border-white/10 bg-[#10182d] p-5">
            <div className="mb-5">
              <p className="text-sm text-white/55">AI Weekly Insight</p>
              <h3 className="mt-1 text-xl font-bold">
                Strategy Review & Next Action
              </h3>
            </div>

            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-5">
              <p className="text-sm leading-7 text-white/80">
                이번 주 시장은 전반적으로 상승 추세와 변동성 확장이 동시에
                나타난 구간이었습니다. 그 영향으로{" "}
                <span className="font-semibold text-white">Momentum 전략</span>
                이 가장 높은 성과를 기록했고, 짧은 추세 추종 진입이 유효하게
                작동했습니다.
              </p>

              <p className="mt-4 text-sm leading-7 text-white/80">
                반면 Mean Reversion 전략은 급격한 방향성 구간에서 일부 성능
                저하가 발생했으며, 횡보 구간에서는 안정적이었지만 강한 추세 전환
                구간에서는 대응력이 다소 낮았습니다.
              </p>

              <p className="mt-4 text-sm leading-7 text-white/80">
                다음 주에는{" "}
                <span className="font-semibold text-white">
                  변동성 필터 기반 진입 조건
                </span>
                을 조금 더 강화하고, 시장 강도가 유지될 경우 Breakout 비중을
                상향하는 방식이 유리합니다.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-white/50">Best Strategy</p>
                <p className="mt-2 text-sm font-semibold">Momentum</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-white/50">Risk Note</p>
                <p className="mt-2 text-sm font-semibold">
                  Volatility Expansion
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-white/50">Suggested Action</p>
                <p className="mt-2 text-sm font-semibold">Breakout Weight Up</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
