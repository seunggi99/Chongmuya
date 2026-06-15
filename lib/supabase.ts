/**
 * Supabase 클라이언트 — 용도별 분리
 *
 *  - supabaseBrowser() : 클라이언트 컴포넌트용 (anon key, RLS 적용)
 *  - supabaseServer()  : 서버 컴포넌트/액션용 (anon key + 쿠키 세션, RLS 적용)
 *  - supabaseAdmin()   : 서버 전용 (service_role key, RLS 우회) — API Route / 서버 컴포넌트에서만
 *
 *  ⚠️ DB 접근은 반드시 /lib 함수 안에서만 (컴포넌트에서 직접 호출 금지)
 */
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function assertEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name} 가 설정되지 않았습니다. .env.local 을 확인하세요.`,
    );
  }
  return value;
}

/** 브라우저(클라이언트 컴포넌트) 전용 */
export function supabaseBrowser() {
  return createBrowserClient(
    assertEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}

/** 서버 컴포넌트/서버 액션 전용 (쿠키 기반 세션 유지) */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    assertEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    assertEnv(SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // 서버 컴포넌트에서 set 호출 시 무시 (미들웨어에서 갱신)
          }
        },
      },
    },
  );
}

/**
 * 서버 전용 관리자 클라이언트 (service_role). RLS 를 우회하므로
 * 절대 클라이언트 번들로 노출되면 안 된다 — 'server-only' import 로 강제.
 */
export function supabaseAdmin() {
  const serviceKey = assertEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  return createClient(assertEnv(SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
