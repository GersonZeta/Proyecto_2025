// api/instituciones/all.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  try {
    const { data = [], error } = await supabase
      .from("instituciones_educativas")
      .select("idinstitucioneducativa, nombreinstitucion");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error al obtener todas las instituciones:", err);
    res.status(500).json({ error: "Error interno" });
  }
}
