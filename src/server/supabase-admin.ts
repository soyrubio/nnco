export interface SupabaseAdminEnvironment {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function supabaseAdminConfig(
  env: SupabaseAdminEnvironment,
): { url: string; key: string; headers: Record<string, string> } | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key =
    env.SUPABASE_SECRET_KEY?.trim() ||
    env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || key.startsWith("sb_publishable_")) return null;

  const headers: Record<string, string> = {
    apikey: key,
    "Content-Type": "application/json",
  };
  if (!key.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return { url, key, headers };
}
