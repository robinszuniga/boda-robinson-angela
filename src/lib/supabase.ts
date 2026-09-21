import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { env, isSupabaseConfigured } from './env'

// Si falta la configuración se crea un cliente apuntando a un host inválido;
// la app no llega a usarlo porque muestra la pantalla "Configura Supabase".
export const supabase = createClient<Database>(
  isSupabaseConfigured ? env.supabaseUrl : 'https://example.invalid',
  isSupabaseConfigured ? env.supabaseKey : 'missing-key-missing-key-missing',
  { auth: { persistSession: true, autoRefreshToken: true } },
)
