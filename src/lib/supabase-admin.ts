import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("[supabase-admin] cwd:", process.cwd());
console.log("[supabase-admin] url exists:", !!supabaseUrl);
console.log("[supabase-admin] service role exists:", !!serviceRoleKey);
console.log(
  "[supabase-admin] all env keys sample:",
  Object.keys(process.env).filter(
    (key) => key.includes("SUPABASE") || key.includes("EXCHANGE"),
  ),
);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase admin env is missing");
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
