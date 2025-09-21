// // src/pages/api/estudiantes/index.js
// import { supabase } from "../supabase.js";

// export default async function handler(req, res) {
//   const { action } = req.query;

//   try {
//     // --- LISTAR ESTUDIANTES
//     if (action === "listar") {
//       if (req.method !== "GET")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const idInstitucion = req.query.idInstitucionEducativa;
//       let query = supabase.from("estudiantes").select("*");

//       if (idInstitucion) {
//         query = query.eq("idinstitucioneducativa", idInstitucion);
//       }

//       const { data: results, error } = await query.order("idestudiante", { ascending: true });
//       if (error) throw error;

//       const formatted = (results || []).map((r) => {
//         let FechaNacimiento = null;
//         if (r.fechanacimiento) {
//           const d = new Date(r.fechanacimiento);
//           if (!Number.isNaN(d.getTime())) {
//             const dd = `${d.getDate()}`.padStart(2, "0");
//             const mm = `${d.getMonth() + 1}`.padStart(2, "0");
//             const yyyy = d.getFullYear();
//             FechaNacimiento = `${dd}/${mm}/${yyyy}`;
//           }
//         }
//         return {
//           idEstudiante: r.idestudiante,
//           ApellidosNombres: r.apellidosnombres,
//           FechaNacimiento,
//           Edad: r.edad,
//           DNI: r.dni,
//           GradoSeccion: r.gradoseccion,
//           TipoDiscapacidad: r.tipodiscapacidad,
//           DocumentoSustentatorio: r.documentosustentatorio,
//           DocumentoInclusiva: r.documentoinclusiva,
//           IPP: r.ipp,
//           PEP: r.pep,
//           idInstitucionEducativa: r.idinstitucioneducativa,
//         };
//       });

//       return res.json({ ok: true, data: formatted });
//     }

//     // --- BUSCAR ESTUDIANTE POR ID O DNI
//     if (action === "buscar") {
//       if (req.method !== "GET")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const { idEstudiante, DNI } = req.query;
//       if (!idEstudiante && !DNI) {
//         return res.status(400).json({ ok: false, mensaje: "Falta idEstudiante o DNI" });
//       }

//       let query = supabase.from("estudiantes").select("*").maybeSingle();
//       if (idEstudiante) query = query.eq("idestudiante", idEstudiante);
//       else query = query.eq("dni", DNI);

//       const { data: est, error } = await query;
//       if (error) throw error;
//       if (!est) return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado" });

//       let FechaNacimiento = null;
//       if (est.fechanacimiento) {
//         const d = new Date(est.fechanacimiento);
//         if (!Number.isNaN(d.getTime())) {
//           const dd = `${d.getDate()}`.padStart(2, "0");
//           const mm = `${d.getMonth() + 1}`.padStart(2, "0");
//           const yyyy = d.getFullYear();
//           FechaNacimiento = `${dd}/${mm}/${yyyy}`;
//         }
//       }

//       return res.json({
//         ok: true,
//         data: {
//           idEstudiante: est.idestudiante,
//           ApellidosNombres: est.apellidosnombres,
//           FechaNacimiento,
//           Edad: est.edad,
//           DNI: est.dni,
//           GradoSeccion: est.gradoseccion,
//           TipoDiscapacidad: est.tipodiscapacidad,
//           DocumentoSustentatorio: est.documentosustentatorio,
//           DocumentoInclusiva: est.documentoinclusiva,
//           IPP: est.ipp,
//           PEP: est.pep,
//           idInstitucionEducativa: est.idinstitucioneducativa,
//         },
//       });
//     }

//     // --- REGISTRAR ESTUDIANTE
//     if (action === "registrar") {
//       if (req.method !== "POST")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const {
//         ApellidosNombres,
//         FechaNacimiento,
//         Edad,
//         DNI,
//         GradoSeccion,
//         TipoDiscapacidad,
//         DocumentoSustentatorio,
//         DocumentoInclusiva,
//         IPP,
//         PEP,
//         idInstitucionEducativa,
//       } = req.body;

//       if (!ApellidosNombres || !FechaNacimiento || !Edad || !DNI || !GradoSeccion || !idInstitucionEducativa) {
//         return res.status(400).json({ ok: false, mensaje: "Faltan campos obligatorios" });
//       }

//       const parts = FechaNacimiento.split("/");
//       if (parts.length !== 3)
//         return res.status(400).json({ ok: false, mensaje: "Formato de fecha inválido" });

//       const fechaISO = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
//       const ippValue = ["si", "SI", "Si", true].includes(IPP) ? "Si" : "No";
//       const pepValue = ["si", "SI", "Si", true].includes(PEP) ? "Si" : "No";

//       const { data, error } = await supabase
//         .from("estudiantes")
//         .insert([
//           {
//             apellidosnombres: ApellidosNombres,
//             fechanacimiento: fechaISO,
//             edad: Edad,
//             dni: DNI,
//             gradoseccion: GradoSeccion,
//             tipodiscapacidad: TipoDiscapacidad || null,
//             documentosustentatorio: DocumentoSustentatorio || null,
//             documentoinclusiva: DocumentoInclusiva || null,
//             ipp: ippValue,
//             pep: pepValue,
//             idinstitucioneducativa: idInstitucionEducativa,
//           },
//         ])
//         .select()
//         .single();

//       if (error) throw error;

//       return res.json({
//         ok: true,
//         mensaje: "Estudiante registrado",
//         data,
//       });
//     }

//     // --- ACTUALIZAR ESTUDIANTE
//     if (action === "actualizar") {
//       if (req.method !== "PUT")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const {
//         idEstudiante,
//         ApellidosNombres,
//         FechaNacimiento,
//         Edad,
//         DNI,
//         GradoSeccion,
//         TipoDiscapacidad,
//         DocumentoSustentatorio,
//         DocumentoInclusiva,
//         IPP,
//         PEP,
//       } = req.body;

//       if (!idEstudiante)
//         return res.status(400).json({ ok: false, mensaje: "Falta idEstudiante" });

//       const parts = FechaNacimiento.split("/");
//       if (parts.length !== 3)
//         return res.status(400).json({ ok: false, mensaje: "Formato de fecha inválido" });

//       const fechaISO = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
//       const ippValue = ["si", "SI", "Si", true].includes(IPP) ? "Si" : "No";
//       const pepValue = ["si", "SI", "Si", true].includes(PEP) ? "Si" : "No";

//       const { error } = await supabase
//         .from("estudiantes")
//         .update({
//           apellidosnombres: ApellidosNombres,
//           fechanacimiento: fechaISO,
//           edad: Edad,
//           dni: DNI,
//           gradoseccion: GradoSeccion,
//           tipodiscapacidad: TipoDiscapacidad || null,
//           documentosustentatorio: DocumentoSustentatorio || null,
//           documentoinclusiva: DocumentoInclusiva || null,
//           ipp: ippValue,
//           pep: pepValue,
//         })
//         .eq("idestudiante", idEstudiante);

//       if (error) throw error;

//       return res.json({ ok: true, mensaje: "Estudiante actualizado" });
//     }

//     // --- ELIMINAR ESTUDIANTE
//     if (action === "eliminar") {
//       if (req.method !== "DELETE")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const { id } = req.query;
//       if (!id) return res.status(400).json({ ok: false, mensaje: "Falta id" });

//       const { data: deletedRows, error } = await supabase
//         .from("estudiantes")
//         .delete()
//         .eq("idestudiante", id)
//         .select();

//       if (error) throw error;
//       if (!deletedRows || deletedRows.length === 0)
//         return res.status(404).json({ ok: false, mensaje: "Estudiante no encontrado" });

//       return res.json({
//         ok: true,
//         mensaje: "Estudiante eliminado",
//         data: deletedRows[0],
//       });
//     }

//     // --- ACCIÓN INVÁLIDA
//     return res.status(400).json({ ok: false, mensaje: "Acción inválida" });
//   } catch (err) {
//     console.error("Error estudiantes:", err);
//     return res.status(500).json({ ok: false, mensaje: "Error interno" });
//   }
// }
