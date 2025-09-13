// /api/profesores/actualizar.js
import { supabaseAdmin } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "PUT") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { idprofesorsaanee, correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = req.body;
    if (!idprofesorsaanee) return res.status(400).json({ error: "Falta idprofesorsaanee" });

    const { error } = await supabaseAdmin
      .from("profesores_saanee")
      .update({ correo: correo?.trim().toLowerCase(), nombreprofesorsaanee, clave, telefonosaanee })
      .eq("idprofesorsaanee", idprofesorsaanee);
    if (error) throw error;

    const { error: delError } = await supabaseAdmin
      .from("profesores_saanee_institucion")
      .delete()
      .eq("idprofesorsaanee", idprofesorsaanee);
    if (delError) throw delError;

    if (instituciones && instituciones.length > 0) {
      const instInsert = instituciones.map(id => ({
        idprofesorsaanee,
        idinstitucioneducativa: id
      }));
      const { error: instError } = await supabaseAdmin
        .from("profesores_saanee_institucion")
        .insert(instInsert);
      if (instError) throw instError;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Error /profesores/actualizar:", err);
    return res.status(500).json({ error: "Error al actualizar profesor" });
  }
}
