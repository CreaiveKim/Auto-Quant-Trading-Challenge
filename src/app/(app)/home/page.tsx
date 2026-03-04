"use client";

import React from "react";

function Card({
  title,
  children,
  className = "",
  right,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="h-11 px-4 flex items-center justify-between border-b border-slate-800/70">
        <div className="text-sm font-medium text-slate-100">{title}</div>
        {right}
      </div>

      {/* header(44px) 제외한 영역을 카드 컨텐츠가 꽉 쓰게 */}
      <div className="p-4 h-[calc(100%-44px)]">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const valueCls =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? "text-rose-300"
        : "text-slate-100";

  const chipCls =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "bad"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
        : "border-slate-700/60 bg-slate-800/20 text-slate-200";

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/80 overflow-hidden">
      <div className="h-11 px-4 flex items-center justify-between border-b border-slate-800/70">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`text-[11px] px-2 py-1 rounded-lg border ${chipCls}`}>
          24H
        </span>
      </div>
      <div className="p-4">
        <div className={`text-2xl font-semibold ${valueCls}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    /**
     * ✅ 스크롤 방지 풀스크린 분배
     * - lg 이상에서만 "뷰포트 - 헤더 - (wrapper padding)" 높이를 고정
     * - 아래 그리드 영역은 flex-1로 남은 공간을 정확히 씀
     *
     * 전제:
     * - AppLayout 헤더 높이를 h-16(64px)로 고정
     * - children wrapper는 py-4 (위아래 32px)
     */
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-64px-32px)] lg:overflow-hidden">
      {/* Top: Title + quick filters (고정) */}
      <div className="shrink-0 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Home</h1>
          <p className="text-sm text-slate-500">
            자동매매 현황 요약 & 신호 모니터링
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="h-10 px-3 rounded-xl border border-slate-800/70 bg-slate-900/25 hover:bg-slate-900/40 text-sm text-slate-200">
            BTCUSDT
          </button>
          <button className="h-10 px-3 rounded-xl border border-slate-800/70 bg-slate-900/25 hover:bg-slate-900/40 text-sm text-slate-200">
            1m
          </button>
          <button className="h-10 px-3 rounded-xl border border-slate-800/70 bg-slate-900/25 hover:bg-slate-900/40 text-sm text-slate-200">
            Strategy: Momentum
          </button>
        </div>
      </div>

      {/* KPI (고정) */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Today's PnL"
          value="+4.4%"
          sub="vs yesterday +1.2%"
          tone="good"
        />
        <KpiCard label="Total ROI" value="+52.3%" sub="All time" />
        <KpiCard
          label="Max Drawdown"
          value="-5.18%"
          sub="Rolling 30D"
          tone="bad"
        />
        <KpiCard label="Win Rate" value="69%" sub="Last 100 trades" />
      </div>

      {/* Main area (남은 높이 전부 사용) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left (8): 위/아래 반반 */}
        <div className="lg:col-span-8 min-h-0 flex flex-col gap-4">
          <Card
            title="Equity Curve"
            className="flex-1 min-h-0"
            right={
              <span className="text-xs text-slate-400">
                Updated <span className="text-slate-200">now</span>
              </span>
            }
          >
            <div className="h-full rounded-xl border border-slate-800/70 bg-[#0B1420]/35 flex items-center justify-center text-slate-500">
              Chart Placeholder
            </div>
          </Card>

          <Card
            title="Open Positions"
            className="flex-1 min-h-0"
            right={<span className="text-xs text-slate-500">Mock</span>}
          >
            <div className="h-full min-h-0 rounded-xl border border-slate-800/70 bg-[#0B1420]/35 overflow-hidden">
              <div className="grid grid-cols-12 bg-[#0B1420]/55 px-3 py-2 text-[11px] text-slate-500">
                <div className="col-span-3">Symbol</div>
                <div className="col-span-2">Side</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-2">Entry</div>
                <div className="col-span-3 text-right">PnL</div>
              </div>

              {[
                {
                  sym: "BTCUSDT",
                  side: "LONG",
                  size: "0.012",
                  entry: "62,140",
                  pnl: "+$42",
                },
                {
                  sym: "ETHUSDT",
                  side: "SHORT",
                  size: "0.18",
                  entry: "3,120",
                  pnl: "-$11",
                },
              ].map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 px-3 py-3 text-sm border-t border-slate-800/70"
                >
                  <div className="col-span-3 font-semibold text-slate-100">
                    {r.sym}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`text-[11px] px-2 py-1 rounded-lg border ${
                        r.side === "LONG"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-rose-500/30 bg-rose-500/10 text-rose-200"
                      }`}
                    >
                      {r.side}
                    </span>
                  </div>
                  <div className="col-span-2 text-slate-300">{r.size}</div>
                  <div className="col-span-2 text-slate-300">{r.entry}</div>
                  <div
                    className={`col-span-3 text-right font-semibold ${
                      r.pnl.startsWith("+")
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {r.pnl}
                  </div>
                </div>
              ))}

              <div className="px-3 py-3 border-t border-slate-800/70 bg-[#0B1420]/35">
                <button className="w-full h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-sm text-emerald-200 font-semibold">
                  Go to Excution
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right (4): 위/아래 반반 */}
        <div className="lg:col-span-4 min-h-0 flex flex-col gap-4">
          <Card
            title="AI Predictions"
            className="flex-1 min-h-0"
            right={
              <span className="text-xs px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                Live
              </span>
            }
          >
            <div className="h-full min-h-0 flex flex-col gap-3">
              {[
                {
                  sym: "BTCUSDT",
                  side: "LONG",
                  conf: "72%",
                  note: "Momentum ↑",
                },
                { sym: "ETHUSDT", side: "FLAT", conf: "55%", note: "No edge" },
                {
                  sym: "SOLUSDT",
                  side: "SHORT",
                  conf: "68%",
                  note: "Reversal",
                },
              ].map((x, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-800/70 bg-[#0B1420]/45 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-100">
                      {x.sym}
                    </div>
                    <div
                      className={`text-[11px] px-2 py-1 rounded-lg border ${
                        x.side === "LONG"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : x.side === "SHORT"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                            : "border-slate-700/60 bg-slate-800/20 text-slate-200"
                      }`}
                    >
                      {x.side}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{x.note}</span>
                    <span className="text-slate-300">
                      conf <span className="text-slate-100">{x.conf}</span>
                    </span>
                  </div>
                </div>
              ))}

              <button className="mt-auto w-full h-10 rounded-xl border border-slate-800/70 bg-slate-900/25 hover:bg-slate-900/40 text-sm text-slate-200">
                View all signals
              </button>
            </div>
          </Card>

          <Card title="Alerts / Logs" className="flex-1 min-h-0">
            {/* 스크롤을 만들지 말라는 요구라서 overflow-hidden.
                로그가 더 늘어나면 "페이지 스크롤" 대신
                여기만 내부 스크롤로 바꾸고 싶으면 overflow-auto로 바꾸면 됨. */}
            <div className="h-full min-h-0 rounded-xl border border-slate-800/70 bg-[#0B1420]/35 p-3 text-xs text-slate-300 overflow-hidden">
              <div className="space-y-2">
                <div className="text-slate-500">• Connected to Binance ✅</div>
                <div className="text-slate-500">• Model loaded: Predicting</div>
                <div className="text-slate-500">
                  • Guard enabled: daily loss limit
                </div>
                <div className="text-slate-500">
                  • Signal: BTCUSDT LONG (72%)
                </div>
                <div className="text-slate-500">• Order: MARKET BUY</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="h-10 rounded-xl border border-slate-800/70 bg-slate-900/25 hover:bg-slate-900/40 text-sm text-slate-200">
                  Clear
                </button>
                <button className="h-10 rounded-xl border border-slate-800/70 bg-slate-900/25 hover:bg-slate-900/40 text-sm text-slate-200">
                  Export
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
