import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptText } from "@/lib/exchange-crypto";
import { fetchUpbitBalances } from "@/lib/upbit";

type ExchangeAccountRow = {
  id: string;
  user_id: string;
  exchange: "binance" | "upbit";
  label: string | null;
  memo: string | null;
  is_active: boolean;
  created_at: string;
  key_last4: string | null;
  secret_last4: string | null;
  access_key_encrypted: string | null;
  secret_key_encrypted: string | null;
};

async function getAuthedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { data: account, error } = await supabaseAdmin
      .from("exchange_accounts")
      .select(
        "id, user_id, exchange, label, memo, is_active, created_at, key_last4, secret_last4, access_key_encrypted, secret_key_encrypted",
      )
      .eq("user_id", user.id)
      .eq("exchange", "upbit")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ExchangeAccountRow>();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Failed to load upbit account",
          detail: error.message,
        },
        { status: 500 },
      );
    }

    if (!account) {
      return NextResponse.json(
        { ok: false, message: "활성화된 업비트 계정이 없습니다." },
        { status: 404 },
      );
    }

    if (!account.access_key_encrypted || !account.secret_key_encrypted) {
      return NextResponse.json(
        { ok: false, message: "저장된 업비트 키가 없습니다." },
        { status: 400 },
      );
    }

    const accessKey = decryptText(account.access_key_encrypted);
    const secretKey = decryptText(account.secret_key_encrypted);

    const balances = await fetchUpbitBalances(accessKey, secretKey);

    const filteredBalances = Array.isArray(balances)
      ? balances.filter((item) => {
          const balance = Number(item.balance || "0");
          const locked = Number(item.locked || "0");
          return balance > 0 || locked > 0;
        })
      : [];

    return NextResponse.json({
      ok: true,
      accountLabel: account.label,
      balances: filteredBalances.map((item) => ({
        asset: item.currency,
        free: item.balance,
        locked: item.locked,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}
