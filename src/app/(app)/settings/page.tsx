"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ExchangeType = "binance" | "upbit";

type ExchangeAccountRow = {
  id: string;
  user_id: string;
  exchange: "binance" | "upbit";
  account_name: string | null;
  is_testnet: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  key_last4: string | null;
  secret_last4: string | null;
};

const getAccessToken = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
};

export default function SettingsPage() {
  const [userId, setUserId] = useState<string>("");
  const [loadingUser, setLoadingUser] = useState(true);

  const [exchange, setExchange] = useState<ExchangeType>("binance");
  const [accountName, setAccountName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isTestnet, setIsTestnet] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState("");

  const [accounts, setAccounts] = useState<ExchangeAccountRow[]>([]);

  const isBinance = useMemo(() => exchange === "binance", [exchange]);
  const isUpbit = useMemo(() => exchange === "upbit", [exchange]);

  useEffect(() => {
    const init = async () => {
      setLoadingUser(true);
      setMessage("");

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setMessage("로그인이 필요합니다.");
        setLoadingUser(false);
        return;
      }

      setUserId(user.id);
      setLoadingUser(false);
    };

    init();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchAccounts();
  }, [userId]);

  const resetForm = () => {
    setAccountName("");
    setApiKey("");
    setAccessKey("");
    setApiSecret("");
    setIsTestnet(true);
    setIsActive(true);
  };

  const fetchAccounts = async () => {
    setFetching(true);
    setMessage("");

    const token = await getAccessToken();

    if (!token) {
      setMessage("로그인이 필요합니다.");
      setFetching(false);
      return;
    }

    const res = await fetch("/api/exchange-accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.message || "계정 조회 실패");
      setFetching(false);
      return;
    }

    setAccounts(result.accounts ?? []);
    setFetching(false);
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      setMessage("계정 이름을 입력하세요.");
      return;
    }

    if (isBinance && !apiKey.trim()) {
      setMessage("바이낸스 API Key를 입력하세요.");
      return;
    }

    if (isUpbit && !accessKey.trim()) {
      setMessage("업비트 Access Key를 입력하세요.");
      return;
    }

    if (!apiSecret.trim()) {
      setMessage("Secret Key를 입력하세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const token = await getAccessToken();

    if (!token) {
      setMessage("로그인이 필요합니다.");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/exchange-accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        exchange,
        accountName,
        apiKey,
        accessKey,
        apiSecret,
        isTestnet,
        isActive,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.message || "저장 실패");
      setSaving(false);
      return;
    }

    setMessage("거래소 연동 정보 저장 완료");
    resetForm();
    await fetchAccounts();
    setSaving(false);
  };

  const handleToggleActive = async (id: string, nextValue: boolean) => {
    setMessage("");

    const token = await getAccessToken();

    if (!token) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    const res = await fetch("/api/exchange-accounts", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id,
        isActive: nextValue,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.message || "상태 변경 실패");
      return;
    }

    setMessage("연동 상태 변경 완료");
    await fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    setMessage("");

    const token = await getAccessToken();

    if (!token) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    const res = await fetch(`/api/exchange-accounts?id=${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage(result.message || "삭제 실패");
      return;
    }

    setMessage("연동 정보 삭제 완료");
    await fetchAccounts();
  };

  if (loadingUser) {
    return (
      <main className="min-h-screen bg-[#071120] p-6 text-white">
        <div className="mx-auto max-w-5xl">유저 확인 중...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#071120] p-4 text-white md:p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h1 className="text-2xl font-bold">거래소 연동</h1>
          <p className="mt-2 text-sm text-white/70">
            먼저 연동 정보를 저장하고, 다음 단계에서 서버를 통해 실제 잔고
            조회를 붙입니다.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm text-white/70">거래소</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExchange("binance")}
                  className={`rounded-xl px-4 py-3 font-semibold transition ${
                    isBinance
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-white/70"
                  }`}
                >
                  Binance
                </button>
                <button
                  type="button"
                  onClick={() => setExchange("upbit")}
                  className={`rounded-xl px-4 py-3 font-semibold transition ${
                    isUpbit
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-white/70"
                  }`}
                >
                  Upbit
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                계정 이름
              </label>
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="예: 내 바이낸스 본계정"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              />
            </div>

            {isBinance && (
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Binance API Key
                </label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="바이낸스 API Key"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                />
              </div>
            )}

            {isUpbit && (
              <div>
                <label className="mb-2 block text-sm text-white/70">
                  Upbit Access Key
                </label>
                <input
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  placeholder="업비트 Access Key"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Secret Key
              </label>
              <input
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Secret Key"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none"
              />
            </div>

            {isBinance && (
              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isTestnet}
                  onChange={(e) => setIsTestnet(e.target.checked)}
                />
                <span className="text-sm text-white/80">테스트넷 사용</span>
              </label>
            )}

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="text-sm text-white/80">활성 상태로 저장</span>
            </label>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold disabled:opacity-50"
            >
              {saving ? "저장 중..." : "연동 정보 저장"}
            </button>

            {message && (
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/85">
                {message}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">저장된 연동 계정</h2>
              <p className="mt-1 text-sm text-white/70">
                현재 로그인한 사용자 기준으로 조회됩니다.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchAccounts}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium"
            >
              {fetching ? "불러오는 중..." : "새로고침"}
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {accounts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/60">
                저장된 거래소 연동 정보가 없습니다.
              </div>
            ) : (
              accounts.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold uppercase text-blue-300">
                          {item.exchange}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            item.is_active
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {item.is_active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      <div className="text-lg font-semibold">
                        {item.account_name || "이름 없음"}
                      </div>

                      <div className="text-sm text-white/65">
                        생성일: {new Date(item.created_at).toLocaleString()}
                      </div>

                      <div className="text-sm text-white/65">
                        테스트넷: {item.is_testnet ? "ON" : "OFF"}
                      </div>

                      <div className="text-sm text-white/65">
                        Key 상태:{" "}
                        {item.key_last4
                          ? `저장됨 (끝 4자리: ${item.key_last4})`
                          : "없음"}
                      </div>

                      <div className="text-sm text-white/65">
                        Secret 상태:{" "}
                        {item.secret_last4
                          ? `저장됨 (끝 4자리: ${item.secret_last4})`
                          : "없음"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleActive(item.id, !item.is_active)
                        }
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black"
                      >
                        {item.is_active ? "비활성화" : "활성화"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
