"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSupabasePage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [log, setLog] = useState("");

  const handleSignUp = async () => {
    setLog("회원가입 시도 중...");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLog(`회원가입 실패: ${error.message}`);
      return;
    }

    setLog(`회원가입 성공: ${data.user?.email ?? "no email"}`);
  };

  const handleSignIn = async () => {
    setLog("로그인 시도 중...");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLog(`로그인 실패: ${error.message}`);
      return;
    }

    setLog(`로그인 성공: ${data.user.email}`);
  };

  const handleCheckProfile = async () => {
    setLog("profiles 확인 중...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLog("현재 로그인된 유저 없음");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      setLog(`profiles 조회 실패: ${error.message}`);
      return;
    }

    setLog(`profiles 조회 성공: ${JSON.stringify(data, null, 2)}`);
  };

  const handleInsertExchangeAccount = async () => {
    setLog("exchange_accounts insert 시도 중...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLog("현재 로그인된 유저 없음");
      return;
    }

    const { error } = await supabase.from("exchange_accounts").insert({
      user_id: user.id,
      exchange: "binance",
      account_name: "내 바이낸스 테스트 계정",
      api_key: "test-api-key",
      api_secret: "test-secret",
      is_testnet: true,
      is_active: true,
    });

    if (error) {
      setLog(`exchange_accounts insert 실패: ${error.message}`);
      return;
    }

    setLog("exchange_accounts insert 성공");
  };

  const handleCheckExchangeAccounts = async () => {
    setLog("exchange_accounts 조회 중...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLog("현재 로그인된 유저 없음");
      return;
    }

    const { data, error } = await supabase
      .from("exchange_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setLog(`exchange_accounts 조회 실패: ${error.message}`);
      return;
    }

    setLog(`exchange_accounts 조회 성공: ${JSON.stringify(data, null, 2)}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setLog("로그아웃 완료");
  };

  return (
    <main className="min-h-screen bg-[#0b1020] p-6 text-white">
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Supabase 테스트</h1>

        <input
          className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none"
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSignUp}
            className="rounded-lg bg-blue-600 px-4 py-3 font-semibold"
          >
            회원가입
          </button>

          <button
            onClick={handleSignIn}
            className="rounded-lg bg-green-600 px-4 py-3 font-semibold"
          >
            로그인
          </button>

          <button
            onClick={handleCheckProfile}
            className="rounded-lg bg-purple-600 px-4 py-3 font-semibold"
          >
            profiles 확인
          </button>

          <button
            onClick={handleInsertExchangeAccount}
            className="rounded-lg bg-orange-600 px-4 py-3 font-semibold"
          >
            거래소 insert
          </button>

          <button
            onClick={handleCheckExchangeAccounts}
            className="rounded-lg bg-cyan-600 px-4 py-3 font-semibold"
          >
            거래소 조회
          </button>

          <button
            onClick={handleSignOut}
            className="rounded-lg bg-red-600 px-4 py-3 font-semibold"
          >
            로그아웃
          </button>
        </div>

        <pre className="whitespace-pre-wrap rounded-lg bg-black/30 p-4 text-sm text-gray-200">
          {log}
        </pre>
      </div>
    </main>
  );
}
