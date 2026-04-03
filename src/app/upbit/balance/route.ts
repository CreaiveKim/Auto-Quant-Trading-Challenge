import crypto from "crypto";
import jwt from "jsonwebtoken";

export type UpbitAccountItem = {
  currency: string;
  balance: string;
  locked: string;
  avg_buy_price: string;
  avg_buy_price_modified: boolean;
  unit_currency: string;
};

export function createUpbitToken(accessKey: string, secretKey: string) {
  const payload = {
    access_key: accessKey,
    nonce: crypto.randomUUID(),
  };

  return jwt.sign(payload, secretKey, {
    algorithm: "HS512",
  });
}

export async function fetchUpbitAccounts(
  accessKey: string,
  secretKey: string,
): Promise<UpbitAccountItem[]> {
  const token = createUpbitToken(accessKey, secretKey);

  const res = await fetch("https://api.upbit.com/v1/accounts", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`업비트 잔고 조회 실패: ${res.status} ${text}`);
  }

  return JSON.parse(text) as UpbitAccountItem[];
}

// 기존 route.ts에서 fetchUpbitBalances를 import하고 있으면 호환용으로 같이 export
export const fetchUpbitBalances = fetchUpbitAccounts;
