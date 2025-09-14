// src/pages/api/docentes/index.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // --- LISTAR DOCENTES (una fila por relación: iddocente + idestudiante + NombreEstudiante)
    if (action === "listar") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { idInstitucionEducativa, nombreDocente } = req.query;

      let query = supabase.from("docentes_estudiante").select("*");
      if (idInstitucionEducativa) query = query.eq("idinstitucioneducativa", idInstitucionEducativa);
      if (nombreDocente) query = query.ilike("nombredocente", `%${nombreDocente}%`);

      const { data: docs, error } = await query
        .order("dnidocente", { ascending: true })
        .order("idestudiante", { ascending: true });

      if (error) {
        console.error("Supabase error listar docentes:", error);
        throw error;
      }

      const docsList = docs || [];
      if (!docsList.length) return res.json({ ok: true, data: [] });

      const studentIds = Array.from(new Set(docsList.map(d => d.idestudiante).filter(Boolean)));
      let studentsMap = new Map();
      if (studentIds.length) {
        const { data: studs, error: errStuds } = await supabase
          .from("estudiantes")
          .select("idestudiante, apellidosnombres")
          .in("idestudiante", studentIds);
        if (errStuds) {
          console.error("Supabase error obtener estudiantes:", errStuds);
          throw errStuds;
        }
        (studs || []).forEach(s => studentsMap.set(s.idestudiante, s.apellidosnombres));
      }

      const mapped = docsList.map(d => ({
        idDocente: d.iddocente,
        idEstudiante: d.idestudiante,
        NombreEstudiante: studentsMap.get(d.idestudiante) ?? null,
        NombreDocente: d.nombredocente,
        DNIDocente: d.dnidocente,
        Email: d.email,
        Telefono: d.telefono || null,
        GradoSeccionLabora: d.gradoseccionlabora || null,
        idInstitucionEducativa: d.idinstitucioneducativa
      }));

      return res.json({ ok: true, data: mapped });
    }

    // --- REGISTRAR DOCENTE (acepta idEstudiante número o array)
    if (action === "registrar") {
      if (req.method !== "POST")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      let { idEstudiante, NombreDocente, DNIDocente, Email, Telefono, GradoSeccionLabora } = req.body;
      if (!idEstudiante || !NombreDocente || !DNIDocente || !Email)
        return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios" });

      const ids = Array.isArray(idEstudiante) ? idEstudiante.map(Number).filter(n => !isNaN(n)) : [Number(idEstudiante)];
      if (!ids.length) return res.status(400).json({ ok: false, mensaje: "idEstudiante inválido" });

      // VALIDAR: obtener instituciones de todos los estudiantes y exigir que sean iguales
      const { data: instRows, error: errInst } = await supabase
        .from("estudiantes")
        .select("idestudiante, idinstitucioneducativa")
        .in("idestudiante", ids);
      if (errInst) {
        console.error("Supabase error validar instituciones:", errInst);
        throw errInst;
      }
      if (!instRows || instRows.length !== ids.length)
        return res.status(404).json({ ok: false, mensaje: "Algún estudiante no existe" });

      const instSet = new Set(instRows.map(r => r.idinstitucioneducativa));
      if (instSet.size > 1) {
        return res.status(400).json({ ok: false, mensaje: "Los estudiantes pertenecen a instituciones diferentes" });
      }
      const finalInst = instRows[0].idinstitucioneducativa;

      const values = ids.map(id => ({
        idestudiante: id,
        nombredocente: NombreDocente,
        dnidocente: DNIDocente,
        email: Email,
        telefono: Telefono || null,
        gradoseccionlabora: GradoSeccionLabora || null,
        idinstitucioneducativa: finalInst
      }));

      const { data: inserted, error: errIns } = await supabase
        .from("docentes_estudiante")
        .insert(values)
        .select();
      if (errIns) {
        console.error("Supabase error insertar docentes:", errIns);
        throw errIns;
      }

      return res.json({ ok: true, mensaje: "Docente(s) registrado(s)", data: inserted });
    }

    // --- ACTUALIZAR DOCENTE (espera idEstudiante array)
    if (action === "actualizar") {
      if (req.method !== "PUT")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { DNIDocente, NombreDocente, Email, Telefono, GradoSeccionLabora, idEstudiante } = req.body;
      if (!DNIDocente || !NombreDocente || !Email || !Array.isArray(idEstudiante))
        return res.status(400).json({ ok: false, mensaje: "Campos inválidos" });

      const { data: instRows, error: errInsts } = await supabase
        .from("estudiantes")
        .select("idestudiante, idinstitucioneducativa")
        .in("idestudiante", idEstudiante);
      if (errInsts) throw errInsts;

      const instMap = new Map((instRows || []).map(r => [r.idestudiante, r.idinstitucioneducativa]));

      const { data: currentRows, error: errCurrent } = await supabase
        .from("docentes_estudiante")
        .select("iddocente, idestudiante")
        .eq("dnidocente", DNIDocente);
      if (errCurrent) throw errCurrent;

      const currentMap = new Map((currentRows || []).map(r => [r.idestudiante, r.iddocente]));

      const toDelete = (currentRows || []).filter(r => !idEstudiante.includes(r.idestudiante)).map(r => r.iddocente);
      const toAdd = idEstudiante.filter(id => !currentMap.has(id));

      const { error: errUpdate } = await supabase
        .from("docentes_estudiante")
        .update({
          nombredocente: NombreDocente,
          email: Email,
          telefono: Telefono || null,
          gradoseccionlabora: GradoSeccionLabora || null
        })
        .eq("dnidocente", DNIDocente);
      if (errUpdate) throw errUpdate;

      if (toDelete.length) {
        const { error: errDel } = await supabase
          .from("docentes_estudiante")
          .delete()
          .in("iddocente", toDelete);
        if (errDel) throw errDel;
      }

      if (toAdd.length) {
        const values = toAdd.map(idEst => ({
          idestudiante: idEst,
          nombredocente: NombreDocente,
          dnidocente: DNIDocente,
          email: Email,
          telefono: Telefono || null,
          gradoseccionlabora: GradoSeccionLabora || null,
          idinstitucioneducativa: instMap.get(idEst) ?? null
        }));
        const { error: errIns } = await supabase.from("docentes_estudiante").insert(values);
        if (errIns) throw errIns;
      }

      return res.json({ ok: true, mensaje: "Docente actualizado" });
    }

    // --- ELIMINAR DOCENTE (borra todas las filas con dnidocente igual)
    if (action === "eliminar") {
      if (req.method !== "DELETE")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, mensaje: "Falta id" });

      const { data: row, error: err0 } = await supabase
        .from("docentes_estudiante")
        .select("dnidocente")
        .eq("iddocente", id)
        .maybeSingle();
      if (err0) throw err0;
      if (!row) return res.status(404).json({ ok: false, mensaje: "Docente no encontrado" });

      const { data: deleted, error: errDel } = await supabase
        .from("docentes_estudiante")
        .delete()
        .eq("dnidocente", row.dnidocente)
        .select();
      if (errDel) throw errDel;
      if (!deleted || deleted.length === 0)
        return res.status(404).json({ ok: false, mensaje: "Docente no encontrado o ya eliminado" });

      return res.json({ ok: true, mensaje: "Docente eliminado", count: deleted.length });
    }

    // --- BUSCAR DOCENTE (devuelve datos con idEstudiante array) - usa ilike para mayor flexibilidad
    if (action === "buscar") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { nombreDocente } = req.query;
      if (!nombreDocente)
        return res.status(400).json({ ok: false, mensaje: "Se requiere nombreDocente" });

      // buscar un dnidocente que coincida parcialmente (ilike) para mayor flexibilidad
      const { data: baseRows, error: errBase } = await supabase
        .from("docentes_estudiante")
        .select("dnidocente")
        .ilike("nombredocente", `%${nombreDocente}%`)
        .limit(1);
      if (errBase) throw errBase;
      if (!baseRows || baseRows.length === 0)
        return res.status(404).json({ ok: false, mensaje: "Docente no encontrado" });

      const dni = baseRows[0].dnidocente;
      const { data: rows, error: errAll } = await supabase
        .from("docentes_estudiante")
        .select("iddocente, idestudiante, nombredocente, dnidocente, email, telefono, gradoseccionlabora")
        .eq("dnidocente", dni);
      if (errAll) throw errAll;
      if (!rows || rows.length === 0)
        return res.status(404).json({ ok: false, mensaje: "Docente no encontrado" });

      return res.json({
        ok: true,
        data: {
          DNIDocente: rows[0].dnidocente,
          NombreDocente: rows[0].nombredocente,
          Email: rows[0].email,
          Telefono: rows[0].telefono,
          GradoSeccionLabora: rows[0].gradoseccionlabora,
          idEstudiante: rows.map(r => r.idestudiante)
        }
      });
    }

    return res.status(400).json({ ok: false, mensaje: "Acción inválida" });
  } catch (err) {
    console.error("Error docentes:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
}
