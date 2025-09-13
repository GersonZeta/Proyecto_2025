import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // --- INSTITUCIONES SIN ASIGNAR
    if (action === "listar") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { data: usedInsts, error: usedError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa");
      if (usedError) throw usedError;

      const idsUsadas = usedInsts.map(x => x.idinstitucioneducativa);

      const { data, error } = await supabase
        .from("instituciones_educativas")
        .select("idinstitucioneducativa, nombreinstitucion")
        .not("idinstitucioneducativa", "in", idsUsadas);
      if (error) throw error;

      return res.json({ ok: true, data });
    }

    // --- TODAS LAS INSTITUCIONES
    if (action === "listar-todas") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { data, error } = await supabase
        .from("instituciones_educativas")
        .select("idinstitucioneducativa, nombreinstitucion");
      if (error) throw error;

      return res.json({ ok: true, data });
    }

    // --- INSTITUCIONES NO EDITABLES (por otros profesores)
    if (action === "no-editables") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { idprofesorsaanee } = req.query;
      if (!idprofesorsaanee) return res.status(400).json({ ok: false, mensaje: "Falta idprofesorsaanee" });

      const { data, error } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .neq("idprofesorsaanee", idprofesorsaanee);
      if (error) throw error;

      return res.json({ ok: true, data: data.map(r => r.idinstitucioneducativa) });
    }

    // --- INSTITUCIONES DE UN PROFESOR
    if (action === "profesor") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { idprofesorsaanee, correo } = req.query;
      if (!idprofesorsaanee && !correo) return res.status(400).json({ ok: false, mensaje: "Falta idprofesorsaanee o correo" });

      const filtro = idprofesorsaanee
        ? { idprofesorsaanee }
        : { correo: correo.trim().toLowerCase() };

      const { data: profs, error: profError } = await supabase
        .from("profesores_saanee")
        .select("*")
        .match(filtro);
      if (profError) throw profError;
      if (!profs || profs.length === 0) return res.status(404).json({ ok: false, mensaje: "Profesor no encontrado" });

      const prof = profs[0];

      const { data: insts, error: instError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .eq("idprofesorsaanee", prof.idprofesorsaanee);
      if (instError) throw instError;

      return res.json({
        ok: true,
        data: {
          idProfesor: prof.idprofesorsaanee,
          Correo: prof.correo,
          NombreProfesor: prof.nombreprofesorsaanee,
          Clave: prof.clave,
          TelefonoProf: prof.telefonosaanee,
          Instituciones: insts.map(r => r.idinstitucioneducativa)
        }
      });
    }

    // --- CREAR INSTITUCIÓN
    if (action === "crear") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { nombreinstitucion } = req.body;
      if (!nombreinstitucion) return res.status(400).json({ ok: false, mensaje: "Nombre de institución obligatorio" });

      const { data, error } = await supabase
        .from("instituciones_educativas")
        .insert([{ nombreinstitucion }])
        .select();
      if (error) throw error;

      return res.status(201).json({ ok: true, data: data[0], mensaje: "Institución creada" });
    }

    // --- EDITAR INSTITUCIÓN
    if (action === "editar") {
      if (req.method !== "PUT") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { id, nombreinstitucion } = req.body;
      if (!id || !nombreinstitucion) return res.status(400).json({ ok: false, mensaje: "Faltan datos" });

      const { error } = await supabase
        .from("instituciones_educativas")
        .update({ nombreinstitucion })
        .eq("idinstitucioneducativa", id);
      if (error) throw error;

      return res.json({ ok: true, mensaje: "Institución actualizada" });
    }

    return res.status(400).json({ ok: false, mensaje: "Acción inválida" });

  } catch (err) {
    console.error("Error instituciones:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
}
