// // src/pages/api/profesores/index.js
// import { supabase } from "../supabase.js";

// export default async function handler(req, res) {
//   const { action } = req.query;

//   try {
//     // --- LISTAR TODOS LOS PROFESORES
//     if (action === "listar") {
//       if (req.method !== "GET")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const { data: profesores, error } = await supabase
//         .from("profesores_saanee")
//         .select("*");
//       if (error) throw error;

//       const profesoresConInst = await Promise.all(
//         profesores.map(async (prof) => {
//           const { data: insts, error: instError } = await supabase
//             .from("profesores_saanee_institucion")
//             .select("idinstitucioneducativa")
//             .eq("idprofesorsaanee", prof.idprofesorsaanee);
//           if (instError) throw instError;

//           return {
//             ...prof,
//             instituciones: insts.map((i) => i.idinstitucioneducativa),
//           };
//         })
//       );

//       return res.json({ ok: true, data: profesoresConInst });
//     }

//     // --- BUSCAR PROFESOR POR NOMBRE
//     if (action === "buscar") {
//       if (req.method !== "GET")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const nombre = req.query.nombreProfesor;
//       if (!nombre)
//         return res
//           .status(400)
//           .json({ ok: false, mensaje: "Falta nombreProfesor" });

//       const { data: profs, error } = await supabase
//         .from("profesores_saanee")
//         .select("*")
//         .ilike("nombreprofesorsaanee", `%${nombre}%`);

//       if (error) throw error;
//       if (!profs || profs.length === 0)
//         return res
//           .status(404)
//           .json({ ok: false, mensaje: "Profesor no encontrado" });

//       const prof = profs[0];

//       const { data: insts, error: instError } = await supabase
//         .from("profesores_saanee_institucion")
//         .select("idinstitucioneducativa")
//         .eq("idprofesorsaanee", prof.idprofesorsaanee);
//       if (instError) throw instError;

//       return res.json({
//         ok: true,
//         data: {
//           ...prof,
//           instituciones: insts.map((i) => i.idinstitucioneducativa),
//         },
//       });
//     }

//     // --- REGISTRAR PROFESOR
//     if (action === "registrar") {
//       if (req.method !== "POST")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const {
//         correo,
//         nombreprofesorsaanee,
//         clave,
//         telefonosaanee,
//         instituciones,
//       } = req.body;

//       if (!correo || !nombreprofesorsaanee || !clave) {
//         return res
//           .status(400)
//           .json({ ok: false, mensaje: "Faltan datos obligatorios" });
//       }

//       const { data: prof, error } = await supabase
//         .from("profesores_saanee")
//         .insert([{ correo, nombreprofesorsaanee, clave, telefonosaanee }])
//         .select()
//         .single();
//       if (error) throw error;

//       if (instituciones && instituciones.length > 0) {
//         const instInsert = instituciones.map((id) => ({
//           idprofesorsaanee: prof.idprofesorsaanee,
//           idinstitucioneducativa: id,
//         }));
//         const { error: instError } = await supabase
//           .from("profesores_saanee_institucion")
//           .insert(instInsert);
//         if (instError) throw instError;
//       }

//       return res.json({
//         ok: true,
//         mensaje: "Profesor registrado",
//         data: prof,
//       });
//     }

//     // --- ACTUALIZAR PROFESOR
//     if (action === "actualizar") {
//       if (req.method !== "PUT")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const {
//         idprofesorsaanee,
//         correo,
//         nombreprofesorsaanee,
//         clave,
//         telefonosaanee,
//         instituciones,
//       } = req.body;

//       if (!idprofesorsaanee)
//         return res
//           .status(400)
//           .json({ ok: false, mensaje: "Falta idprofesorsaanee" });

//       const { error } = await supabase
//         .from("profesores_saanee")
//         .update({ correo, nombreprofesorsaanee, clave, telefonosaanee })
//         .eq("idprofesorsaanee", idprofesorsaanee);
//       if (error) throw error;

//       // limpiar instituciones antiguas
//       const { error: delError } = await supabase
//         .from("profesores_saanee_institucion")
//         .delete()
//         .eq("idprofesorsaanee", idprofesorsaanee);
//       if (delError) throw delError;

//       // insertar nuevas
//       if (instituciones && instituciones.length > 0) {
//         const instInsert = instituciones.map((id) => ({
//           idprofesorsaanee,
//           idinstitucioneducativa: id,
//         }));
//         const { error: instError } = await supabase
//           .from("profesores_saanee_institucion")
//           .insert(instInsert);
//         if (instError) throw instError;
//       }

//       return res.json({ ok: true, mensaje: "Profesor actualizado" });
//     }

//     // --- LOGIN PROFESOR SAANEE
//     if (action === "login") {
//       if (req.method !== "POST")
//         return res.status(405).json({ ok: false, mensaje: "Método no permitido" });

//       const { correo, nombre, clave } = req.body;
//       if (!correo || !nombre || !clave) {
//         return res.status(400).json({
//           ok: false,
//           mensaje: "Faltan datos (correo, nombre o clave)",
//         });
//       }

//       const { data: profs, error } = await supabase
//         .from("profesores_saanee")
//         .select("*")
//         .eq("correo", correo.trim().toLowerCase())
//         .eq("clave", clave.trim());

//       if (error) throw error;
//       if (!profs || profs.length === 0) {
//         return res
//           .status(401)
//           .json({ ok: false, mensaje: "Correo o clave incorrectos" });
//       }

//       const prof = profs.find(
//         (p) =>
//           p.nombreprofesorsaanee.trim().toLowerCase() ===
//           nombre.trim().toLowerCase()
//       );
//       if (!prof) {
//         return res.status(401).json({ ok: false, mensaje: "Nombre incorrecto" });
//       }

//       // instituciones del profesor
//       const { data: insts, error: instError } = await supabase
//         .from("profesores_saanee_institucion")
//         .select("idinstitucioneducativa")
//         .eq("idprofesorsaanee", prof.idprofesorsaanee);
//       if (instError) throw instError;

//       return res.json({
//         ok: true,
//         data: {
//           idProfesor: prof.idprofesorsaanee,
//           Correo: prof.correo,
//           NombreProfesor: prof.nombreprofesorsaanee,
//           Clave: prof.clave,
//           TelefonoProf: prof.telefonosaanee,
//           Instituciones: insts.map((i) => i.idinstitucioneducativa),
//         },
//       });
//     }

//     return res.status(400).json({ ok: false, mensaje: "Acción inválida" });
//   } catch (err) {
//     console.error("Error profesores:", err);
//     return res.status(500).json({ ok: false, mensaje: "Error interno" });
//   }
// }
