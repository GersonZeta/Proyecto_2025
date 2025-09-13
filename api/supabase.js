// api/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('ENV CHECK -> SUPABASE_URL?', !!supabaseUrl, 'ANON?', !!supabaseAnonKey, 'SERVICE_ROLE?', !!supabaseServiceRoleKey);

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('❌ ERROR: Variables de entorno de Supabase no configuradas correctamente.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
