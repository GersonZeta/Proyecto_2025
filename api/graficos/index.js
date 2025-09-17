// src/pages/api/graficos/index.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  const { action } = req.query;
  const idInst = req.query.idInstitucionEducativa ? Number(req.query.idInstitucionEducativa) : null;

  try {
    // --- 1) Discapacidad ---
    if (action === "discapacidad") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      let query = supabase.from("estudiantes").select("tipodiscapacidad,TipoDiscapacidad,idinstitucioneducativa");
      if (idInst) query = query.eq("idinstitucioneducativa", idInst);

      const { data, error } = await query;
      if (error) throw error;

      const counts = new Map();
      (data || []).forEach(row => {
        // tratar distintas capitalizaciones y valores vacíos
        const raw = (row.tipodiscapacidad ?? row.TipoDiscapacidad ?? "").toString().trim();
        const key = raw ? raw : "Sin especificar";
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      const result = Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      return res.json({ ok: true, data: result });
    }

    // --- 2) IPP vs PEP ---
    if (action === "ipp-pep") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      let query = supabase.from("estudiantes").select("ipp,pep,idinstitucioneducativa");
      if (idInst) query = query.eq("idinstitucioneducativa", idInst);

      const { data, error } = await query;
      if (error) throw error;

      let ippSi = 0, ippNo = 0, pepSi = 0, pepNo = 0, ippNS = 0, pepNS = 0;
      (data || []).forEach(r => {
        const ipp = (r.ipp ?? r.IPP ?? "").toString().trim().toLowerCase();
        const pep = (r.pep ?? r.PEP ?? "").toString().trim().toLowerCase();

        if (ipp === "si") ippSi++;
        else if (ipp === "no") ippNo++;
        else ippNS++;

        if (pep === "si") pepSi++;
        else if (pep === "no") pepNo++;
        else pepNS++;
      });

      return res.json({
        ok: true,
        data: { ippSi, ippNo, ippNoEspecificado: ippNS, pepSi, pepNo, pepNoEspecificado: pepNS }
      });
    }

    // --- 3) Alumnos por institución ---
    if (action === "instituciones") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      // traer instituciones (id + nombre)
      const { data: instituciones, error: errI } = await supabase
        .from("instituciones_educativas")
        .select("idinstitucioneducativa,nombreinstitucion");
      if (errI) throw errI;

      // traer estudiantes (posible filtro por idInstitucionEducativa)
      let estudiantesQuery = supabase.from("estudiantes").select("idestudiante,idinstitucioneducativa");
      if (idInst) estudiantesQuery = estudiantesQuery.eq("idinstitucioneducativa", idInst);
      const { data: estudiantes, error: errE } = await estudiantesQuery;
      if (errE) throw errE;

      const counts = new Map();
      (instituciones || []).forEach(inst => {
        const id = inst.idinstitucioneducativa ?? inst.idInstitucionEducativa;
        const name = inst.nombreinstitucion ?? inst.NombreInstitucion ?? `Inst ${id}`;
        counts.set(Number(id), { label: name, value: 0 });
      });

      (estudiantes || []).forEach(s => {
        const idInstAlumno = s.idinstitucioneducativa ?? s.idInstitucionEducativa;
        const key = Number(idInstAlumno);
        if (counts.has(key)) {
          counts.get(key).value++;
        } else {
          // si aparece institución no conocida, agrupar en "No especificado"
          const noKey = "no_especificado";
          if (!counts.has(noKey)) counts.set(noKey, { label: "No especificado", value: 0 });
          counts.get(noKey).value++;
        }
      });

      const result = Array.from(counts.values()).sort((a, b) => b.value - a.value);
      return res.json({ ok: true, data: result });
    }

    // --- 4) Familias por ocupación ---
    if (action === "ocupacion-familia") {
      if (req.method !== "GET")
        return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

      // Si la tabla tiene idInstitucion, aplicamos el filtro; si no, ignoramos
      let query = supabase.from("familia_estudiante").select("ocupacion,idinstitucioneducativa");
      if (idInst) query = query.eq("idinstitucioneducativa", idInst);

      const { data, error } = await query;
      if (error) throw error;

      const counts = new Map();
      (data || []).forEach(row => {
        const raw = (row.ocupacion ?? row.Ocupacion ?? "").toString().trim();
        const key = raw ? raw : "No especificado";
        counts.set(key, (counts.get(key) || 0) + 1);
      });

      const result = Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      return res.json({ ok: true, data: result });
    }

    return res.status(400).json({ ok: false, mensaje: "Acción inválida" });
  } catch (err) {
    console.error("Error graficos:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno", error: err?.message ?? String(err) });
  }
}
