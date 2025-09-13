// /api/profesores/index.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { data: profesores, error } = await supabase.from("profesores_saanee").select("*");
    if (error) throw error;

    const profesoresConInst = await Promise.all(
      profesores.map(async (prof) => {
        const { data: insts, error: instError } = await supabase
          .from("profesores_saanee_institucion")
          .select("idinstitucioneducativa")
          .eq("idprofesorsaanee", prof.idprofesorsaanee);
        if (instError) throw instError;

        return { ...prof, instituciones: insts.map(i => i.idinstitucioneducativa) };
      })
    );

    return res.json(profesoresConInst);
  } catch (err) {
    console.error("Error /profesores:", err);
    return res.status(500).json({ error: "Error al obtener profesores" });
  }
}
