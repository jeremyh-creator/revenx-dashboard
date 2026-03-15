import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client.
 * Uses SUPABASE_SERVICE_ROLE_KEY in production (bypasses RLS, never expose to client).
 * Falls back to anon key for local dev if service role not set.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  }

  // Prefer service role key for server (bypasses RLS; auth enforced by Clerk in Next.js)
  if (serviceRoleKey) {
    return createSupabaseClient(supabaseUrl, serviceRoleKey);
  }

  // Fallback to anon key (e.g. local dev)
  if (!anonKey) {
    throw new Error(
      "Missing Supabase keys. Add SUPABASE_SERVICE_ROLE_KEY (production) or NEXT_PUBLIC_SUPABASE_ANON_KEY (dev) to .env.local"
    );
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Ignore in Server Components
        }
      },
    },
  });
}
