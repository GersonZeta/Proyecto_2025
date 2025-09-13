// /api/profesores/registrar.js
import { supabaseAdmin } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = req.body;
    if (!correo || !nombreprofesorsaanee || !clave) return res.status(400).json({ error: "Faltan campos" });

    const { data: prof, error } = await supabaseAdmin
      .from("profesores_saanee")
      .insert([{ correo: correo.trim().toLowerCase(), nombreprofesorsaanee, clave, telefonosaanee }])
      .select()
      .single();
    if (error) throw error;

    if (instituciones && instituciones.length > 0) {
      const instInsert = instituciones.map(id => ({
        idprofesorsaanee: prof.idprofesorsaanee,
        idinstitucioneducativa: id
      }));
      const { error: instError } = await supabaseAdmin
        .from("profesores_saanee_institucion")
        .insert(instInsert);
      if (instError) throw instError;
    }

    return res.json({ success: true, profesor: prof });
  } catch (err) {
    console.error("Error /profesores/registrar:", err);
    return res.status(500).json({ error: "Error al registrar profesor" });
  }
}
