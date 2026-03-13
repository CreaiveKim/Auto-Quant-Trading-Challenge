import type { ExchangeType } from "./types";
import { normalizeSymbol } from "./symbol";

export async function getExchangePrice(
  exchange: ExchangeType,
  inputSymbol: string,
): Promise<number> {
  const symbol = normalizeSymbol(inputSymbol, exchange);

  if (exchange === "binance") {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { cache: "no-store" },
    );

    if (!res.ok) {
      throw new Error("Binance 현재가 조회 실패");
    }

    const data = await res.json();
    return Number(data.price);
  }

  // Upbit
  // 업비트는 market 단위 조회
  const res = await fetch(`https://api.upbit.com/v1/ticker?markets=${symbol}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Upbit 현재가 조회 실패");
  }

  const data = await res.json();

  if (!Array.isArray(data) || !data[0]?.trade_price) {
    throw new Error("Upbit 현재가 데이터 이상");
  }

  return Number(data[0].trade_price);
}
