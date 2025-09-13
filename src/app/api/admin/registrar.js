import { supabase } from "../../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { correo, clave } = req.body;
    if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

    const { error } = await supabase
      .from("administrador")
      .insert([{ correo: correo.trim().toLowerCase(), clave }]);

    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error("Error registrar-admin:", err);
    return res.status(500).json({ ok: false, mensaje: "Error al registrar" });
  }
}
