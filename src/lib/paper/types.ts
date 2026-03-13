export type Side = "BUY" | "SELL";
export type ExchangeType = "binance" | "upbit";

export type PositionItem = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  exchange: ExchangeType;
};

export type HistoryItem = {
  id: string;
  exchange: ExchangeType;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  fee: number;
  realizedPnl: number;
  strategy?: string;
  timestamp: number;
};

export type PortfolioResponse = {
  account: PaperAccount;
  positions: Record<string, PositionItem>;
  histories: HistoryItem[];
};

export type MarketPrice = {
  symbol: string;
  price: number;
  timestamp: number;
};

export type PaperAccount = {
  accountId: string;
  name: string;
  cash: number;
  initialCash: number;
  createdAt: number;
  updatedAt: number;
};

export type Position = {
  symbol: string;
  quantity: number;
  avgPrice: number;
  updatedAt: number;
};

export type TradeHistory = {
  id: string;
  accountId: string;
  symbol: string;
  side: Side;
  price: number;
  quantity: number;
  fee: number;
  realizedPnl: number;
  strategy?: string;
  timestamp: number;
};

export type PaperPortfolio = {
  account: PaperAccount;
  positions: Record<string, Position>;
  histories: TradeHistory[];
};

export type CreatePaperAccountInput = {
  name: string;
  initialCash: number;
};

export type ExecutePaperOrderInput = {
  accountId: string;
  symbol: string;
  side: Side;
  useCashAmount?: number; // BUY 시 사용할 금액
  quantity?: number; // SELL 시 수량, 없으면 전량
  strategy?: string;
};

export type ExecutePaperOrderResult = {
  success: boolean;
  message: string;
  portfolio: PaperPortfolio | null;
};
