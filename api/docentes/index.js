// src/pages/api/docentes/index.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // --- LISTAR DOCENTES (una fila por relación: iddocente + idestudiante + NombreEstudiante)
    // --- LISTAR ESTUDIANTES DISPONIBLES (los que NO tienen docente asignado)
    if (action === "listar-estudiantes-disponibles") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      // Traer todos los estudiantes asignados
      const { data: asignados, error: errorAsignados } = await supabase
        .from("docentes_estudiante")
        .select("idestudiante");

      if (errorAsignados) throw errorAsignados;

      const idsAsignados = (asignados || []).map(a => a.idestudiante);

      // Buscar estudiantes que NO estén en esa lista
      let query = supabase.from("estudiantes").select("idestudiante, apellidosnombres");
      if (idsAsignados.length > 0) {
        query = query.not("idestudiante", "in", `(${idsAsignados.join(",")})`);
      }

      const { data: disponibles, error: errorDisponibles } = await query;
      if (errorDisponibles) throw errorDisponibles;

      return res.json({ ok: true, data: disponibles });
    }

    // --- REGISTRAR DOCENTE (inserta una fila por relacion docente->estudiante)
    if (action === "registrar") {
      if (req.method !== "POST")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { idEstudiante, NombreDocente, DNIDocente, Email, Telefono, GradoSeccionLabora } = req.body;
      if (!idEstudiante || !NombreDocente || !DNIDocente || !Email)
        return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios" });

      // obtener institución del estudiante
      const { data: stud, error: errStud } = await supabase
        .from("estudiantes")
        .select("idinstitucioneducativa")
        .eq("idestudiante", idEstudiante)
        .maybeSingle();
      if (errStud) throw errStud;
      if (!stud) return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado" });

      const { data: inserted, error: errIns } = await supabase
        .from("docentes_estudiante")
        .insert([{
          idestudiante: idEstudiante,
          nombredocente: NombreDocente,
          dnidocente: DNIDocente,
          email: Email,
          telefono: Telefono || null,
          gradoseccionlabora: GradoSeccionLabora || null,
          idinstitucioneducativa: stud.idinstitucioneducativa,
        }])
        .select()
        .single();

      if (errIns) throw errIns;

      return res.json({ ok: true, mensaje: "Docente registrado", data: inserted });
    }

    // --- ACTUALIZAR DOCENTE
    // Expect: body { DNIDocente, NombreDocente, Email, Telefono, GradoSeccionLabora, idEstudiante: [..] }
    if (action === "actualizar") {
      if (req.method !== "PUT")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { DNIDocente, NombreDocente, Email, Telefono, GradoSeccionLabora, idEstudiante } = req.body;
      if (!DNIDocente || !NombreDocente || !Email || !Array.isArray(idEstudiante))
        return res.status(400).json({ ok: false, mensaje: "Campos inválidos" });

      // obtener instituciones de estudiantes (para insertar nuevas filas con idinstitucioneducativa)
      const { data: instRows, error: errInsts } = await supabase
        .from("estudiantes")
        .select("idestudiante, idinstitucioneducativa")
        .in("idestudiante", idEstudiante);
      if (errInsts) throw errInsts;
      const instMap = new Map((instRows || []).map(r => [r.idestudiante, r.idinstitucioneducativa]));

      // asignaciones actuales del DNIDocente
      const { data: currentRows, error: errCurrent } = await supabase
        .from("docentes_estudiante")
        .select("iddocente, idestudiante")
        .eq("dnidocente", DNIDocente);
      if (errCurrent) throw errCurrent;

      const currentMap = new Map((currentRows || []).map(r => [r.idestudiante, r.iddocente]));

      const toDelete = (currentRows || []).filter(r => !idEstudiante.includes(r.idestudiante)).map(r => r.iddocente);
      const toAdd = idEstudiante.filter(id => !currentMap.has(id));

      // actualizar datos base (para todas las filas con mismo DNIDocente)
      const { error: errUpdate } = await supabase
        .from("docentes_estudiante")
        .update({
          nombredocente: NombreDocente,
          email: Email,
          telefono: Telefono || null,
          gradoseccionlabora: GradoSeccionLabora || null,
        })
        .eq("dnidocente", DNIDocente);
      if (errUpdate) throw errUpdate;

      // borrar sobrantes
      if (toDelete.length) {
        const { error: errDel } = await supabase
          .from("docentes_estudiante")
          .delete()
          .in("iddocente", toDelete);
        if (errDel) throw errDel;
      }

      // insertar nuevos
      if (toAdd.length) {
        const values = toAdd.map(idEst => ({
          idestudiante: idEst,
          nombredocente: NombreDocente,
          dnidocente: DNIDocente,
          email: Email,
          telefono: Telefono || null,
          gradoseccionlabora: GradoSeccionLabora || null,
          idinstitucioneducativa: instMap.get(idEst) ?? null,
        }));
        const { error: errIns } = await supabase.from("docentes_estudiante").insert(values);
        if (errIns) throw errIns;
      }

      return res.json({ ok: true, mensaje: "Docente actualizado" });
    }

    // --- ELIMINAR DOCENTE (borrar todas las filas relacionadas a un DNIDocente a partir de un id single)
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

    // --- BUSCAR DOCENTE (retorna info y lista de idEstudiante)
    if (action === "buscar") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { nombreDocente } = req.query;
      if (!nombreDocente)
        return res.status(400).json({ ok: false, mensaje: "Se requiere nombreDocente" });

      // buscar por nombre exacto (igual que tu versión) -> luego traer todas las filas por dni
      const { data: baseRows, error: errBase } = await supabase
        .from("docentes_estudiante")
        .select("dnidocente")
        .eq("nombredocente", nombreDocente)
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

      const any = rows[0];
      return res.json({
        ok: true,
        data: {
          DNIDocente: any.dnidocente,
          NombreDocente: any.nombredocente,
          Email: any.email,
          Telefono: any.telefono,
          GradoSeccionLabora: any.gradoseccionlabora,
          idEstudiante: rows.map(r => r.idestudiante),
        },
      });
    }

    return res.status(400).json({ ok: false, mensaje: "Acción inválida" });
  } catch (err) {
    console.error("Error docentes:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
}
