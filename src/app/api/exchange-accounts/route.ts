import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptText } from "@/lib/exchange-crypto";

function getAccessTokenFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

async function getAuthedUser(req: NextRequest) {
  const token = getAccessTokenFromRequest(req);

  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;

  return user;
}

type CreateExchangeAccountBody = {
  exchange: "upbit" | "binance";
  label?: string | null;
  memo?: string | null;
  accessKey?: string;
  secretKey?: string;
};

export async function GET(req: NextRequest) {
  try {
    console.log("auth header:", req.headers.get("authorization"));

    const user = await getAuthedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "유효한 로그인 사용자만 접근할 수 있습니다." },
        { status: 401 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("exchange_accounts")
      .select("id, exchange, label, memo, is_active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, message: "거래소 계정 조회 실패", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      accounts: data ?? [],
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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthedUser(req);

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "유효한 로그인 사용자만 접근할 수 있습니다." },
        { status: 401 },
      );
    }

    const body = (await req.json()) as CreateExchangeAccountBody;

    const exchange = body.exchange;
    const label = body.label?.trim() || null;
    const memo = body.memo?.trim() || null;
    const accessKey = body.accessKey?.trim();
    const secretKey = body.secretKey?.trim();

    if (!exchange || !["upbit", "binance"].includes(exchange)) {
      return NextResponse.json(
        { ok: false, message: "지원하지 않는 거래소입니다." },
        { status: 400 },
      );
    }

    if (!accessKey || !secretKey) {
      return NextResponse.json(
        { ok: false, message: "Access Key와 Secret Key는 필수입니다." },
        { status: 400 },
      );
    }

    const accessKeyEncrypted = encryptText(accessKey);
    const secretKeyEncrypted = encryptText(secretKey);

    const { error } = await supabaseAdmin.from("exchange_accounts").insert({
      user_id: user.id,
      exchange,
      label,
      memo,
      is_active: true,
      key_last4: accessKey.slice(-4),
      secret_last4: secretKey.slice(-4),
      access_key_encrypted: accessKeyEncrypted,
      secret_key_encrypted: secretKeyEncrypted,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, message: "거래소 계정 저장 실패", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "거래소 계정이 저장되었습니다.",
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
