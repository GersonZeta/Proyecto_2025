// api/admin/login.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { correo, clave } = req.body;
    if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

    const { data, error } = await supabase
      .from("administrador")
      .select("clave")
      .eq("correo", correo.trim().toLowerCase())
      .single();

    if (error || !data) return res.json({ ok: false, mensaje: "Correo no registrado" });
    return res.json(data.clave === clave ? { ok: true } : { ok: false, mensaje: "Clave incorrecta" });
  } catch (err) {
    console.error("Error login-admin:", err);
    return res.status(500).json({ ok: false, mensaje: "Error servidor" });
  }
}
