import { NextResponse } from "next/server";
import { paperStore } from "@/lib/paper/store";
import { getExchangePrice } from "@/lib/paper/exchange-price";
import { normalizeSymbol } from "@/lib/paper/symbol";
import type { HistoryItem } from "@/lib/paper/types";

const FEE_RATE = 0.0005;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const accountId = String(body.accountId ?? "");
    const side = body.side as "BUY" | "SELL";
    const rawSymbol = String(body.symbol ?? "");
    const useCashAmount = body.useCashAmount
      ? Number(body.useCashAmount)
      : undefined;
    const quantity =
      body.quantity === undefined ? undefined : Number(body.quantity);
    const strategy = body.strategy ? String(body.strategy) : undefined;

    const portfolio = paperStore[accountId];

    if (!portfolio) {
      return NextResponse.json(
        { message: "계좌를 찾을 수 없음" },
        { status: 404 },
      );
    }

    const exchange = portfolio.account.exchange;
    const symbol = normalizeSymbol(rawSymbol, exchange);
    const price = await getExchangePrice(exchange, symbol);

    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { message: "현재가 조회 실패" },
        { status: 400 },
      );
    }

    if (side === "BUY") {
      if (!useCashAmount || useCashAmount <= 0) {
        return NextResponse.json(
          { message: "매수 금액이 올바르지 않음" },
          { status: 400 },
        );
      }

      const fee = useCashAmount * FEE_RATE;
      const totalNeeded = useCashAmount + fee;

      if (portfolio.account.cash < totalNeeded) {
        return NextResponse.json({ message: "잔고 부족" }, { status: 400 });
      }

      const buyQty = useCashAmount / price;
      const prev = portfolio.positions[symbol];

      if (!prev) {
        portfolio.positions[symbol] = {
          symbol,
          quantity: buyQty,
          avgPrice: price,
          exchange,
        };
      } else {
        const totalCost = prev.avgPrice * prev.quantity + price * buyQty;
        const nextQty = prev.quantity + buyQty;

        portfolio.positions[symbol] = {
          ...prev,
          quantity: nextQty,
          avgPrice: totalCost / nextQty,
        };
      }

      portfolio.account.cash -= totalNeeded;
      portfolio.account.updatedAt = Date.now();

      const history: HistoryItem = {
        id: crypto.randomUUID(),
        exchange,
        symbol,
        side: "BUY",
        price,
        quantity: buyQty,
        fee,
        realizedPnl: 0,
        strategy,
        timestamp: Date.now(),
      };

      portfolio.histories.push(history);

      return NextResponse.json({
        message: `${symbol} BUY 완료`,
        portfolio,
      });
    }

    if (side === "SELL") {
      const position = portfolio.positions[symbol];

      if (!position || position.quantity <= 0) {
        return NextResponse.json(
          { message: "보유 포지션 없음" },
          { status: 400 },
        );
      }

      const sellQty =
        quantity === undefined || quantity === null
          ? position.quantity
          : quantity;

      if (sellQty <= 0 || sellQty > position.quantity) {
        return NextResponse.json(
          { message: "매도 수량이 올바르지 않음" },
          { status: 400 },
        );
      }

      const gross = sellQty * price;
      const fee = gross * FEE_RATE;
      const realizedPnl = (price - position.avgPrice) * sellQty - fee;

      portfolio.account.cash += gross - fee;
      portfolio.account.updatedAt = Date.now();

      const remainQty = position.quantity - sellQty;

      if (remainQty <= 0) {
        delete portfolio.positions[symbol];
      } else {
        portfolio.positions[symbol] = {
          ...position,
          quantity: remainQty,
        };
      }

      const history: HistoryItem = {
        id: crypto.randomUUID(),
        exchange,
        symbol,
        side: "SELL",
        price,
        quantity: sellQty,
        fee,
        realizedPnl,
        strategy,
        timestamp: Date.now(),
      };

      portfolio.histories.push(history);

      return NextResponse.json({
        message: `${symbol} SELL 완료`,
        portfolio,
      });
    }

    return NextResponse.json(
      { message: "지원하지 않는 주문 타입" },
      { status: 400 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "paper trade 처리 실패" },
      { status: 500 },
    );
  }
}
