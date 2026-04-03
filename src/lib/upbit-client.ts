import { supabase } from "@/lib/supabase";

export async function saveUpbitAccount(input: {
  accountName?: string;
  accessKey: string;
  secretKey: string;
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/save-upbit-account`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(input),
    },
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "업비트 계정 저장 실패");

  return json;
}

export async function getUpbitBalance() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-upbit-balance`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  );

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "업비트 잔고 조회 실패");

  return json;
}
