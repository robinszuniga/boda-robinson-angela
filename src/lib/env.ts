export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabaseKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
}

export const isSupabaseConfigured =
  /^https?:\/\/.+/.test(env.supabaseUrl) && env.supabaseKey.length > 20
