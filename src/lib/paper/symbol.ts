import type { ExchangeType } from "./types";

export function normalizeSymbol(input: string, exchange: ExchangeType) {
  const raw = input.trim().toUpperCase();

  if (exchange === "binance") {
    return raw.replace("-", "");
  }

  // upbit
  if (raw.includes("-")) return raw;
  if (raw.endsWith("USDT")) {
    const base = raw.replace("USDT", "");
    return `KRW-${base}`;
  }
  if (raw.startsWith("KRW-")) return raw;
  return `KRW-${raw}`;
}
