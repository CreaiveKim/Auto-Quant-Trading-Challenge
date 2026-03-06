import { NextResponse } from "next/server";

type FearGreedPayload = {
  binance: {
    value: number;
    classification: string;
    source: string;
    updatedAt?: string | null;
  } | null;
  upbit: {
    value: number;
    classification: string;
    source: string;
    updatedAt?: string | null;
  } | null;
};

function extractUpbitValue(html: string) {
  // 예: "현재 지수 중립 - 46"
  const valueMatch =
    html.match(/현재 지수\s*[^0-9]{0,20}\s*-\s*(\d{1,3})/i) ||
    html.match(/현재\s*지수[^0-9]*(\d{1,3})/i);

  // 예: "중립 - 46", "공포 - 35", "매우 탐욕 - 88"
  const classMatch =
    html.match(/(매우\s*공포|공포|중립|탐욕|매우\s*탐욕)\s*-\s*\d{1,3}/i) ||
    html.match(/현재\s*지수\s*(매우\s*공포|공포|중립|탐욕|매우\s*탐욕)/i);

  // 예: "오늘 08:59 기준"
  const timeMatch = html.match(/오늘\s*(\d{1,2}:\d{2})\s*기준/i);

  const value = valueMatch ? Number(valueMatch[1]) : null;
  const classification = classMatch
    ? classMatch[1].replace(/\s+/g, " ").trim()
    : "Unknown";

  return {
    value,
    classification,
    updatedAt: timeMatch ? timeMatch[1] : null,
  };
}

export async function GET() {
  try {
    const [binanceRes, upbitRes] = await Promise.all([
      fetch("https://api.alternative.me/fng/?limit=1&format=json", {
        next: { revalidate: 60 },
      }),
      // 업비트 전체 시장 공포/탐욕 지수 페이지
      fetch("https://datalab.upbit.com/insight/fear-greed-index", {
        next: { revalidate: 60 },
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }),
    ]);

    let binance: FearGreedPayload["binance"] = null;
    let upbit: FearGreedPayload["upbit"] = null;

    if (binanceRes.ok) {
      const json = await binanceRes.json();
      const row = json?.data?.[0];

      if (row) {
        binance = {
          value: Number(row.value),
          classification: row.value_classification ?? "Unknown",
          source: "Alternative.me",
          updatedAt: row.timestamp
            ? new Date(Number(row.timestamp) * 1000).toISOString()
            : null,
        };
      }
    }

    if (upbitRes.ok) {
      const html = await upbitRes.text();
      const parsed = extractUpbitValue(html);

      if (parsed.value !== null) {
        upbit = {
          value: parsed.value,
          classification: parsed.classification,
          source: "Upbit Datalab",
          updatedAt: parsed.updatedAt,
        };
      }
    }

    return NextResponse.json(
      {
        binance,
        upbit,
      } satisfies FearGreedPayload,
      {
        status: 200,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("fear-greed route error:", error);

    return NextResponse.json(
      {
        binance: null,
        upbit: null,
      } satisfies FearGreedPayload,
      { status: 200 },
    );
  }
}
