import { NextResponse } from "next/server";
import { paperStore } from "@/lib/paper/store";
import type { ExchangeType, PortfolioResponse } from "@/lib/paper/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = body?.name ?? "demo-account";
    const initialCash = Number(body?.initialCash ?? 1000000);
    const exchange = (body?.exchange ?? "binance") as ExchangeType;

    const now = Date.now();
    const accountId = crypto.randomUUID();

    const portfolio: PortfolioResponse = {
      account: {
        accountId,
        name,
        cash: initialCash,
        initialCash,
        exchange,
        createdAt: now,
        updatedAt: now,
      },
      positions: {},
      histories: [],
    };

    paperStore[accountId] = portfolio;

    return NextResponse.json({
      message: "가짜계좌 생성 완료",
      portfolio,
    });
  } catch {
    return NextResponse.json({ message: "계좌 생성 실패" }, { status: 500 });
  }
}
