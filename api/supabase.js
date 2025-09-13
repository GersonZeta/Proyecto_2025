// api/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error('❌ ERROR: Variables de entorno de Supabase no configuradas correctamente.');
}

// Cliente para uso público (lectura, login, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente con permisos de administrador (insertar, borrar, actualizar masivo)
// ⚠️ Usar SOLO en endpoints protegidos del backend (nunca en frontend)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
