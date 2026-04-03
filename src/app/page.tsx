"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function LandingPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"none" | "signin" | "signup">("none");
  const [isLoading, setIsLoading] = useState(false);

  // sign in
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // sign up
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPassword2, setSignUpPassword2] = useState("");
  const [agreedTos, setAgreedTos] = useState(false);

  const [emailCheckStatus, setEmailCheckStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");

  const year = useMemo(() => new Date().getFullYear(), []);

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkEmailFormatOnly = (emailRaw: string) => {
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      setEmailCheckStatus("idle");
      return { ok: false, reason: "empty" as const };
    }

    if (!isValidEmail(email)) {
      setEmailCheckStatus("invalid");
      return { ok: false, reason: "invalid" as const };
    }

    setEmailCheckStatus("available");
    return { ok: true, reason: "format_ok" as const };
  };

  const parseSupabaseError = (message?: string) => {
    const msg = (message || "").toLowerCase();

    if (
      msg.includes("invalid login credentials") ||
      msg.includes("email not confirmed")
    ) {
      if (msg.includes("email not confirmed")) {
        return "이메일 인증이 완료되지 않았습니다. 메일함에서 인증을 완료해 주세요.";
      }
      return "이메일 또는 비밀번호가 올바르지 않습니다.";
    }

    if (msg.includes("user already registered")) {
      return "이미 가입된 이메일입니다.";
    }

    if (msg.includes("password should be at least")) {
      return "비밀번호가 너무 짧습니다. 6자 이상으로 입력해 주세요.";
    }

    if (msg.includes("unable to validate email address")) {
      return "이메일 형식이 올바르지 않습니다.";
    }

    if (msg.includes("signup is disabled")) {
      return "현재 회원가입이 비활성화되어 있습니다. Supabase Auth 설정을 확인해 주세요.";
    }

    if (msg.includes("network")) {
      return "네트워크 요청에 실패했습니다. 인터넷 연결을 확인해 주세요.";
    }

    return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const email = signInEmail.trim().toLowerCase();
    const password = signInPassword.trim();

    if (!email || !password) {
      window.alert("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error(
          "로그인은 되었지만 access token을 가져오지 못했습니다.",
        );
      }

      // 로그인 직후 profiles 자동 생성/보정
      await fetch("/api/profile/bootstrap", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      window.alert("로그인되었습니다.");
      router.push("/home");
    } catch (err: any) {
      console.error("SUPABASE_SIGNIN_ERROR:", err?.message, err);
      window.alert(err?.message || "로그인에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const email = signUpEmail.trim().toLowerCase();
    const password = signUpPassword.trim();
    const password2 = signUpPassword2.trim();

    if (!email || !password || !password2) {
      window.alert("이메일, 비밀번호, 비밀번호 확인을 모두 입력해 주세요.");
      return;
    }

    const formatCheck = checkEmailFormatOnly(email);
    if (!formatCheck.ok) {
      window.alert("이메일 형식이 올바르지 않습니다.");
      return;
    }

    if (password !== password2) {
      window.alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    if (!agreedTos) {
      window.alert("이용약관에 동의하셔야 가입하실 수 있습니다.");
      return;
    }

    try {
      setIsLoading(true);
      setEmailCheckStatus("checking");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      setEmailCheckStatus("available");

      // 이메일 인증이 꺼져 있으면 세션이 있을 수 있음
      if (data.session?.access_token) {
        await fetch("/api/profile/bootstrap", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        });
      }

      if (!data.session) {
        window.alert(
          "회원가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.",
        );
      } else {
        window.alert("회원가입이 완료되었습니다. 이제 로그인해 주세요.");
      }

      setMode("signin");
      setSignInEmail(email);
      setSignInPassword("");
      setSignUpPassword("");
      setSignUpPassword2("");
      setAgreedTos(false);
    } catch (err: any) {
      console.error("SUPABASE_SIGNUP_ERROR:", err?.message, err);
      window.alert(err?.message || "회원가입에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1420] flex flex-col items-center justify-center text-white px-4">
      <div className="mb-8">
        <Image
          src="/images/logo1.png"
          alt="2K Quant"
          width={220}
          height={60}
          priority
        />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-slate-800/70 bg-[#0F1A2A]/70 p-5 shadow-[0_14px_48px_rgba(0,0,0,0.35)]">
        <div className="space-y-3">
          <button
            onClick={() => setMode((m) => (m === "signin" ? "none" : "signin"))}
            className="h-11 w-full cursor-pointer rounded-xl border border-sky-400/40 bg-sky-500/20 hover:bg-sky-500/30 hover:border-sky-400/60 transition text-sky-200 font-semibold"
            disabled={isLoading}
            type="button"
          >
            로그인
          </button>

          <button
            onClick={() => setMode((m) => (m === "signup" ? "none" : "signup"))}
            className="h-11 w-full cursor-pointer rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 hover:border-emerald-400/45 transition text-sm font-semibold disabled:opacity-60"
            disabled={isLoading}
            type="button"
          >
            회원가입
          </button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            mode === "signin"
              ? "max-h-[340px] opacity-100 mt-4"
              : "max-h-0 opacity-0"
          }`}
        >
          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                이메일
              </label>
              <input
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-600/80"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                비밀번호
              </label>
              <input
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-600/80"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-xl border border-sky-400/30 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25 hover:border-sky-400/45 transition text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {isLoading && (
                <span className="h-4 w-4 rounded-full border-2 border-slate-200/40 border-t-transparent animate-spin" />
              )}
              {isLoading ? "로그인 처리 중..." : "로그인 확인"}
            </button>
          </form>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ${
            mode === "signup"
              ? "max-h-[700px] opacity-100 mt-4"
              : "max-h-0 opacity-0"
          }`}
        >
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                이메일
              </label>

              <input
                value={signUpEmail}
                onChange={(e) => {
                  setSignUpEmail(e.target.value);
                  setEmailCheckStatus("idle");
                }}
                onBlur={() => checkEmailFormatOnly(signUpEmail)}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-600/80"
                disabled={isLoading}
              />

              <div className="mt-1 text-xs">
                {emailCheckStatus === "checking" && (
                  <span className="text-slate-400">가입 시도 중...</span>
                )}
                {emailCheckStatus === "available" && (
                  <span className="text-emerald-300">
                    이메일 형식이 정상입니다. 가입 시 가입 가능 여부가
                    확인됩니다.
                  </span>
                )}
                {emailCheckStatus === "taken" && (
                  <span className="text-rose-300">
                    이미 가입된 이메일입니다.
                  </span>
                )}
                {emailCheckStatus === "invalid" && (
                  <span className="text-amber-300">
                    이메일 형식이 올바르지 않습니다.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                비밀번호
              </label>
              <input
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-600/80"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                비밀번호 확인
              </label>
              <input
                value={signUpPassword2}
                onChange={(e) => setSignUpPassword2(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-slate-600/80"
                disabled={isLoading}
              />
            </div>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/70 bg-[#101C2E] px-3 py-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedTos}
                  onChange={(e) => setAgreedTos(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-400"
                  disabled={isLoading}
                />
                <span className="text-sm text-slate-200">
                  이용약관에 동의합니다
                  <span className="block text-xs text-slate-500 mt-1">
                    계정 생성을 위해 필수 동의 항목입니다.
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={() => router.push("/terms?from=signup")}
                className="text-xs cursor-pointer text-sky-200 hover:text-sky-100 underline underline-offset-4 shrink-0 disabled:opacity-60"
                disabled={isLoading}
              >
                이용약관 확인
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full cursor-pointer rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 hover:border-emerald-400/45 transition text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading && (
                <span className="h-4 w-4 rounded-full border-2 border-slate-200/40 border-t-transparent animate-spin" />
              )}
              {isLoading ? "가입 처리 중..." : "회원가입 확인"}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
        © {year} 2K Quant. AI-Driven Quantitative Trading Platform. All rights
        reserved.
      </p>
    </div>
  );
}
