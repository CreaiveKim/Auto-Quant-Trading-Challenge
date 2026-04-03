"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/auth/fetch-with-auth";

type ExchangeType = "upbit" | "binance";

type ExchangeAccount = {
  id: string;
  exchange: ExchangeType;
  label: string | null;
  memo: string | null;
  is_active: boolean;
  created_at: string;
};

type BalanceExchange = "upbit" | "binance";

type BalanceItem = {
  asset: string;
  free: string;
  locked: string;
};

async function parseJsonSafely(res: Response) {
  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("JSON parse error:", error, "raw response:", text);
    throw new Error("서버 응답이 JSON 형식이 아닙니다.");
  }
}

export default function SettingsPage() {
  const [exchange, setExchange] = useState<ExchangeType>("upbit");
  const [label, setLabel] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [memo, setMemo] = useState("");

  const [accounts, setAccounts] = useState<ExchangeAccount[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  const [selectedBalanceExchange, setSelectedBalanceExchange] =
    useState<BalanceExchange>("upbit");
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  async function loadExchangeAccounts() {
    try {
      setIsLoadingAccounts(true);

      const res = await fetchWithAuth("/api/exchange-accounts", {
        method: "GET",
        cache: "no-store",
      });

      const result = await parseJsonSafely(res);

      if (!res.ok) {
        throw new Error(result?.message || "거래소 계정 조회 실패");
      }

      setAccounts(result?.accounts ?? []);
    } catch (error: any) {
      console.error("loadExchangeAccounts error:", error);
      window.alert(error?.message || "거래소 계정 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  async function loadBalances(exchange: BalanceExchange) {
    try {
      setIsLoadingBalances(true);

      if (exchange === "binance") {
        setBalances([]);
        return;
      }

      const res = await fetchWithAuth("/api/upbit/balances", {
        method: "GET",
        cache: "no-store",
      });

      const result = await parseJsonSafely(res);

      if (!res.ok) {
        throw new Error(result?.message || "잔고 조회 실패");
      }

      setBalances(Array.isArray(result?.balances) ? result.balances : []);
    } catch (error: any) {
      console.error("loadBalances error:", error);
      setBalances([]);
      window.alert(error?.message || "잔고를 불러오지 못했습니다.");
    } finally {
      setIsLoadingBalances(false);
    }
  }

  async function handleSaveExchangeAccount(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (isSaving) return;

    const trimmedLabel = label.trim();
    const trimmedAccessKey = accessKey.trim();
    const trimmedSecretKey = secretKey.trim();
    const trimmedMemo = memo.trim();

    if (!trimmedAccessKey || !trimmedSecretKey) {
      window.alert("Access Key와 Secret Key를 모두 입력해 주세요.");
      return;
    }

    try {
      setIsSaving(true);

      const res = await fetchWithAuth("/api/exchange-accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exchange,
          label: trimmedLabel,
          accessKey: trimmedAccessKey,
          secretKey: trimmedSecretKey,
          memo: trimmedMemo,
        }),
      });

      const result = await parseJsonSafely(res);

      if (!res.ok) {
        throw new Error(result?.message || "거래소 계정 저장 실패");
      }

      window.alert("거래소 계정이 저장되었습니다.");

      setLabel("");
      setAccessKey("");
      setSecretKey("");
      setMemo("");
      setExchange("upbit");

      await loadExchangeAccounts();

      if (exchange === "upbit" || selectedBalanceExchange === "upbit") {
        await loadBalances("upbit");
      }
    } catch (error: any) {
      console.error("handleSaveExchangeAccount error:", error);
      window.alert(error?.message || "거래소 계정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    loadExchangeAccounts();
  }, []);

  useEffect(() => {
    loadBalances(selectedBalanceExchange);
  }, [selectedBalanceExchange]);

  return (
    <div className="min-h-screen bg-[#0B1420] px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold">설정</h1>

        <section className="rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/70 p-5 shadow-[0_14px_48px_rgba(0,0,0,0.35)]">
          <h2 className="mb-4 text-lg font-semibold">거래소 API 키 등록</h2>

          <form onSubmit={handleSaveExchangeAccount} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                거래소
              </label>
              <select
                value={exchange}
                onChange={(e) => setExchange(e.target.value as ExchangeType)}
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none"
                disabled={isSaving}
              >
                <option value="upbit">Upbit</option>
                <option value="binance">Binance</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                계정 별칭
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                type="text"
                placeholder="예: 메인 업비트 / 바이낸스 실거래"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Access Key
              </label>
              <input
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                type="text"
                placeholder="거래소 Access Key"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Secret Key
              </label>
              <input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                type="password"
                placeholder="거래소 Secret Key"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600"
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">메모</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 실거래 계정, 테스트 계정"
                className="min-h-[96px] w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 py-3 text-sm outline-none placeholder:text-slate-600"
                disabled={isSaving}
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/45 hover:bg-emerald-500/25 disabled:opacity-60"
            >
              {isSaving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200/40 border-t-transparent" />
              )}
              {isSaving ? "저장 중..." : "거래소 키 저장"}
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/70 p-5 shadow-[0_14px_48px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">등록된 거래소 계정</h2>

            <button
              type="button"
              onClick={loadExchangeAccounts}
              disabled={isLoadingAccounts}
              className="h-10 rounded-xl border border-sky-400/30 bg-sky-500/15 px-4 text-sm font-semibold text-sky-200 transition hover:border-sky-400/45 hover:bg-sky-500/25 disabled:opacity-60"
            >
              {isLoadingAccounts ? "불러오는 중..." : "새로고침"}
            </button>
          </div>

          {isLoadingAccounts ? (
            <div className="text-sm text-slate-400">
              계정 목록을 불러오는 중입니다...
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-sm text-slate-400">
              아직 등록된 거래소 계정이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="rounded-xl border border-slate-800/70 bg-[#101C2E] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {account.label?.trim()
                          ? account.label
                          : account.exchange.toUpperCase()}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        거래소: {account.exchange}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        상태: {account.is_active ? "활성" : "비활성"}
                      </div>
                      {account.memo ? (
                        <div className="mt-1 text-sm text-slate-400">
                          메모: {account.memo}
                        </div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-xs text-slate-500">
                      {new Date(account.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/70 p-5 shadow-[0_14px_48px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">거래소 잔고</h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedBalanceExchange("upbit")}
                className={`h-10 rounded-xl border px-4 text-sm font-semibold transition ${
                  selectedBalanceExchange === "upbit"
                    ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                    : "border-slate-700 bg-[#101C2E] text-slate-300"
                }`}
              >
                Upbit
              </button>

              <button
                type="button"
                onClick={() => setSelectedBalanceExchange("binance")}
                className={`h-10 rounded-xl border px-4 text-sm font-semibold transition ${
                  selectedBalanceExchange === "binance"
                    ? "border-amber-400/40 bg-amber-500/20 text-amber-200"
                    : "border-slate-700 bg-[#101C2E] text-slate-300"
                }`}
              >
                Binance
              </button>
            </div>
          </div>

          {selectedBalanceExchange === "binance" ? (
            <div className="rounded-xl border border-slate-800/70 bg-[#101C2E] p-4 text-sm text-slate-400">
              바이낸스 잔고 조회 UI만 먼저 연결해둠. 실제 API 연동은 나중에
              추가하면 된다.
            </div>
          ) : isLoadingBalances ? (
            <div className="text-sm text-slate-400">
              잔고를 불러오는 중입니다...
            </div>
          ) : balances.length === 0 ? (
            <div className="text-sm text-slate-400">
              표시할 업비트 잔고가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map((item, index) => (
                <div
                  key={`${item.asset ?? "unknown"}-${index}`}
                  className="rounded-xl border border-slate-800/70 bg-[#101C2E] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">
                        {item.asset}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        사용 가능: {item.free}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        잠금/주문 중: {item.locked}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
