import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getAccessTokenFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.replace("Bearer ", "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const token = getAccessTokenFromRequest(req);

    if (!token) {
      return NextResponse.json(
        { ok: false, message: "인증 토큰이 없습니다." },
        { status: 401 },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, message: "유효한 로그인 사용자만 접근할 수 있습니다." },
        { status: 401 },
      );
    }

    const { error } = await supabaseAdmin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        nickname: null,
      },
      {
        onConflict: "id",
      },
    );

    if (error) {
      console.error("profiles upsert error:", error);

      return NextResponse.json(
        { ok: false, message: "프로필 생성에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "프로필이 준비되었습니다.",
    });
  } catch (error) {
    console.error("profile bootstrap error:", error);

    return NextResponse.json(
      { ok: false, message: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
