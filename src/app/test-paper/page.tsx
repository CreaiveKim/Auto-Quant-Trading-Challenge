"use client";

import { useMemo, useState } from "react";

type PositionItem = {
  symbol: string;
  quantity: number;
  avgPrice: number;
};

type HistoryItem = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  fee: number;
  realizedPnl: number;
  strategy?: string;
  timestamp: number;
};

type PortfolioResponse = {
  account: {
    accountId: string;
    name: string;
    cash: number;
    initialCash: number;
    createdAt?: number;
    updatedAt?: number;
  };
  positions: Record<string, PositionItem>;
  histories: HistoryItem[];
};

function formatNumber(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits,
  }).format(value);
}

function formatDate(value: number) {
  return new Date(value).toLocaleString("ko-KR");
}

export default function TestPaperPage() {
  const [accountId, setAccountId] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [buyCash, setBuyCash] = useState(100000);
  const [sellQty, setSellQty] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const positions = useMemo(() => {
    if (!portfolio) return [];
    return Object.values(portfolio.positions);
  }, [portfolio]);

  const handleCreateAccount = async () => {
    try {
      setIsLoading(true);
      setMessage("");

      const res = await fetch("/api/paper-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "demo-account", initialCash: 1000000 }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message ?? "계좌 생성 실패");
        return;
      }

      setPortfolio(data.portfolio);
      setAccountId(data.portfolio.account.accountId);
      setMessage(data.message ?? "가짜계좌 생성 완료");
    } catch {
      setMessage("계좌 생성 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuy = async () => {
    if (!accountId) {
      setMessage("먼저 가짜계좌를 생성해.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");

      const res = await fetch("/api/paper-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          symbol,
          side: "BUY",
          useCashAmount: Number(buyCash),
          strategy: "manual-test",
        }),
      });

      const data = await res.json();
      setMessage(data.message ?? "BUY 요청 완료");

      if (data.portfolio) {
        setPortfolio(data.portfolio);
      }
    } catch {
      setMessage("매수 처리 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSell = async () => {
    if (!accountId) {
      setMessage("먼저 가짜계좌를 생성해.");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("");

      const res = await fetch("/api/paper-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          symbol,
          side: "SELL",
          quantity: sellQty === "" ? undefined : Number(sellQty),
          strategy: "manual-test",
        }),
      });

      const data = await res.json();
      setMessage(data.message ?? "SELL 요청 완료");

      if (data.portfolio) {
        setPortfolio(data.portfolio);
      }
    } catch {
      setMessage("매도 처리 중 오류 발생");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0F1A] px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Paper Trading Test</h1>
          <p className="text-sm text-slate-300">
            가짜계좌 생성, 모의 매수/매도, 잔고 확인, 거래 로그 확인용 페이지
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCreateAccount}
              disabled={isLoading}
              className="rounded-lg bg-white px-4 py-2 text-black disabled:opacity-50"
            >
              가짜계좌 생성
            </button>

            <div className="text-sm text-slate-300 break-all">
              accountId: {accountId || "-"}
            </div>
          </div>

          <div className="mt-3 text-sm text-green-400">{message}</div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-slate-400">현재 잔고</div>
            <div className="mt-2 text-2xl font-bold">
              {portfolio
                ? `${formatNumber(portfolio.account.cash, 2)} 원`
                : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-slate-400">초기 자금</div>
            <div className="mt-2 text-2xl font-bold">
              {portfolio
                ? `${formatNumber(portfolio.account.initialCash, 2)} 원`
                : "-"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-sm text-slate-400">누적 거래 수</div>
            <div className="mt-2 text-2xl font-bold">
              {portfolio ? portfolio.histories.length : 0}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h2 className="text-lg font-semibold">주문 테스트</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-300">심볼</label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none"
                placeholder="BTCUSDT"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">
                매수 금액
              </label>
              <input
                type="number"
                value={buyCash}
                onChange={(e) => setBuyCash(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleBuy}
              disabled={!accountId || isLoading}
              className="rounded-lg bg-blue-500 px-4 py-2 font-medium disabled:opacity-50"
            >
              BUY
            </button>

            <div className="min-w-[220px] flex-1">
              <label className="mb-1 block text-sm text-slate-300">
                매도 수량 (비우면 전량)
              </label>
              <input
                type="number"
                value={sellQty}
                onChange={(e) =>
                  setSellQty(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 outline-none"
              />
            </div>

            <div className="self-end">
              <button
                onClick={handleSell}
                disabled={!accountId || isLoading}
                className="rounded-lg bg-red-500 px-4 py-2 font-medium disabled:opacity-50"
              >
                SELL
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-lg font-semibold">보유 포지션</h2>

          {positions.length === 0 ? (
            <div className="text-sm text-slate-400">현재 보유 포지션 없음</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-slate-400">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left">심볼</th>
                    <th className="px-3 py-2 text-right">수량</th>
                    <th className="px-3 py-2 text-right">평균단가</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.symbol} className="border-b border-white/5">
                      <td className="px-3 py-3">{pos.symbol}</td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(pos.quantity, 8)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(pos.avgPrice, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-lg font-semibold">거래 로그</h2>

          {!portfolio || portfolio.histories.length === 0 ? (
            <div className="text-sm text-slate-400">아직 거래 내역 없음</div>
          ) : (
            <div className="space-y-3">
              {[...portfolio.histories].reverse().map((history) => (
                <div
                  key={history.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-xs font-semibold",
                          history.side === "BUY"
                            ? "bg-blue-500/20 text-blue-300"
                            : "bg-red-500/20 text-red-300",
                        ].join(" ")}
                      >
                        {history.side}
                      </span>
                      <span className="font-semibold">{history.symbol}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDate(history.timestamp)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
                    <div>체결가: {formatNumber(history.price, 4)}</div>
                    <div>수량: {formatNumber(history.quantity, 8)}</div>
                    <div>수수료: {formatNumber(history.fee, 4)}</div>
                    <div>
                      실현손익:{" "}
                      <span
                        className={
                          history.realizedPnl > 0
                            ? "text-green-400"
                            : history.realizedPnl < 0
                              ? "text-red-400"
                              : "text-slate-200"
                        }
                      >
                        {formatNumber(history.realizedPnl, 4)}
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      전략: {history.strategy || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-lg font-semibold">원본 Portfolio JSON</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-300">
            {JSON.stringify(portfolio, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
