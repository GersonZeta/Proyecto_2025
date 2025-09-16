import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // --- LISTAR / familias-estudiante
    if (action === "listar") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const idInstitucionEducativa = req.query.idInstitucionEducativa;

      let query = supabase
        .from("familia_estudiante")
        .select(`
          idfamilia,
          idestudiante,
          nombremadreapoderado,
          dni,
          direccion,
          telefono,
          ocupacion,
          idinstitucioneducativa
        `);

      if (idInstitucionEducativa) query = query.eq("idinstitucioneducativa", idInstitucionEducativa);

      query = query
        .order("dni", { ascending: true })
        .order("idfamilia", { ascending: true })
        .order("idestudiante", { ascending: true });

      const { data: familias = [], error: familiasError } = await query;
      if (familiasError) throw familiasError;

      // obtener nombres de estudiantes en batch
      const estudiantesIds = Array.from(new Set(familias.map(f => f.idestudiante).filter(Boolean)));
      let estudiantesMap = new Map();
      if (estudiantesIds.length) {
        const { data: estudiantes = [], error: estudiantesError } = await supabase
          .from("estudiantes")
          .select("idestudiante, apellidosnombres")
          .in("idestudiante", estudiantesIds);
        if (estudiantesError) throw estudiantesError;
        estudiantes.forEach(e => estudiantesMap.set(e.idestudiante, e.apellidosnombres));
      }

      const familiasConEstudiantes = familias.map(f => ({
        idfamilia: f.idfamilia,
        idestudiante: f.idestudiante,
        nombremadreapoderado: f.nombremadreapoderado,
        dni: f.dni,
        direccion: f.direccion,
        telefono: f.telefono,
        ocupacion: f.ocupacion,
        idinstitucioneducativa: f.idinstitucioneducativa,
        NombreEstudiante: estudiantesMap.get(f.idestudiante) ?? "No asignado",
      }));

      return res.json({ ok: true, data: familiasConEstudiantes });
    }

    // --- REGISTRAR (soporta array idEstudiantes o único idEstudiante)
    if (action === "registrar") {
      if (req.method !== "POST")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const {
        idEstudiante,        // compat con petición antigua (único)
        idEstudiantes,       // nuevo: array de ids
        NombreMadreApoderado,
        DNI,
        Direccion,
        Telefono,
        Ocupacion,
        idInstitucionEducativa // opcional
      } = req.body;

      // caso array
      if (Array.isArray(idEstudiantes) && idEstudiantes.length > 0) {
        if (!NombreMadreApoderado || !DNI) {
          return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios (NombreMadreApoderado o DNI)" });
        }

        // validar estudiantes y obtener instituciones
        const { data: students = [], error: studentsError } = await supabase
          .from("estudiantes")
          .select("idestudiante, idinstitucioneducativa")
          .in("idestudiante", idEstudiantes);
        if (studentsError) throw studentsError;

        if (!students || students.length !== idEstudiantes.length) {
          return res.status(404).json({ ok: false, mensaje: "Algún estudiante no fue encontrado" });
        }

        // inferir idinstitucioneducativa si no llegó
        let idInst = idInstitucionEducativa;
        if (!idInst) {
          const uniq = [...new Set(students.map(s => s.idinstitucioneducativa))];
          if (uniq.length > 1) {
            return res.status(400).json({
              ok: false,
              mensaje: "Los estudiantes pertenecen a distintas instituciones. Proporciona idInstitucionEducativa o usa estudiantes de la misma institución."
            });
          }
          idInst = uniq[0];
        }

        const rows = idEstudiantes.map(id => ({
          idestudiante: id,
          nombremadreapoderado: NombreMadreApoderado,
          dni: DNI,
          direccion: Direccion || null,
          telefono: Telefono || null,
          ocupacion: Ocupacion || null,
          idinstitucioneducativa: idInst || null
        }));

        const { data: inserted = [], error: insertError } = await supabase
          .from("familia_estudiante")
          .insert(rows)
          .select();
        if (insertError) throw insertError;

        return res.status(201).json({ ok: true, inserted: inserted.length, familias: inserted });
      }

      // caso único (compat)
      if (!idEstudiante || !NombreMadreApoderado || !DNI) {
        return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios" });
      }

      const { data: estudiante, error: errEstudiante } = await supabase
        .from("estudiantes")
        .select("idinstitucioneducativa")
        .eq("idestudiante", idEstudiante)
        .maybeSingle();
      if (errEstudiante) throw errEstudiante;
      if (!estudiante) return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado" });

      const idinstitucioneducativa = estudiante.idinstitucioneducativa;

      const { data: dataIns = [], error: errInsert } = await supabase
        .from("familia_estudiante")
        .insert([{
          idestudiante: idEstudiante,
          nombremadreapoderado: NombreMadreApoderado,
          dni: DNI,
          direccion: Direccion || null,
          telefono: Telefono || null,
          ocupacion: Ocupacion || null,
          idinstitucioneducativa
        }])
        .select();
      if (errInsert) throw errInsert;

      return res.status(201).json({ ok: true, idFamilia: dataIns[0]?.idfamilia, familia: dataIns[0] });
    }

    // --- ACTUALIZAR (actualizar familia: agrupar por dni o idfamilia, manejar inserciones/eliminaciones)
    if (action === "actualizar") {
      if (req.method !== "PUT")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const idFamilia = req.body.idFamilia || req.body.idfamilia || null;
      const idEstudiantes = req.body.idEstudiantes || req.body.idestudiantes;
      const NombreMadreApoderado = req.body.NombreMadreApoderado || req.body.nombremadreapoderado;
      const DNI = req.body.DNI || req.body.dni;
      const Direccion = req.body.Direccion || req.body.direccion || null;
      const Telefono = req.body.Telefono || req.body.telefono || null;
      const Ocupacion = req.body.Ocupacion || req.body.ocupacion || null;
      const idInstitucionEducativa = req.body.idInstitucionEducativa || req.body.idinstitucioneducativa || null;

      if (!idEstudiantes || !Array.isArray(idEstudiantes) || !NombreMadreApoderado || !DNI) {
        return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios o idEstudiantes no es array" });
      }

      const validIds = idEstudiantes
        .map(i => (typeof i === "string" ? i.trim() : i))
        .map(i => Number(i))
        .filter(id => id != null && !isNaN(id));

      if (validIds.length === 0) {
        return res.status(400).json({ ok: false, mensaje: "No hay estudiantes válidos para asignar" });
      }

      // determinar dniClave (si se dio idFamilia se usa el DNI actual en BD como agrupador)
      let dniClave = (DNI || "").toString().trim();

      if (idFamilia) {
        const { data: rowById, error: errRow } = await supabase
          .from("familia_estudiante")
          .select("dni, idinstitucioneducativa")
          .eq("idfamilia", idFamilia)
          .maybeSingle();
        if (!errRow && rowById) {
          dniClave = (rowById.dni || "").toString().trim();
        }
        // si error, seguimos usando DNI del body
      }

      if (!dniClave) {
        return res.status(400).json({ ok: false, mensaje: "No se pudo determinar el DNI clave para agrupar la familia" });
      }

      // scope por institución si aplica
      const hasInstitution = !!idInstitucionEducativa;

      // 1) actualizar datos comunes
      let updQuery = supabase.from("familia_estudiante").update({
        nombremadreapoderado: NombreMadreApoderado,
        dni: DNI,
        direccion: Direccion,
        telefono: Telefono,
        ocupacion: Ocupacion
      }).eq("dni", dniClave);

      if (hasInstitution) updQuery = updQuery.eq("idinstitucioneducativa", idInstitucionEducativa);

      const { error: errUpdate } = await updQuery;
      if (errUpdate) throw errUpdate;

      // 2) leer filas actuales
      let selectQuery = supabase
        .from("familia_estudiante")
        .select("idfamilia, idestudiante")
        .eq("dni", dniClave);

      if (hasInstitution) selectQuery = selectQuery.eq("idinstitucioneducativa", idInstitucionEducativa);

      const { data: currentRows = [], error: errSelect } = await selectQuery;
      if (errSelect) throw errSelect;

      const currentIds = Array.isArray(currentRows) ? currentRows.map(r => Number(r.idestudiante)).filter(n => !isNaN(n)) : [];

      // 3) calcular diferencias
      const toDeleteIds = currentIds.filter(id => !validIds.includes(id));
      const toInsertIds = validIds.filter(id => !currentIds.includes(id));

      // 4) eliminar relaciones sobrantes
      if (toDeleteIds.length > 0) {
        let delQ = supabase.from("familia_estudiante")
          .delete()
          .eq("dni", dniClave)
          .in("idestudiante", toDeleteIds);
        if (hasInstitution) delQ = delQ.eq("idinstitucioneducativa", idInstitucionEducativa);
        const { error: errDel } = await delQ;
        if (errDel) throw errDel;
      }

      // 5) insertar nuevas relaciones
      if (toInsertIds.length > 0) {
        const insertData = toInsertIds.map(idEst => ({
          idestudiante: idEst,
          nombremadreapoderado: NombreMadreApoderado,
          dni: DNI,
          direccion: Direccion,
          telefono: Telefono,
          ocupacion: Ocupacion,
          idinstitucioneducativa: idInstitucionEducativa
        }));
        const { error: errIns } = await supabase.from("familia_estudiante").insert(insertData);
        if (errIns) throw errIns;
      }

      return res.status(200).json({ ok: true, mensaje: "Familia actualizada con éxito" });
    }

    // --- ELIMINAR (borrar todas las filas relacionadas a un idFamilia y liberar estudiantes)
    if (action === "eliminar") {
      if (req.method !== "DELETE") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const id = req.query.id;
      const idFamilia = Number(id);
      if (!id || isNaN(idFamilia)) return res.status(400).json({ ok: false, mensaje: "ID inválido" });

      // 1) actualizar estudiantes -> poner idfamilia = null (si esa columna existe en tu esquema)
      const { error: errUpd } = await supabase
        .from("estudiantes")
        .update({ idfamilia: null })
        .eq("idfamilia", idFamilia);
      if (errUpd) throw errUpd;

      // 2) eliminar filas en familia_estudiante con ese idfamilia
      const { data: deleted = [], error: errDel } = await supabase
        .from("familia_estudiante")
        .delete()
        .eq("idfamilia", idFamilia)
        .select();
      if (errDel) throw errDel;

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ ok: false, mensaje: "Familia no encontrada o ya eliminada" });
      }

      return res.json({ ok: true, mensaje: "Familia eliminada y estudiantes liberados", count: deleted.length });
    }

    // --- BUSCAR (buscar-familia)
    if (action === "buscar") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const { nombreMadreApoderado, idInstitucionEducativa } = req.query;
      if (!nombreMadreApoderado) return res.status(400).json({ ok: false, mensaje: "Falta nombreMadreApoderado" });

      // 1) obtener idfamilia del primer registro (opcional scope por institución)
      let baseQ = supabase
        .from("familia_estudiante")
        .select("idfamilia")
        .eq("nombremadreapoderado", nombreMadreApoderado)
        .limit(1);
      if (idInstitucionEducativa) baseQ = baseQ.eq("idinstitucioneducativa", idInstitucionEducativa);

      const { data: baseRows = [], error: errBase } = await baseQ;
      if (errBase) throw errBase;
      if (!baseRows || baseRows.length === 0) return res.status(404).json({ ok: false, mensaje: "Familia no encontrada" });

      const idfamilia = baseRows[0].idfamilia;

      // 2) traer todas las filas con ese idfamilia, incluyendo nombre de estudiante si FK configurado
      const { data: rows = [], error: errAll } = await supabase
        .from("familia_estudiante")
        .select(`
          idfamilia,
          idestudiante,
          estudiantes(apellidosnombres),
          nombremadreapoderado,
          dni,
          direccion,
          telefono,
          ocupacion
        `)
        .eq("idfamilia", idfamilia);
      if (errAll) throw errAll;
      if (!rows || rows.length === 0) return res.status(404).json({ ok: false, mensaje: "Familia no encontrada" });

      const any = rows[0];
      const estudiantes = rows.map(r => {
        if (Array.isArray(r.estudiantes)) return r.estudiantes[0]?.apellidosnombres ?? null;
        return r.estudiantes?.apellidosnombres ?? null;
      }).filter(Boolean);

      return res.json({
        ok: true,
        idfamilia: any.idfamilia,
        NombreMadreApoderado: any.nombremadreapoderado,
        DNI: any.dni,
        Direccion: any.direccion,
        Telefono: any.telefono,
        Ocupacion: any.ocupacion,
        idEstudiantes: rows.map(r => r.idestudiante),
        Estudiantes: estudiantes
      });
    }

    // --- estudiantes-con-familia (retorna array unique de idestudiante)
    if (action === "estudiantes-con-familia") {
      if (req.method !== "GET") return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      const idInstitucionEducativa = req.query.idInstitucionEducativa;

      let q = supabase.from("familia_estudiante").select("idestudiante");
      if (idInstitucionEducativa) q = q.eq("idinstitucioneducativa", idInstitucionEducativa);

      const { data = [], error } = await q;
      if (error) throw error;

      const estudiantesUnicos = [...new Set(data.map(f => f.idestudiante))];

      return res.json({ ok: true, estudiantes: estudiantesUnicos });
    }

    return res.status(400).json({ ok: false, mensaje: "Acción inválida" });
  } catch (err) {
    console.error("Error familias:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno", detalle: err?.message || err });
  }
}
