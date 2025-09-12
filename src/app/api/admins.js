// pages/api/admins.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY // 👈 usa la anon_key para frontend y apis públicas
);

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { data, error } = await supabase
    .from("administrador")
    .select("correo, clave");

  if (error) return res.status(400).json({ error: error.message });
  res.status(200).json(data);
}
