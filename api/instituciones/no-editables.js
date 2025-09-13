// api/instituciones/no-editables.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const { idprofesorsaanee } = req.query;
  if (!idprofesorsaanee) return res.status(400).json({ error: "Se requiere idprofesorsaanee" });

  try {
    const { data = [], error } = await supabase
      .from("profesores_saanee_institucion")
      .select("idinstitucioneducativa")
      .neq("idprofesorsaanee", idprofesorsaanee);
    if (error) throw error;
    res.json(data.map(r => r.idinstitucioneducativa));
  } catch (err) {
    console.error("Error al obtener instituciones no editables:", err);
    res.status(500).json({ error: "Error interno" });
  }
}
