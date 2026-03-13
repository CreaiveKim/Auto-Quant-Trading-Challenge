import { NextResponse } from "next/server";
import { paperStore } from "@/lib/paper/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const portfolio = paperStore[accountId];

  if (!portfolio) {
    return NextResponse.json({ message: "계좌 없음" }, { status: 404 });
  }

  return NextResponse.json({ portfolio });
}
