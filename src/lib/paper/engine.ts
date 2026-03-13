// 실제로 가짜계좌에서 매수/매도, 평균단가, 수수료, 실현손익 처리하는 부분.

import {
  ExecutePaperOrderInput,
  ExecutePaperOrderResult,
  PaperAccount,
  PaperPortfolio,
  Position,
  Side,
  TradeHistory,
} from "./types";

const FEE_RATE = 0.0005; // 0.05%
const SLIPPAGE_RATE = 0.0003; // 0.03%

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getExecutedPrice(price: number, side: Side) {
  return side === "BUY"
    ? price * (1 + SLIPPAGE_RATE)
    : price * (1 - SLIPPAGE_RATE);
}

export function createPaperPortfolio(input: {
  name: string;
  initialCash: number;
}): PaperPortfolio {
  const now = Date.now();

  const account: PaperAccount = {
    accountId: createId(),
    name: input.name,
    cash: input.initialCash,
    initialCash: input.initialCash,
    createdAt: now,
    updatedAt: now,
  };

  return {
    account,
    positions: {},
    histories: [],
  };
}

export function executePaperOrder(params: {
  portfolio: PaperPortfolio;
  order: ExecutePaperOrderInput;
  marketPrice: number;
}): ExecutePaperOrderResult {
  const { portfolio, order, marketPrice } = params;
  const now = Date.now();

  const next: PaperPortfolio = {
    account: { ...portfolio.account },
    positions: { ...portfolio.positions },
    histories: [...portfolio.histories],
  };

  const executedPrice = getExecutedPrice(marketPrice, order.side);
  const currentPosition = next.positions[order.symbol];

  if (order.side === "BUY") {
    const useCash = order.useCashAmount ?? 100000;

    if (useCash <= 0) {
      return {
        success: false,
        message: "매수 금액이 올바르지 않음",
        portfolio: portfolio,
      };
    }

    const fee = useCash * FEE_RATE;
    const totalCost = useCash + fee;

    if (next.account.cash < totalCost) {
      return {
        success: false,
        message: "잔고 부족",
        portfolio: portfolio,
      };
    }

    const quantity = useCash / executedPrice;

    if (!currentPosition) {
      next.positions[order.symbol] = {
        symbol: order.symbol,
        quantity,
        avgPrice: executedPrice,
        updatedAt: now,
      };
    } else {
      const totalQty = currentPosition.quantity + quantity;
      const newAvgPrice =
        (currentPosition.quantity * currentPosition.avgPrice +
          quantity * executedPrice) /
        totalQty;

      next.positions[order.symbol] = {
        ...currentPosition,
        quantity: totalQty,
        avgPrice: newAvgPrice,
        updatedAt: now,
      };
    }

    next.account.cash -= totalCost;
    next.account.updatedAt = now;

    const history: TradeHistory = {
      id: createId(),
      accountId: next.account.accountId,
      symbol: order.symbol,
      side: "BUY",
      price: executedPrice,
      quantity,
      fee,
      realizedPnl: 0,
      strategy: order.strategy,
      timestamp: now,
    };

    next.histories.push(history);

    return {
      success: true,
      message: "매수 체결 완료",
      portfolio: next,
    };
  }

  if (order.side === "SELL") {
    if (!currentPosition || currentPosition.quantity <= 0) {
      return {
        success: false,
        message: "보유 수량 없음",
        portfolio: portfolio,
      };
    }

    const sellQty = order.quantity ?? currentPosition.quantity;

    if (sellQty <= 0 || sellQty > currentPosition.quantity) {
      return {
        success: false,
        message: "매도 수량이 올바르지 않음",
        portfolio: portfolio,
      };
    }

    const grossAmount = sellQty * executedPrice;
    const fee = grossAmount * FEE_RATE;
    const netAmount = grossAmount - fee;
    const realizedPnl =
      (executedPrice - currentPosition.avgPrice) * sellQty - fee;

    const remainingQty = currentPosition.quantity - sellQty;

    if (remainingQty <= 0) {
      delete next.positions[order.symbol];
    } else {
      const updatedPosition: Position = {
        ...currentPosition,
        quantity: remainingQty,
        updatedAt: now,
      };
      next.positions[order.symbol] = updatedPosition;
    }

    next.account.cash += netAmount;
    next.account.updatedAt = now;

    const history: TradeHistory = {
      id: createId(),
      accountId: next.account.accountId,
      symbol: order.symbol,
      side: "SELL",
      price: executedPrice,
      quantity: sellQty,
      fee,
      realizedPnl,
      strategy: order.strategy,
      timestamp: now,
    };

    next.histories.push(history);

    return {
      success: true,
      message: "매도 체결 완료",
      portfolio: next,
    };
  }

  return {
    success: false,
    message: "지원하지 않는 주문 방향",
    portfolio: portfolio,
  };
}

export function getPortfolioSummary(
  portfolio: PaperPortfolio,
  prices: Record<string, number>,
) {
  let positionValue = 0;
  let unrealizedPnl = 0;

  for (const symbol of Object.keys(portfolio.positions)) {
    const pos = portfolio.positions[symbol];
    const currentPrice = prices[symbol] ?? pos.avgPrice;
    positionValue += pos.quantity * currentPrice;
    unrealizedPnl += (currentPrice - pos.avgPrice) * pos.quantity;
  }

  const totalValue = portfolio.account.cash + positionValue;
  const realizedPnl = portfolio.histories.reduce(
    (acc, cur) => acc + cur.realizedPnl,
    0,
  );
  const returnRate =
    ((totalValue - portfolio.account.initialCash) /
      portfolio.account.initialCash) *
    100;

  return {
    cash: portfolio.account.cash,
    positionValue,
    totalValue,
    realizedPnl,
    unrealizedPnl,
    returnRate,
  };
}
