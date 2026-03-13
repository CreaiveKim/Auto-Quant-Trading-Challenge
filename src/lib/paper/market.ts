//처음에는 가짜값 써도 되고, 나중에 바이낸스/업비트 연결해도 된다.
import { MarketPrice } from "./types";

export async function getMockPrice(symbol: string): Promise<MarketPrice> {
  const baseMap: Record<string, number> = {
    BTCUSDT: 85000,
    ETHUSDT: 2200,
    XRPUSDT: 0.62,
    SOLUSDT: 140,
  };

  const base = baseMap[symbol] ?? 100;
  const noise = 1 + (Math.random() - 0.5) * 0.02; // ±1%
  const price = Number((base * noise).toFixed(4));

  return {
    symbol,
    price,
    timestamp: Date.now(),
  };
}
