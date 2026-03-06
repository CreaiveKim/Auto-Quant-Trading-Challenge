"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type Exchange = "binance" | "upbit";

type ExchangeCtx = {
  exchange: Exchange;
  setExchange: (v: Exchange) => void;
  toggleExchange: () => void;
};

const ExchangeContext = createContext<ExchangeCtx | null>(null);

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const [exchange, setExchange] = useState<Exchange>("binance"); // ✅ default

  const value = useMemo(
    () => ({
      exchange,
      setExchange,
      toggleExchange: () =>
        setExchange((prev) => (prev === "binance" ? "upbit" : "binance")),
    }),
    [exchange],
  );

  return (
    <ExchangeContext.Provider value={value}>
      {children}
    </ExchangeContext.Provider>
  );
}

export function useExchange() {
  const ctx = useContext(ExchangeContext);
  if (!ctx) throw new Error("useExchange must be used within ExchangeProvider");
  return ctx;
}
