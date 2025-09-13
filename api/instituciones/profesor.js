// api/instituciones/profesor.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  const { idprofesorsaanee, correo } = req.query;
  if (!idprofesorsaanee && !correo) return res.status(400).json({ error: "Se requiere idprofesorsaanee o correo" });

  try {
    const filtro = idprofesorsaanee ? { idprofesorsaanee } : { correo: (correo || "").trim().toLowerCase() };

    const { data: profs = [], error: profError } = await supabase
      .from("profesores_saanee")
      .select("*")
      .match(filtro);
    if (profError) throw profError;
    if (!profs.length) return res.status(404).json({ error: "Profesor no encontrado" });

    const prof = profs[0];

    const { data: insts = [], error: instError } = await supabase
      .from("profesores_saanee_institucion")
      .select("idinstitucioneducativa")
      .eq("idprofesorsaanee", prof.idprofesorsaanee);
    if (instError) throw instError;

    res.json({
      idProfesor: prof.idprofesorsaanee,
      Correo: prof.correo,
      NombreProfesor: prof.nombreprofesorsaanee,
      Clave: prof.clave,
      TelefonoProf: prof.telefonosaanee,
      Instituciones: insts.map(r => r.idinstitucioneducativa)
    });
  } catch (err) {
    console.error("Error al obtener instituciones del profesor:", err);
    res.status(500).json({ error: "Error interno" });
  }
}
