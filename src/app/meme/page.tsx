// src/app/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

const ICON = {
  logo: "/images/logo1.png",
  search: "/icons/icon9.png",
  edit: "/icons/icon6.png",
  settings: "/icons/icon7.png",
  bell: "/icons/icon8.png",
  // sidebar icons
  dashboard: "/icons/icon1.png",
  markets: "/icons/icon2.png",
  live: "/icons/icon3.png",
  signals: "/icons/icon4.png",
  support: "/icons/icon5.png",
  // mobile bottom icons
  home: "/icons/icon13.png",
} as const;

type SideItem = {
  key: string;
  label: string;
  icon: string;
};

const SIDE_ITEMS: SideItem[] = [
  { key: "dashboard", label: "Dashboard", icon: ICON.dashboard },
  { key: "markets", label: "Markets", icon: ICON.markets },
  { key: "live", label: "Live Trading", icon: ICON.live },
  { key: "signals", label: "Signals", icon: ICON.signals },
  { key: "support", label: "Support", icon: ICON.support },
];

const MOBILE_ITEMS: SideItem[] = [
  { key: "home", label: "Home", icon: ICON.home },
  { key: "dashboard", label: "Dashboard", icon: ICON.dashboard },
  { key: "live", label: "Live Trading", icon: ICON.live },
  { key: "signals", label: "Signals", icon: ICON.signals },
  { key: "settings", label: "Settings", icon: ICON.settings },
];

function IconButton({
  iconSrc,
  alt,
  className = "",
}: {
  iconSrc: string;
  alt: string;
  className?: string;
}) {
  return (
    <button
      className={`h-9 w-9 cursor-pointer rounded-lg border border-slate-700/70 bg-slate-900/40 hover:bg-slate-900/70 active:scale-[0.98] transition flex items-center justify-center ${className}`}
      type="button"
    >
      <Image src={iconSrc} alt={alt} width={18} height={18} />
    </button>
  );
}

function SidebarDesktop() {
  return (
    <aside className="h-screen w-56 shrink-0 border-r border-slate-800/70 bg-[#0C1624]">
      {/* Logo area */}
      <div className="h-18 px-4 flex items-center gap-3 border-b border-slate-800/70">
        <button type="button" className="flex items-center cursor-pointer">
          {/* ✅ height=0 제거 (Next/Image 권장 형태로) */}
          <Image src={ICON.logo} alt="2KQuant" width={180} height={40} />
        </button>
      </div>

      {/* Menu */}
      <nav className="p-3 space-y-2">
        {SIDE_ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            className="w-full cursor-pointer flex items-center gap-3 rounded-xl px-3 py-3 text-left border border-transparent hover:border-slate-700/50 hover:bg-slate-900/30 transition"
          >
            <Image src={it.icon} alt={it.label} width={22} height={22} />
            <span className="text-slate-200/90">{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function BottomNavMobile() {
  // ✅ window 직접 접근 제거 -> hydration mismatch 방지
  const pathname = usePathname();

  const isActive = (key: string) => {
    if (key === "home") return pathname === "/";
    return pathname.includes(key);
  };

  return (
    <div
      className="fixed bottom-4 left-0 right-0 z-50 md:hidden px-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="
          mx-auto w-full max-w-md
          rounded-[28px]
          border-2 border-slate-700/70
          bg-[#0B1420]/95
          backdrop-blur-xl
          shadow-[0_14px_48px_rgba(0,0,0,0.55)]
        "
      >
        <div className="p-2">
          <div className="grid grid-cols-5 gap-1">
            {MOBILE_ITEMS.map((it) => {
              const active = isActive(it.key);

              return (
                <button
                  key={it.key}
                  type="button"
                  className="relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 cursor-pointer transition hover:bg-slate-900/40"
                >
                  {active && (
                    <span className="pointer-events-none absolute top-2 h-12 w-12 rounded-full bg-slate-200/25 blur-lg" />
                  )}

                  <span className="relative z-10">
                    <Image
                      src={it.icon}
                      alt={it.label}
                      width={32}
                      height={32}
                    />
                  </span>

                  <span
                    className={`relative z-10 text-[11px] ${
                      active ? "text-white" : "text-slate-300"
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

function Card({
  title,
  children,
  rightDots = false,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  rightDots?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 overflow-hidden ${className}`}
    >
      <div className="h-11 px-4 flex items-center justify-between border-b border-slate-800/70">
        <div className="text-slate-300/90 font-medium">{title}</div>
        {rightDots && (
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300/40" />
          </div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  valueClass = "text-slate-100",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-[#0F1A2A]/80 overflow-hidden">
      <div className="h-11 px-4 flex items-center border-b border-slate-800/70">
        <div className="text-slate-400 text-sm">{label}</div>
      </div>
      <div className="p-4 flex items-center justify-between">
        <div className={`text-2xl font-semibold ${valueClass}`}>{value}</div>
        <div className="h-7 w-16 rounded-md bg-slate-900/40 border border-slate-700/40 flex items-center justify-center text-[10px] text-slate-500">
          mini
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-[#0B1420] text-white">
      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block">
          <SidebarDesktop />
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <header className="w-full h-18 border-b border-slate-800/70 bg-[#0B1420]">
            <div className="w-full h-full px-4 md:px-6 flex items-center gap-3">
              {/* Mobile logo */}
              <button
                className="md:hidden cursor-pointer flex items-center"
                type="button"
              >
                <Image src={ICON.logo} alt="2KQuant" width={110} height={26} />
              </button>

              {/* Search */}
              <div className="flex-1 w-full md:max-w-none">
                <div className="h-10 w-full rounded-xl border border-slate-800/70 bg-[#101C2E] flex items-center px-3 gap-2">
                  <Image
                    src={ICON.search}
                    alt="search"
                    width={18}
                    height={22}
                  />
                  <input
                    className="bg-transparent outline-none w-full text-xs md:text-sm placeholder:text-slate-500"
                    placeholder="Search for asset..."
                  />
                </div>
              </div>

              {/* Desktop states */}
              <div className="hidden lg:flex items-center gap-6 text-xs text-slate-300/80 mx-4">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-slate-400">Data:</span>
                  <span className="text-green-400">Live</span>
                </span>

                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Model:</span>
                  <span>Predicting</span>
                </span>

                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Exchange:</span>
                  <span>Binance</span>
                </span>
              </div>

              {/* 🔐 Right area */}
              <div className="flex items-center gap-2">
                {false ? (
                  <>
                    <IconButton iconSrc={ICON.bell} alt="notifications" />
                    <button
                      type="button"
                      className="h-9 px-4 rounded-xl border border-slate-700/70 bg-slate-900/35 text-slate-100 hover:bg-slate-900/60 active:scale-[0.98] transition text-sm font-medium cursor-pointer"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="h-9 px-4 rounded-xl border border-slate-700/70 bg-slate-900/35 text-slate-100 hover:bg-slate-900/60 active:scale-[0.98] transition text-sm font-medium cursor-pointer"
                    >
                      Sign in
                    </button>

                    <button
                      type="button"
                      className="h-9 px-4 rounded-xl border border-sky-400/30 bg-sky-500/15 text-sky-200 hover:bg-sky-500/25 hover:border-sky-400/45 active:scale-[0.98] transition cursor-pointer text-sm font-semibold shadow-[0_10px_30px_rgba(0,140,255,0.10)]"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Mobile states row */}
            <div className="lg:hidden px-4 md:px-6 pb-3 pt-2">
              <div className="flex items-center gap-4 text-xs text-slate-300/80">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  <span className="text-slate-400">Data:</span>
                  <span className="text-green-400">Live</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Model:</span>
                  <span>Predicting</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">Exchange:</span>
                  <span>Binance</span>
                </span>
              </div>
            </div>
          </header>

          {/* Body */}
          <div className="px-4 lg:mt-0 md:px-6 py-5 md:py-5 mt-4 pb-[calc(120px+env(safe-area-inset-bottom))] md:pb-0">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                label="Today's PnL"
                value="+ 4.4%"
                valueClass="text-green-400"
              />
              <KpiCard
                label="Total ROI"
                value="+ 52.3%"
                valueClass="text-slate-100"
              />
              <KpiCard
                label="Max Drawdown"
                value="- 5.18%"
                valueClass="text-red-400"
              />
              <KpiCard
                label="Win Rate"
                value="69%"
                valueClass="text-slate-100"
              />
            </div>

            <div className="mt-3 grid grid-cols-1 xl:grid-cols-12 gap-4">
              <Card title="Equity Curve" className="xl:col-span-8">
                <div className="h-56 md:h-72 rounded-lg border border-slate-800/70 bg-[#0B1420]/60 flex items-center justify-center text-slate-500">
                  Chart Placeholder (나중에 차트 컴포넌트)
                </div>
              </Card>

              <Card title="AI Predictions" rightDots className="xl:col-span-4">
                <div className="space-y-3">
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                </div>
              </Card>

              <Card title="Recent Trades" className="xl:col-span-8">
                <div className="h-44 md:h-56 rounded-lg border border-slate-800/70 bg-[#0B1420]/60 flex items-center justify-center text-slate-500">
                  List Placeholder (최근 체결 내역)
                </div>
              </Card>

              <Card title="Alert Activity" rightDots className="xl:col-span-4">
                <div className="space-y-3">
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                  <div className="h-12 rounded-lg bg-slate-900/30 border border-slate-800/70" />
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNavMobile />
    </div>
  );
}
