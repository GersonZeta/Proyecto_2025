// /api/profesores/buscar.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const nombre = req.query.nombreProfesor;
  if (!nombre) return res.status(400).json({ error: "Falta nombreProfesor" });

  try {
    const { data: profs, error } = await supabase
      .from("profesores_saanee")
      .select("*")
      .ilike("nombreprofesorsaanee", `%${nombre}%`);
    if (error) throw error;
    if (!profs || profs.length === 0) return res.status(404).json({ error: "Profesor no encontrado" });

    const prof = profs[0];
    const { data: insts, error: instError } = await supabase
      .from("profesores_saanee_institucion")
      .select("idinstitucioneducativa")
      .eq("idprofesorsaanee", prof.idprofesorsaanee);
    if (instError) throw instError;

    return res.json({ ...prof, instituciones: insts.map(i => i.idinstitucioneducativa) });
  } catch (err) {
    console.error("Error /profesores/buscar:", err);
    return res.status(500).json({ error: "Error al buscar profesor" });
  }
}
