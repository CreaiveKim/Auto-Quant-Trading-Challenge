import crypto from "crypto";
import jwt from "jsonwebtoken";

export type UpbitBalanceItem = {
  currency: string;
  balance: string;
  locked: string;
  avg_buy_price: string;
  avg_buy_price_modified: boolean;
  unit_currency: string;
};

export function createUpbitJwt(accessKey: string, secretKey: string) {
  return jwt.sign(
    {
      access_key: accessKey,
      nonce: crypto.randomUUID(),
    },
    secretKey,
    {
      algorithm: "HS512",
    },
  );
}

export async function fetchUpbitBalances(
  accessKey: string,
  secretKey: string,
): Promise<UpbitBalanceItem[]> {
  const token = createUpbitJwt(accessKey, secretKey);

  const res = await fetch("https://api.upbit.com/v1/accounts", {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upbit balance fetch failed: ${res.status} ${text}`);
  }

  return (await res.json()) as UpbitBalanceItem[];
}
