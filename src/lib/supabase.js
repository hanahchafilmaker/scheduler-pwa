import { createClient } from "@supabase/supabase-js";

console.log("ENV URL =", import.meta.env.VITE_SUPABASE_URL);
console.log("ENV KEY =", import.meta.env.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase 환경변수가 없습니다. .env를 확인하세요.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
