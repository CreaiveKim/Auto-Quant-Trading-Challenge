import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { supabaseServerAuth } from "@/lib/supabase-server-auth";
import { encryptText, maskLast4 } from "@/lib/exchange-crypto";

type ExchangeType = "binance" | "upbit";

type CreateExchangeAccountBody = {
  exchange: ExchangeType;
  accountName: string;
  apiKey?: string;
  accessKey?: string;
  apiSecret: string;
  isTestnet?: boolean;
  isActive?: boolean;
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
  } = await supabaseServerAuth.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await getAuthedUser(req);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("exchange_accounts")
    .select(
      "id, user_id, exchange, account_name, is_testnet, is_active, created_at, updated_at, key_last4, secret_last4",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { message: "Failed to fetch accounts", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ accounts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser(req);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as CreateExchangeAccountBody;

  const exchange = body.exchange;
  const accountName = body.accountName?.trim();
  const apiKey = body.apiKey?.trim() || "";
  const accessKey = body.accessKey?.trim() || "";
  const apiSecret = body.apiSecret?.trim() || "";
  const isTestnet = Boolean(body.isTestnet);
  const isActive = body.isActive ?? true;

  if (!exchange || !["binance", "upbit"].includes(exchange)) {
    return NextResponse.json({ message: "Invalid exchange" }, { status: 400 });
  }

  if (!accountName) {
    return NextResponse.json(
      { message: "accountName is required" },
      { status: 400 },
    );
  }

  if (!apiSecret) {
    return NextResponse.json(
      { message: "apiSecret is required" },
      { status: 400 },
    );
  }

  if (exchange === "binance" && !apiKey) {
    return NextResponse.json(
      { message: "apiKey is required for binance" },
      { status: 400 },
    );
  }

  if (exchange === "upbit" && !accessKey) {
    return NextResponse.json(
      { message: "accessKey is required for upbit" },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin.from("exchange_accounts").insert({
    user_id: user.id,
    exchange,
    account_name: accountName,
    api_key: null,
    access_key: null,
    api_secret: null,
    api_key_encrypted: exchange === "binance" ? encryptText(apiKey) : null,
    access_key_encrypted: exchange === "upbit" ? encryptText(accessKey) : null,
    secret_key_encrypted: encryptText(apiSecret),
    key_last4:
      exchange === "binance" ? maskLast4(apiKey) : maskLast4(accessKey),
    secret_last4: maskLast4(apiSecret),
    is_testnet: exchange === "binance" ? isTestnet : false,
    is_active: isActive,
  });

  if (error) {
    return NextResponse.json(
      { message: "Failed to save exchange account", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Saved successfully" });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser(req);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  const isActive = Boolean(body.isActive);

  if (!id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("exchange_accounts")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { message: "Failed to update account", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Updated successfully" });
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser(req);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("exchange_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { message: "Failed to delete account", detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "Deleted successfully" });
}
