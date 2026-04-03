import { supabase } from "@/lib/supabase/client";

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.access_token) {
    throw new Error("로그인이 필요합니다.");
  }

  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}
