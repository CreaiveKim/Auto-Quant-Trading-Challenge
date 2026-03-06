"use client";

import React from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ExchangeProvider, useExchange } from "@/contexts/exchange-context";
import {
  FearGreedProvider,
  useFearGreed,
  getFearGreedColor,
  getFearGreedLabel,
} from "@/contexts/fear-greed-context";

const ICON = {
  logo: "/images/logo1.png",
  search: "/icons/icon9.png",
  settings: "/icons/icon7.png",
  bell: "/icons/icon8.png",
  dashboard: "/icons/icon1.png",
  excution: "/icons/icon2.png",
  weeklyReport: "/icons/icon17.png",
  home: "/icons/icon13.png",
} as const;

type SideItem = { key: string; label: string; icon: string };

const SIDE_ITEMS: SideItem[] = [
  { key: "home", label: "Home", icon: ICON.home },
  { key: "dashboard", label: "Dashboard", icon: ICON.dashboard },
  { key: "excution", label: "Excution", icon: ICON.excution },
  { key: "weeklyReport", label: "WeeklyReport", icon: ICON.weeklyReport },
  { key: "settings", label: "Settings", icon: ICON.settings },
];

const MOBILE_ITEMS: SideItem[] = [
  { key: "dashboard", label: "Dashboard", icon: ICON.dashboard },
  { key: "excution", label: "Excution", icon: ICON.excution },
  { key: "home", label: "Home", icon: ICON.home },
  { key: "weeklyReport", label: "WeeklyReport", icon: ICON.weeklyReport },
  { key: "settings", label: "Settings", icon: ICON.settings },
];

function SidebarDesktop() {
  const router = useRouter();
  const pathname = usePathname();

  const to = (key: string) => router.push(key === "home" ? "/home" : `/${key}`);

  const isActive = (key: string) =>
    key === "home" ? pathname === "/home" : pathname.startsWith(`/${key}`);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-56 flex-col border-r border-slate-800/70 bg-[#0C1624] z-50">
      <div className="h-16 px-4 flex items-center border-b border-slate-800/70">
        <button onClick={() => router.push("/home")} className="cursor-pointer">
          <Image src={ICON.logo} alt="logo" width={160} height={40} />
        </button>
      </div>

      <nav className="p-3 space-y-2 overflow-y-auto flex-1">
        {SIDE_ITEMS.map((it) => (
          <button
            key={it.key}
            onClick={() => to(it.key)}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 border transition cursor-pointer ${
              isActive(it.key)
                ? "border-slate-700/60 bg-slate-900/35"
                : "border-transparent hover:border-slate-700/50 hover:bg-slate-900/30"
            }`}
          >
            <Image src={it.icon} alt={it.label} width={22} height={22} />
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function BottomNavMobile() {
  const pathname = usePathname();
  const router = useRouter();

  const activeKey =
    pathname === "/home"
      ? "home"
      : (MOBILE_ITEMS.find((it) => pathname.startsWith(`/${it.key}`))?.key ??
        "home");

  return (
    <div
      className="fixed bottom-4 left-0 right-0 z-50 lg:hidden px-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto w-full max-w-md rounded-[28px] border-2 border-slate-700/70 bg-[#0B1420]/95 backdrop-blur-xl shadow-[0_14px_48px_rgba(0,0,0,0.55)]">
        <div className="p-2">
          <div className="grid grid-cols-5 gap-1">
            {MOBILE_ITEMS.map((it) => {
              const active = it.key === activeKey;

              return (
                <button
                  key={it.key}
                  onClick={() =>
                    router.push(it.key === "home" ? "/home" : `/${it.key}`)
                  }
                  className="flex flex-col items-center gap-1 py-2 cursor-pointer"
                >
                  <Image src={it.icon} alt={it.label} width={30} height={30} />
                  <span
                    className={`text-[11px] ${
                      active ? "text-white" : "text-slate-400"
                    }`}
                  >
                    {it.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExchangeToggle() {
  const { exchange, setExchange } = useExchange();

  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400 text-xs">Exchange:</span>

      <div className="flex items-center rounded-xl border border-slate-700/70 bg-[#101C2E] p-1">
        <button
          type="button"
          onClick={() => setExchange("binance")}
          className={[
            "px-3 py-1.5 text-xs rounded-lg transition cursor-pointer",
            exchange === "binance"
              ? "bg-white/15 text-white"
              : "text-slate-300/80 hover:bg-white/10",
          ].join(" ")}
        >
          Binance
        </button>

        <button
          type="button"
          onClick={() => setExchange("upbit")}
          className={[
            "px-3 py-1.5 text-xs rounded-lg transition cursor-pointer",
            exchange === "upbit"
              ? "bg-white/15 text-white"
              : "text-slate-300/80 hover:bg-white/10",
          ].join(" ")}
        >
          Upbit
        </button>
      </div>
    </div>
  );
}

function FearGreedIndicator() {
  const { exchange } = useExchange();
  const { binance, upbit, loading } = useFearGreed();

  const current = exchange === "binance" ? binance : upbit;

  if (loading) {
    return (
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
        <span className="text-slate-400">
          <span className="md:hidden">F&G:</span>
          <span className="hidden md:inline">Fear & Greed:</span>
        </span>
        <span className="text-slate-300">Loading...</span>
      </span>
    );
  }

  if (!current) {
    return (
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        <span className="text-slate-400">
          <span className="md:hidden">F&G:</span>
          <span className="hidden md:inline">Fear & Greed:</span>
        </span>
        <span className="text-slate-300">Unavailable</span>
      </span>
    );
  }

  const color = getFearGreedColor(current.value);
  const label = getFearGreedLabel(current.value);

  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color.dot}`} />
      <span className="text-slate-400">
        <span className="md:hidden">F&G:</span>
        <span className="hidden md:inline">Fear & Greed:</span>
      </span>

      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1 ${color.badge}`}
      >
        <span className="font-semibold">{current.value}</span>
        <span className="text-[11px] opacity-90">{label}</span>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <ExchangeProvider>
      <FearGreedProvider>
        <div className="min-h-screen bg-[#0B1420] text-white">
          {/* ✅ 데스크탑 fixed 사이드바 */}
          <SidebarDesktop />

          {/* ✅ 메인은 데스크탑에서 사이드바 폭(=w-56)만큼 밀기 */}
          <main className="flex-1 lg:pl-56">
            <header className="bg-[#0B1420] sticky top-0 z-50">
              <div className="h-16 flex items-center border-b border-slate-800/70 gap-2 px-6 py-2 ">
                <button
                  className="lg:hidden flex items-center cursor-pointer "
                  onClick={() => router.push("/home")}
                >
                  <Image src={ICON.logo} alt="logo" width={120} height={26} />
                </button>

                <div className="flex-1">
                  <div className="h-10 rounded-xl border border-slate-800/70 bg-[#101C2E] flex items-center px-3 gap-2">
                    <Image
                      src={ICON.search}
                      alt="search"
                      width={18}
                      height={18}
                      className="cursor-pointer"
                    />
                    <input
                      className="bg-transparent outline-none w-full text-xs placeholder:text-slate-500"
                      placeholder="Search for asset..."
                    />
                  </div>
                </div>

                <div className="hidden lg:flex items-center gap-6 text-xs text-slate-300/80 mx-4">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-slate-400">Data:</span>
                    <span className="text-green-400">Live</span>
                  </span>

                  <FearGreedIndicator />

                  <ExchangeToggle />
                </div>

                <button
                  onClick={() => {
                    const confirmed =
                      window.confirm("현재 로그인 세션을 종료할까요?");
                    if (confirmed) router.push("/");
                  }}
                  className="h-9 px-4 rounded-xl border border-slate-700/70 bg-slate-900/35 text-slate-100 hover:bg-slate-900/60 transition text-sm cursor-pointer"
                >
                  로그아웃
                </button>
              </div>

              <div className="lg:hidden px-6 pt-2 ">
                <div className="flex items-center gap-4 text-xs text-slate-300/80">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-slate-400">Data:</span>
                    <span className="text-green-400">Live</span>
                  </span>

                  <FearGreedIndicator />
                  <ExchangeToggle />
                </div>
              </div>
            </header>

            <div className="px-6 py-4 pb-28 lg:pb-4">{children}</div>
          </main>

          <BottomNavMobile />
        </div>
      </FearGreedProvider>
    </ExchangeProvider>
  );
}
