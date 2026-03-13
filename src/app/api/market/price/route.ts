//현재가 조회 API
import { NextRequest, NextResponse } from "next/server";
import { getMockPrice } from "@/lib/paper/market";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "BTCUSDT";

  try {
    const market = await getMockPrice(symbol);

    return NextResponse.json({
      success: true,
      market,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "가격 조회 실패",
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
