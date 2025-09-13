// src/app/api/admins/route.js  (Opción 1 - segura y simple)
import { createClient } from "@supabase/supabase-js";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}

export async function GET() {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    // <-- solo correo, NUNCA claves
    const { data, error } = await supabase.from("administrador").select("correo");
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers });
    return new Response(JSON.stringify(data ?? []), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500, headers });
  }
}
