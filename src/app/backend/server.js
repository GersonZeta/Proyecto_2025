// // server.js
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const nodemailer = require("nodemailer");
// const { supabase } = require("./supabase"); // cliente Supabase
// const app = express();
// const port = process.env.PORT || 3000;

// app.use(express.json());
// app.use(cors());
// ////////////// CONFIGURACION DE HOME //////////////

// // Configuración de correo
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.GMAIL_USER,
//     pass: process.env.GMAIL_APP_PASS
//   }
// });


// const ALLOWED_EMAILS = [
//   process.env.GMAIL_USER,
//   "gezetab@ucvvirtual.edu.pe",
//   "gerson29012004@gmail.com"
// ].map(e => e.toLowerCase());

// // Solicitar reset de clave
// app.post("/solicitar-reset", async (req, res) => {
//   try {
//     let { correo } = req.body;
//     if (!correo) return res.status(400).json({ ok: false, mensaje: "Correo requerido" });

//     correo = correo.trim().toLowerCase();

//     if (!ALLOWED_EMAILS.includes(correo)) {
//       return res.status(401).json({ ok: false, mensaje: "Correo no autorizado" });
//     }

//     const token = Math.floor(100000 + Math.random() * 900000).toString();

//     const { data, error } = await supabase
//       .from("administrador")
//       .update({
//         reset_token: token,
//         token_expiracion: new Date(Date.now() + 15 * 60000) // 15 min
//       })
//       .eq("correo", correo)
//       .select();

//     if (error) throw error;

//     if (!data || data.length === 0) {
//       console.log("Correo no encontrado en DB:", correo);
//       return res.status(404).json({ ok: false, mensaje: "Correo no encontrado" });
//     }

//     try {
//       await transporter.sendMail({
//         from: process.env.GMAIL_USER,
//         to: correo,
//         subject: "Tu código de seguridad",
//         text: `Tu código de seguridad es: ${token}`
//       });
//       console.log(`Token enviado a ${correo}: ${token}`);
//     } catch (mailErr) {
//       console.error("Error enviando correo:", mailErr);
//       return res.status(500).json({ ok: false, mensaje: "Error enviando correo" });
//     }

//     return res.json({ ok: true, mensaje: "Token enviado" });

//   } catch (err) {
//     console.error("Error solicitar-reset:", err);
//     return res.status(500).json({ ok: false, mensaje: "No se pudo generar token" });
//   }
// });

// // Resetear clave
// app.post("/reset-security-code", async (req, res) => {
//   try {
//     const { correo, token, nuevaClave } = req.body;
//     if (!correo || !token || !nuevaClave) {
//       return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
//     }

//     const { data, error } = await supabase
//       .from("administrador")
//       .select("reset_token, token_expiracion")
//       .eq("correo", correo.trim().toLowerCase())
//       .single();

//     if (error || !data) return res.status(400).json({ ok: false, mensaje: "Correo inválido" });

//     const { reset_token, token_expiracion } = data;
//     if (reset_token !== token.trim() || new Date(token_expiracion) < new Date()) {
//       return res.status(400).json({ ok: false, mensaje: "Token inválido o expirado" });
//     }

//     const { error: updError } = await supabase
//       .from("administrador")
//       .update({ clave: nuevaClave, reset_token: null, token_expiracion: null })
//       .eq("correo", correo.trim().toLowerCase());

//     if (updError) throw updError;

//     return res.json({ ok: true, mensaje: "Clave cambiada con éxito" });

//   } catch (err) {
//     console.error("Error reset-security-code:", err);
//     return res.status(500).json({ ok: false, mensaje: "Error al cambiar clave" });
//   }
// });

// // Verificar si existe admin
// app.get('/existe-admin', async (req, res) => {
//   try {
//     const { count, error } = await supabase
//       .from('administrador')
//       .select('*', { count: 'exact', head: true });
//     if (error) throw error;
//     res.json({ existe: count > 0 });
//   } catch (err) {
//     res.status(500).json({ error: 'Error servidor', detalle: err.message });
//   }
// });

// // Registrar admin
// app.post("/registrar-admin", async (req, res) => {
//   try {
//     const { correo, clave } = req.body;
//     if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

//     const { error } = await supabase
//       .from("administrador")
//       .insert([{ correo: correo.trim().toLowerCase(), clave }]);

//     if (error) throw error;

//     res.json({ ok: true });
//   } catch (err) {
//     console.error("Error registrar-admin:", err);
//     res.status(500).json({ ok: false, mensaje: "Error al registrar" });
//   }
// });

// // Login admin
// app.post("/login-admin", async (req, res) => {
//   try {
//     const { correo, clave } = req.body;
//     const { data, error } = await supabase
//       .from("administrador")
//       .select("clave")
//       .eq("correo", correo.trim().toLowerCase())
//       .single();

//     if (error || !data) return res.json({ ok: false, mensaje: "Correo no registrado" });

//     if (data.clave === clave) return res.json({ ok: true });
//     else return res.json({ ok: false, mensaje: "Clave incorrecta" });
//   } catch (err) {
//     console.error("Error login-admin:", err);
//     return res.status(500).json({ ok: false, mensaje: "Error servidor" });
//   }
// });






// ////////////// PROFESORES SAANEE //////////////
// // Obtener todos los profesores con sus instituciones
// app.get("/profesores", async (req, res) => {
//   try {
//     const { data: profesores, error } = await supabase
//       .from("profesores_saanee")
//       .select("*");
//     if (error) throw error;

//     // Añadir instituciones a cada profesor
//     const profesoresConInst = await Promise.all(
//       profesores.map(async (prof) => {
//         const { data: insts, error: instError } = await supabase
//           .from("profesores_saanee_institucion")
//           .select("idinstitucioneducativa")
//           .eq("idprofesorsaanee", prof.idprofesorsaanee);
//         if (instError) throw instError;

//         return { ...prof, instituciones: insts.map(i => i.idinstitucioneducativa) };
//       })
//     );

//     res.json(profesoresConInst);
//   } catch (err) {
//     console.error("Error al obtener profesores:", err);
//     res.status(500).json({ error: "Error al obtener profesores" });
//   }
// });

// // Buscar profesor por nombre
// app.get("/buscar-profesor", async (req, res) => {
//   const nombre = req.query.nombreProfesor;
//   if (!nombre) return res.status(400).json({ error: "Falta nombreProfesor" });

//   try {
//     const { data: profs, error } = await supabase
//       .from("profesores_saanee")
//       .select("*")
//       .ilike("nombreprofesorsaanee", `%${nombre}%`);
//     if (error) throw error;
//     if (!profs || profs.length === 0) return res.status(404).json({ error: "Profesor no encontrado" });

//     const prof = profs[0];
//     const { data: insts, error: instError } = await supabase
//       .from("profesores_saanee_institucion")
//       .select("idinstitucioneducativa")
//       .eq("idprofesorsaanee", prof.idprofesorsaanee);
//     if (instError) throw instError;

//     res.json({ ...prof, instituciones: insts.map(i => i.idinstitucioneducativa) });
//   } catch (err) {
//     console.error("Error al buscar profesor:", err);
//     res.status(500).json({ error: "Error al buscar profesor" });
//   }
// });

// // Registrar profesor
// app.post("/registrar-profesor", async (req, res) => {
//   const { correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = req.body;
//   try {
//     const { data: prof, error } = await supabase
//       .from("profesores_saanee")
//       .insert([{ correo, nombreprofesorsaanee, clave, telefonosaanee }])
//       .select()
//       .single();
//     if (error) throw error;

//     if (instituciones && instituciones.length > 0) {
//       const instInsert = instituciones.map(id => ({
//         idprofesorsaanee: prof.idprofesorsaanee,
//         idinstitucioneducativa: id
//       }));
//       const { error: instError } = await supabase
//         .from("profesores_saanee_institucion")
//         .insert(instInsert);
//       if (instError) throw instError;
//     }

//     res.json({ success: true });
//   } catch (err) {
//     console.error("Error al registrar profesor:", err);
//     res.status(500).json({ error: "Error al registrar profesor" });
//   }
// });

// // Actualizar profesor
// app.put("/actualizar-profesor", async (req, res) => {
//   const { idprofesorsaanee, correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = req.body;
//   try {
//     const { error } = await supabase
//       .from("profesores_saanee")
//       .update({ correo, nombreprofesorsaanee, clave, telefonosaanee })
//       .eq("idprofesorsaanee", idprofesorsaanee);
//     if (error) throw error;

//     // Eliminar las antiguas instituciones
//     const { error: delError } = await supabase
//       .from("profesores_saanee_institucion")
//       .delete()
//       .eq("idprofesorsaanee", idprofesorsaanee);
//     if (delError) throw delError;

//     // Insertar nuevas instituciones
//     if (instituciones && instituciones.length > 0) {
//       const instInsert = instituciones.map(id => ({
//         idprofesorsaanee,
//         idinstitucioneducativa: id
//       }));
//       const { error: instError } = await supabase
//         .from("profesores_saanee_institucion")
//         .insert(instInsert);
//       if (instError) throw instError;
//     }

//     res.json({ success: true });
//   } catch (err) {
//     console.error("Error al actualizar profesor:", err);
//     res.status(500).json({ error: "Error al actualizar profesor" });
//   }
// });

// // /////////////////// INSTITUCIONES EDUCATIVAS ///////////////////

// // Instituciones sin asignar
// app.get("/instituciones", async (req, res) => {
//   try {
//     const { data: usedInsts, error: usedError } = await supabase
//       .from("profesores_saanee_institucion")
//       .select("idinstitucioneducativa");
//     if (usedError) throw usedError;

//     const idsUsadas = usedInsts.map(x => x.idinstitucioneducativa);

//     const { data, error } = await supabase
//       .from("instituciones_educativas")
//       .select("idinstitucioneducativa, nombreinstitucion")
//       .not("idinstitucioneducativa", "in", idsUsadas);

//     if (error) throw error;

//     res.json(data);
//   } catch (err) {
//     console.error("Error al obtener instituciones:", err);
//     res.status(500).json({ error: "Error al obtener instituciones" });
//   }
// });

// // Todas las instituciones
// app.get("/instituciones-all", async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from("instituciones_educativas")
//       .select("idinstitucioneducativa, nombreinstitucion");
//     if (error) throw error;
//     res.json(data);
//   } catch (err) {
//     console.error("Error al obtener todas las instituciones:", err);
//     res.status(500).json({ error: "Error al obtener instituciones" });
//   }
// });

// // Instituciones usadas por otros profesores (para editar)
// app.get("/instituciones-no-editables", async (req, res) => {
//   const { idprofesorsaanee } = req.query;
//   if (!idprofesorsaanee) return res.status(400).send("Se requiere idprofesorsaanee");

//   try {
//     const { data, error } = await supabase
//       .from("profesores_saanee_institucion")
//       .select("idinstitucioneducativa")
//       .neq("idprofesorsaanee", idprofesorsaanee);

//     if (error) throw error;
//     res.json(data.map(r => r.idinstitucioneducativa));
//   } catch (err) {
//     console.error("Error al obtener instituciones no editables:", err);
//     res.status(500).json({ error: "Error al obtener instituciones no editables" });
//   }
// });

// // Instituciones de un profesor (por id o correo)
// app.get("/instituciones-profesor", async (req, res) => {
//   const { idprofesorsaanee, correo } = req.query;
//   if (!idprofesorsaanee && !correo) return res.status(400).send("Se requiere idprofesorsaanee o correo");

//   try {
//     const filtro = idprofesorsaanee
//       ? { idprofesorsaanee }
//       : { correo: correo.trim().toLowerCase() };

//     const { data: profs, error: profError } = await supabase
//       .from("profesores_saanee")
//       .select("*")
//       .match(filtro);

//     if (profError) throw profError;
//     if (!profs || profs.length === 0) return res.status(404).send("Profesor no encontrado");

//     const prof = profs[0];

//     const { data: insts, error: instError } = await supabase
//       .from("profesores_saanee_institucion")
//       .select("idinstitucioneducativa")
//       .eq("idprofesorsaanee", prof.idprofesorsaanee);

//     if (instError) throw instError;

//     res.json({
//       idProfesor: prof.idprofesorsaanee,
//       Correo: prof.correo,
//       NombreProfesor: prof.nombreprofesorsaanee,
//       Clave: prof.clave,
//       TelefonoProf: prof.telefonosaanee,
//       Instituciones: insts.map(r => r.idinstitucioneducativa)
//     });
//   } catch (err) {
//     console.error("Error al obtener instituciones del profesor:", err);
//     res.status(500).json({ error: "Error interno" });
//   }
// });

// // Crear institución
// app.post("/institucion", async (req, res) => {
//   const { nombreinstitucion } = req.body;
//   console.log('Body recibido:', req.body);

//   if (!nombreinstitucion)
//     return res.status(400).json({ error: "Nombre de institución es obligatorio" });

//   try {
//     const { data, error } = await supabase
//       .from("instituciones_educativas")
//       .insert([{ nombreinstitucion }])
//       .select();

//     if (error) throw error;

//     res.status(201).json(data[0]);
//   } catch (err) {
//     console.error("Error al crear institución:", err);
//     res.status(500).json({ error: "Error interno al crear institución" });
//   }
// });

// // Editar institución
// app.put("/institucion/:id", async (req, res) => {
//   const { id } = req.params;
//   const { nombreinstitucion } = req.body;
//   if (!nombreinstitucion) return res.status(400).json({ error: "Nombre de institución es obligatorio" });

//   try {
//     const { error } = await supabase
//       .from("instituciones_educativas")
//       .update({ nombreinstitucion })
//       .eq("idinstitucioneducativa", id);

//     if (error) throw error;
//     res.json({ message: "Institución actualizada con éxito" });
//   } catch (err) {
//     console.error("Error al editar institución:", err);
//     res.status(500).json({ error: "Error interno al editar institución" });
//   }
// });











// /////////////////// ESTUDIANTES ///////////////////
// Registrar estudiante
// app.post('/registrar-estudiante', async (req, res) => {
//   try {
//     const {
//       ApellidosNombres,
//       FechaNacimiento,  // "dd/mm/yyyy"
//       Edad,
//       DNI,
//       GradoSeccion,
//       TipoDiscapacidad,
//       DocumentoSustentatorio,
//       DocumentoInclusiva,
//       IPP,
//       PEP,
//       idInstitucionEducativa
//     } = req.body;

//     if (!ApellidosNombres || !FechaNacimiento || !Edad || !DNI || !GradoSeccion || !idInstitucionEducativa) {
//       return res.status(400).json({ error: 'Faltan campos obligatorios o institución educativa' });
//     }

//     // convertir dd/mm/yyyy -> ISO (yyyy-mm-dd)
//     const parts = FechaNacimiento.split('/');
//     if (parts.length !== 3) return res.status(400).json({ error: 'Formato de Fecha de Nacimiento inválido' });
//     const fechaISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;

//     const ippValue = (IPP === true || IPP === 'Si' || IPP === 'si' || IPP === 'SI') ? 'Si' : 'No';
//     const pepValue = (PEP === true || PEP === 'Si' || PEP === 'si' || PEP === 'SI') ? 'Si' : 'No';

//     const { data, error } = await supabase
//       .from('estudiantes')
//       .insert([{
//         apellidosnombres: ApellidosNombres,
//         fechanacimiento: fechaISO,
//         edad: Edad,
//         dni: DNI,
//         gradoseccion: GradoSeccion,
//         tipodiscapacidad: TipoDiscapacidad || null,
//         documentosustentatorio: DocumentoSustentatorio || null,
//         documentoinclusiva: DocumentoInclusiva || null,
//         ipp: ippValue,
//         pep: pepValue,
//         idinstitucioneducativa: idInstitucionEducativa
//       }])
//       .select()
//       .single();

//     if (error) {
//       console.error('Error insertar estudiante:', error);
//       return res.status(500).json({ error: 'Error interno al registrar estudiante' });
//     }

//     // Supabase retorna el registro insertado; su id dependerá de la columna (ej. idestudiante)
//     // Intentamos extraer el id (nombre de columna 'idestudiante' o 'id')
//     const idEstudiante = data.idestudiante ?? data.id ?? null;

//     return res.status(201).json({ message: 'Estudiante registrado', idEstudiante });
//   } catch (err) {
//     console.error('Excepción registrar-estudiante:', err);
//     return res.status(500).json({ error: 'Error interno al registrar estudiante' });
//   }
// });

// // Obtener estudiantes (puedes filtrar por idInstitucionEducativa)
// app.get('/estudiantes', async (req, res) => {
//   try {
//     const idInstitucion = req.query.idInstitucionEducativa;
//     let query = supabase
//       .from('estudiantes')
//       .select('*');

//     if (idInstitucion) {
//       query = query.eq('idinstitucioneducativa', idInstitucion);
//     }

//     // orden por id (dependiendo del nombre de columna en tu tabla)
//     const { data: results, error } = await query.order('idestudiante', { ascending: true });

//     if (error) {
//       console.error('Error obtener estudiantes:', error);
//       return res.status(500).json({ error: 'Error interno al obtener estudiantes' });
//     }

//     // formatear FechaNacimiento a dd/mm/YYYY (si existe fechanacimiento)
//     const formatted = (results || []).map(r => {
//       const fechaRaw = r.fechanacimiento || r.fecha_nacimiento || r.fechaNacimiento;
//       let FechaNacimiento = null;
//       if (fechaRaw) {
//         const d = new Date(fechaRaw);
//         if (!Number.isNaN(d.getTime())) {
//           const dd = `${d.getDate()}`.padStart(2, '0');
//           const mm = `${d.getMonth() + 1}`.padStart(2, '0');
//           const yyyy = d.getFullYear();
//           FechaNacimiento = `${dd}/${mm}/${yyyy}`;
//         }
//       }
//       return {
//         idEstudiante: r.idestudiante ?? r.id ?? null,
//         ApellidosNombres: r.apellidosnombres ?? r.ApellidosNombres ?? null,
//         FechaNacimiento,
//         Edad: r.edad ?? null,
//         DNI: r.dni ?? null,
//         GradoSeccion: r.gradoseccion ?? r.GradoSeccion ?? null,
//         TipoDiscapacidad: r.tipodiscapacidad ?? null,
//         DocumentoSustentatorio: r.documentosustentatorio ?? null,
//         DocumentoInclusiva: r.documentoinclusiva ?? null,
//         IPP: r.ipp ?? null,
//         PEP: r.pep ?? null,
//         idInstitucionEducativa: r.idinstitucioneducativa ?? null
//       };
//     });

//     return res.status(200).json(formatted);
//   } catch (err) {
//     console.error('Excepción obtener estudiantes:', err);
//     return res.status(500).json({ error: 'Error interno al obtener estudiantes' });
//   }
// });

// // Buscar estudiante por idEstudiante o por DNI
// app.get('/buscar-estudiante', async (req, res) => {
//   try {
//     const { idEstudiante, DNI } = req.query;
//     if (!idEstudiante && !DNI) {
//       return res.status(400).send('Se requiere idEstudiante o DNI');
//     }

//     let filter;
//     if (idEstudiante) {
//       filter = supabase.from('estudiantes').select('*').eq('idestudiante', idEstudiante).maybeSingle();
//     } else {
//       filter = supabase.from('estudiantes').select('*').eq('dni', DNI).maybeSingle();
//     }

//     const { data: est, error } = await filter;
//     if (error) {
//       console.error('Error buscar estudiante:', error);
//       return res.status(500).json({ error: 'Error interno' });
//     }
//     if (!est) {
//       return res.status(404).send('Estudiante no encontrado');
//     }

//     // Formatear fechas y campos devueltos
//     const fechaRaw = est.fechanacimiento || est.fecha_nacimiento || est.fechaNacimiento;
//     let FechaNacimiento = null;
//     if (fechaRaw) {
//       const d = new Date(fechaRaw);
//       if (!Number.isNaN(d.getTime())) {
//         const dd = `${d.getDate()}`.padStart(2, '0');
//         const mm = `${d.getMonth() + 1}`.padStart(2, '0');
//         const yyyy = d.getFullYear();
//         FechaNacimiento = `${dd}/${mm}/${yyyy}`;
//       }
//     }

//     const result = {
//       idEstudiante: est.idestudiante ?? est.id ?? null,
//       ApellidosNombres: est.apellidosnombres ?? est.ApellidosNombres ?? null,
//       FechaNacimiento,
//       Edad: est.edad ?? null,
//       DNI: est.dni ?? null,
//       GradoSeccion: est.gradoseccion ?? est.GradoSeccion ?? null,
//       TipoDiscapacidad: est.tipodiscapacidad ?? null,
//       DocumentoSustentatorio: est.documentosustentatorio ?? null,
//       DocumentoInclusiva: est.documentoinclusiva ?? null,
//       IPP: est.ipp ?? null,
//       PEP: est.pep ?? null,
//       idInstitucionEducativa: est.idinstitucioneducativa ?? null
//     };

//     return res.json(result);
//   } catch (err) {
//     console.error('Excepción buscar-estudiante:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });

// // Actualizar estudiante
// app.put('/actualizar-estudiante', async (req, res) => {
//   try {
//     const {
//       idEstudiante,
//       ApellidosNombres,
//       FechaNacimiento,
//       Edad,
//       DNI,
//       GradoSeccion,
//       TipoDiscapacidad,
//       DocumentoSustentatorio,
//       DocumentoInclusiva,
//       IPP,
//       PEP
//     } = req.body;

//     if (!idEstudiante || !ApellidosNombres || !FechaNacimiento || !Edad || !DNI || !GradoSeccion) {
//       return res.status(400).json({ error: 'Faltan campos obligatorios' });
//     }

//     // convertir dd/mm/yyyy -> ISO
//     const parts = FechaNacimiento.split('/');
//     if (parts.length !== 3) {
//       return res.status(400).json({ error: 'Formato de fecha inválido' });
//     }
//     const fechaISO = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;

//     const ippValue = (IPP === 'Si' || IPP === true || IPP === 'si' || IPP === 'SI') ? 'Si' : 'No';
//     const pepValue = (PEP === 'Si' || PEP === true || PEP === 'si' || PEP === 'SI') ? 'Si' : 'No';

//     const { error } = await supabase
//       .from('estudiantes')
//       .update({
//         apellidosnombres: ApellidosNombres,
//         fechanacimiento: fechaISO,
//         edad: Edad,
//         dni: DNI,
//         gradoseccion: GradoSeccion,
//         tipodiscapacidad: TipoDiscapacidad || null,
//         documentosustentatorio: DocumentoSustentatorio || null,
//         documentoinclusiva: DocumentoInclusiva || null,
//         ipp: ippValue,
//         pep: pepValue
//       })
//       .eq('idestudiante', idEstudiante);

//     if (error) {
//       console.error('Error actualizar estudiante:', error);
//       return res.status(500).json({ error: 'Error interno al actualizar' });
//     }

//     return res.json({ message: 'Estudiante actualizado con éxito' });
//   } catch (err) {
//     console.error('Excepción actualizar-estudiante:', err);
//     return res.status(500).json({ error: 'Error interno al actualizar' });
//   }
// });

// // Eliminar estudiante (usa cascade definido en la BD)
// // Elimina solo en `estudiantes` y deja que las FK con ON DELETE CASCADE borren las relaciones.
// app.delete('/eliminar-estudiante/:id', async (req, res) => {
//   try {
//     const id = Number(req.params.id);
//     if (!id || Number.isNaN(id)) {
//       return res.status(400).json({ error: 'ID inválido' });
//     }

//     // BORRAR en estudiantes; pedimos que nos devuelva las filas eliminadas con .select()
//     const { data: deletedRows, error } = await supabase
//       .from('estudiantes')
//       .delete()
//       .eq('idestudiante', id)
//       .select(); // importante: pedir la fila eliminada para respuesta consistente

//     if (error) {
//       // si hay un error de PostgREST (p.ej. PGRST205) lo registramos y devolvemos 500
//       console.error('Error eliminar estudiante (supabase):', error);
//       return res.status(500).json({ error: 'Error interno al eliminar estudiante', detail: error });
//     }

//     if (!deletedRows || deletedRows.length === 0) {
//       return res.status(404).json({ error: 'Estudiante no encontrado' });
//     }

//     // éxito
//     return res.json({ message: 'Estudiante eliminado con éxito', deleted: deletedRows[0] });
//   } catch (err) {
//     console.error('Excepción eliminar-estudiante:', err);
//     return res.status(500).json({ error: 'Error interno al eliminar estudiante' });
//   }
// });


/////////////////// DOCENTE-ESTUDIANTE ///////////////////
// app.get('/estudiantes-con-docente', async (req, res) => {
//   try {
//     const { data, error } = await supabase
//       .from('docentes_estudiante')
//       .select('idestudiante');

//     if (error) {
//       console.error('Error fetching docentes_estudiante:', error);
//       return res.status(500).json({ error: 'Error interno' });
//     }

//     const ids = Array.from(new Set((data || []).map(r => r.idestudiante)));
//     return res.json(ids);
//   } catch (err) {
//     console.error('Excepción estudiantes-con-docente:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });

// app.get('/docentes-estudiante', async (req, res) => {
//   try {
//     const { idInstitucionEducativa, nombreDocente } = req.query;

//     let query = supabase.from('docentes_estudiante').select('*');

//     if (idInstitucionEducativa) {
//       query = query.eq('idinstitucioneducativa', idInstitucionEducativa);
//     }
//     if (nombreDocente) {
//       // ilike para case-insensitive
//       query = query.ilike('nombredocente', `%${nombreDocente}%`);
//     }

//     const { data: docs, error: errDocs } = await query
//   .order('dnidocente', { ascending: true })   // orden principal por DNI del docente
//   .order('idestudiante', { ascending: true }); // orden secundario por estudiante

//     if (errDocs) {
//       console.error('Error obteniendo docentes:', errDocs);
//       return res.status(500).json({ error: 'Error interno' });
//     }

//     const docsList = docs || [];

//     // Traer nombres de estudiantes en batch
//     const studentIds = Array.from(new Set(docsList.map(d => d.idestudiante).filter(Boolean)));
//     let studentsMap = new Map();
//     if (studentIds.length) {
//       const { data: studs, error: errStuds } = await supabase
//         .from('estudiantes')
//         .select('idestudiante, apellidosnombres')
//         .in('idestudiante', studentIds);

//       if (errStuds) {
//         console.error('Error obteniendo estudiantes para mapear:', errStuds);
//         return res.status(500).json({ error: 'Error interno' });
//       }
//       (studs || []).forEach(s => studentsMap.set(s.idestudiante, s.apellidosnombres));
//     }

//     // Construir respuesta con NombreEstudiante
//     const result = docsList.map(d => ({
//       idDocente: d.iddocente ?? null,
//       idEstudiante: d.idestudiante ?? null,
//       NombreEstudiante: studentsMap.get(d.idestudiante) ?? null,
//       NombreDocente: d.nombredocente ?? null,
//       DNIDocente: d.dnidocente ?? null,
//       Email: d.email ?? null,
//       Telefono: d.telefono ?? null,
//       GradoSeccionLabora: d.gradoseccionlabora ?? null,
//       idInstitucionEducativa: d.idinstitucioneducativa ?? null
//     }));

//     return res.json(result);
//   } catch (err) {
//     console.error('Excepción docentes-estudiante:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });


// app.post('/registrar-docente', async (req, res) => {
//   try {
//     const { idEstudiante, NombreDocente, DNIDocente, Email, Telefono, GradoSeccionLabora } = req.body;
//     if (!idEstudiante || !NombreDocente || !DNIDocente || !Email) {
//       return res.status(400).json({ error: 'Faltan campos obligatorios' });
//     }

//     // 1) obtener idinstitucioneducativa del estudiante
//     const { data: stud, error: errStud } = await supabase
//       .from('estudiantes')
//       .select('idinstitucioneducativa')
//       .eq('idestudiante', idEstudiante)
//       .maybeSingle();

//     if (errStud) {
//       console.error('Error obteniendo institución del estudiante:', errStud);
//       return res.status(500).json({ error: 'Error interno al obtener institución' });
//     }
//     if (!stud) {
//       return res.status(404).json({ error: 'Estudiante no encontrado' });
//     }

//     const idInstitucionEducativa = stud.idinstitucioneducativa;

//     // 2) insertar en docentes_estudiante
//     const { data: inserted, error: errIns } = await supabase
//       .from('docentes_estudiante')
//       .insert([{
//         idestudiante: idEstudiante,
//         nombredocente: NombreDocente,
//         dnidocente: DNIDocente,
//         email: Email,
//         telefono: Telefono || null,
//         gradoseccionlabora: GradoSeccionLabora || null,
//         idinstitucioneducativa: idInstitucionEducativa
//       }])
//       .select()
//       .single();

//     if (errIns) {
//       console.error('Error insertando docente:', errIns);
//       return res.status(500).json({ error: 'Error interno al registrar docente' });
//     }

//     return res.status(201).json({ idDocente: inserted.iddocente ?? inserted.id ?? null });
//   } catch (err) {
//     console.error('Excepción registrar-docente:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });

// app.put('/actualizar-docente', async (req, res) => {
//   try {
//     const {
//       DNIDocente,
//       NombreDocente,
//       Email,
//       Telefono,
//       GradoSeccionLabora,
//       idEstudiante // array de ids
//     } = req.body;

//     if (!DNIDocente || !NombreDocente || !Email || !Array.isArray(idEstudiante)) {
//       return res.status(400).json({ error: 'Faltan campos obligatorios o idEstudiante no es array' });
//     }

//     // 0) obtener instituciones para los estudiantes dados
//     const { data: instRows, error: errInsts } = await supabase
//       .from('estudiantes')
//       .select('idestudiante, idinstitucioneducativa')
//       .in('idestudiante', idEstudiante);

//     if (errInsts) {
//       console.error('Error obteniendo instituciones:', errInsts);
//       return res.status(500).json({ error: 'Error interno al obtener instituciones' });
//     }

//     const instMap = new Map((instRows || []).map(r => [r.idestudiante, r.idinstitucioneducativa]));

//     // 1) traer asignaciones actuales para ese DNIDocente
//     const { data: currentRows, error: errCurrent } = await supabase
//       .from('docentes_estudiante')
//       .select('iddocente, idestudiante')
//       .eq('dnidocente', DNIDocente);

//     if (errCurrent) {
//       console.error('Error obteniendo asignaciones actuales:', errCurrent);
//       return res.status(500).json({ error: 'Error interno' });
//     }

//     const currentMap = new Map((currentRows || []).map(r => [r.idestudiante, r.iddocente]));
//     const currentIds = (currentRows || []).map(r => r.idestudiante);

//     const toDelete = (currentRows || []).filter(r => !idEstudiante.includes(r.idestudiante)).map(r => r.iddocente);
//     const toAdd = idEstudiante.filter(id => !currentMap.has(id));

//     // 2) actualizar filas existentes (todos los registros que tengan ese DNIDocente)
//     const { error: errUpdate } = await supabase
//       .from('docentes_estudiante')
//       .update({
//         nombredocente: NombreDocente,
//         email: Email,
//         telefono: Telefono || null,
//         gradoseccionlabora: GradoSeccionLabora || null
//       })
//       .eq('dnidocente', DNIDocente);

//     if (errUpdate) {
//       console.error('Error actualizando datos existentes:', errUpdate);
//       return res.status(500).json({ error: 'Error interno al actualizar datos' });
//     }

//     // 3) eliminar asignaciones sobrantes por iddocente
//     if (toDelete.length) {
//       const { error: errDel } = await supabase
//         .from('docentes_estudiante')
//         .delete()
//         .in('iddocente', toDelete);

//       if (errDel) {
//         console.error('Error eliminando asignaciones:', errDel);
//         return res.status(500).json({ error: 'Error interno al eliminar asignaciones' });
//       }
//     }

//     // 4) insertar nuevas asignaciones (si hay)
//     if (toAdd.length) {
//       const values = toAdd.map(idEst => ({
//         idestudiante: idEst,
//         nombredocente: NombreDocente,
//         dnidocente: DNIDocente,
//         email: Email,
//         telefono: Telefono || null,
//         gradoseccionlabora: GradoSeccionLabora || null,
//         idinstitucioneducativa: instMap.get(idEst) ?? null
//       }));

//       const { error: errIns } = await supabase
//         .from('docentes_estudiante')
//         .insert(values);

//       if (errIns) {
//         console.error('Error insertando nuevas asignaciones:', errIns);
//         return res.status(500).json({ error: 'Error interno al insertar nuevas asignaciones' });
//       }
//     }

//     return res.json({ message: 'Docente y asignaciones actualizadas con éxito' });
//   } catch (err) {
//     console.error('Excepción actualizar-docente:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });

// app.delete('/eliminar-docente/:id', async (req, res) => {
//   try {
//     const id = Number(req.params.id);
//     if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

//     // 1) obtener dnidocente de la fila indicada
//     const { data: row, error: err0 } = await supabase
//       .from('docentes_estudiante')
//       .select('dnidocente')
//       .eq('iddocente', id)
//       .maybeSingle();

//     if (err0) {
//       console.error('Error al buscar dnidocente para eliminación:', err0);
//       return res.status(500).json({ error: 'Error interno al buscar docente' });
//     }
//     if (!row) {
//       return res.status(404).json({ error: 'Docente no encontrado' });
//     }

//     const dni = row.dnidocente;

//     // 2) eliminar todas las filas con ese dnidocente
//     const { data: deleted, error: errDel } = await supabase
//       .from('docentes_estudiante')
//       .delete()
//       .eq('dnidocente', dni)
//       .select(); // devuelve filas borradas

//     if (errDel) {
//       console.error('Error al eliminar las asignaciones del docente:', errDel);
//       return res.status(500).json({ error: 'Error interno al eliminar docente' });
//     }

//     if (!deleted || deleted.length === 0) {
//       return res.status(404).json({ error: 'Docente no encontrado o ya eliminado' });
//     }

//     return res.json({
//       message: 'Docente eliminado con éxito. Las filas relacionadas quedaron libres para nueva asignación.',
//       deletedCount: deleted.length
//     });
//   } catch (err) {
//     console.error('Excepción eliminar-docente:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });

// app.get('/buscar-docente', async (req, res) => {
//   try {
//     const { nombreDocente } = req.query;
//     if (!nombreDocente) return res.status(400).send('Se requiere nombreDocente');

//     // 1) obtener DNIDocente del primer registro (igual que tu versión MySQL)
//     const { data: baseRows, error: errBase } = await supabase
//       .from('docentes_estudiante')
//       .select('dnidocente')
//       .eq('nombredocente', nombreDocente)
//       .limit(1);

//     if (errBase) {
//       console.error('Error en buscar-docente (base):', errBase);
//       return res.status(500).json({ error: 'Error interno' });
//     }
//     if (!baseRows || baseRows.length === 0) {
//       return res.status(404).send('Docente no encontrado');
//     }
//     const dni = baseRows[0].dnidocente;

//     // 2) traer todas las filas con ese DNIDocente
//     const { data: rows, error: errAll } = await supabase
//       .from('docentes_estudiante')
//       .select('iddocente, idestudiante, nombredocente, dnidocente, email, telefono, gradoseccionlabora')
//       .eq('dnidocente', dni);

//     if (errAll) {
//       console.error('Error en buscar-docente (all):', errAll);
//       return res.status(500).json({ error: 'Error interno' });
//     }

//     if (!rows || rows.length === 0) {
//       return res.status(404).send('Docente no encontrado');
//     }

//     const any = rows[0];
//     return res.json({
//       DNIDocente: any.dnidocente,
//       NombreDocente: any.nombredocente,
//       Email: any.email,
//       Telefono: any.telefono,
//       GradoSeccionLabora: any.gradoseccionlabora,
//       idEstudiante: rows.map(r => r.idestudiante)
//     });
//   } catch (err) {
//     console.error('Excepción buscar-docente:', err);
//     return res.status(500).json({ error: 'Error interno' });
//   }
// });




// DELETE familia en Supabase
app.delete('/eliminar-familia/:id', async (req, res) => {
  const idFamilia = parseInt(req.params.id, 10);

  if (isNaN(idFamilia)) return res.status(400).json({ error: 'ID inválido' });

  try {
    // Actualizar estudiantes
    await supabase
      .from('estudiantes')       // <--- asegúrate que esta tabla exista
      .update({ idfamilia: null })
      .eq('idfamilia', idFamilia);

    // Eliminar familia de la tabla correcta
    const { error } = await supabase
      .from('familia_estudiante')   // <--- usa el nombre correcto
      .delete()
      .eq('idfamilia', idFamilia);

    if (error) throw error;

    res.json({ success: true, message: 'Familia eliminada y estudiantes liberados' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});




app.get('/familias-estudiante', async (req, res) => {
  const { idInstitucionEducativa } = req.query;
  try {
    let query = supabase
      .from('familia_estudiante')
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

    if (idInstitucionEducativa) {
      query = query.eq('idinstitucioneducativa', idInstitucionEducativa);
    }

    // Orden estable: agrupar por DNI (familia), luego por idfamilia y luego por estudiante
    query = query
      .order('dni', { ascending: true })
      .order('idfamilia', { ascending: true })
      .order('idestudiante', { ascending: true });

    const { data: familias, error: familiasError } = await query;

    if (familiasError) throw familiasError;

    // resto sin cambios...
    const estudiantesIds = familias.map(f => f.idestudiante);
    const { data: estudiantes, error: estudiantesError } = await supabase
      .from('estudiantes')
      .select('idestudiante, apellidosnombres')
      .in('idestudiante', estudiantesIds);

    if (estudiantesError) throw estudiantesError;

    const familiasConEstudiantes = familias.map(f => {
      const estudiante = estudiantes.find(e => e.idestudiante === f.idestudiante);
      return {
        ...f,
        NombreEstudiante: estudiante ? estudiante.apellidosnombres : 'No asignado'
      };
    });

    res.status(200).json(familiasConEstudiantes);
  } catch (err) {
    console.error('Error al obtener familias:', err);
    return res.status(500).json({ error: 'Error al obtener familias' });
  }
});



app.post('/registrar-familia', async (req, res) => {
  const {
    idEstudiante,        // compatibilidad con petición antigua (único)
    idEstudiantes,       // nuevo: array de ids
    NombreMadreApoderado,
    DNI,
    Direccion,
    Telefono,
    Ocupacion,
    idInstitucionEducativa // opcional: viene del frontend si lo envías
  } = req.body;

  try {
    // ---- Caso: array de estudiantes ----
    if (Array.isArray(idEstudiantes) && idEstudiantes.length > 0) {
      if (!NombreMadreApoderado || !DNI) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (NombreMadreApoderado o DNI)' });
      }

      // Verificar que los estudiantes existan y obtener sus instituciones
      const { data: students, error: studentsError } = await supabase
        .from('estudiantes')
        .select('idestudiante, idinstitucioneducativa')
        .in('idestudiante', idEstudiantes);

      if (studentsError) {
        console.error('Error al consultar estudiantes:', studentsError);
        return res.status(500).json({ error: 'Error interno al validar estudiantes' });
      }

      if (!students || students.length !== idEstudiantes.length) {
        return res.status(404).json({ error: 'Algún estudiante no fue encontrado' });
      }

      // Si no enviaste idInstitucionEducativa, inferir y validar que todos coincidan
      let idInst = idInstitucionEducativa;
      if (!idInst) {
        const uniq = [...new Set(students.map(s => s.idinstitucioneducativa))];
        if (uniq.length > 1) {
          return res.status(400).json({ error: 'Los estudiantes pertenecen a distintas instituciones. Proporciona idInstitucionEducativa o usa estudiantes de la misma institución.' });
        }
        idInst = uniq[0];
      }

      // Preparar filas (una fila por estudiante — repite datos del apoderado)
      const rows = idEstudiantes.map(id => ({
        idestudiante: id,
        nombremadreapoderado: NombreMadreApoderado,
        dni: DNI,
        direccion: Direccion || null,
        telefono: Telefono || null,
        ocupacion: Ocupacion || null,
        idinstitucioneducativa: idInst
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('familia_estudiante')
        .insert(rows)
        .select();

      if (insertError) {
        console.error('Error al insertar familias:', insertError);
        return res.status(500).json({ error: 'Error interno al registrar familias' });
      }

      // Devuelve los registros insertados
      return res.status(201).json({ inserted: inserted.length, familias: inserted });
    }

    // ---- Caso: único estudiante (compatibilidad hacia atrás) ----
    if (!idEstudiante || !NombreMadreApoderado || !DNI) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const { data: estudiante, error: errEstudiante } = await supabase
      .from('estudiantes')
      .select('idinstitucioneducativa')
      .eq('idestudiante', idEstudiante)
      .single();

    if (errEstudiante) {
      console.error('Error obteniendo institución del estudiante:', errEstudiante);
      return res.status(500).json({ error: 'Error interno al obtener institución' });
    }

    if (!estudiante) {
      return res.status(404).json({ error: 'Estudiante no encontrado' });
    }

    const { idinstitucioneducativa } = estudiante;

    const { data, error: errInsert } = await supabase
      .from('familia_estudiante')
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

    if (errInsert) {
      console.error('Error al registrar familia:', errInsert);
      return res.status(500).json({ error: 'Error interno al registrar familia' });
    }

    return res.status(201).json({ idFamilia: data[0].idfamilia });
  } catch (err) {
    console.error('Error al registrar familia (catch):', err);
    return res.status(500).json({ error: 'Error interno al registrar familia' });
  }
});


// ---- reemplaza sólo el handler PUT /actualizar-familia ----
app.put('/actualizar-familia', async (req, res) => {
  try {
    const idFamilia = req.body.idFamilia || req.body.idfamilia || null;
    const idEstudiantes = req.body.idEstudiantes || req.body.idestudiantes;
    const NombreMadreApoderado = req.body.NombreMadreApoderado || req.body.nombremadreapoderado;
    const DNI = req.body.DNI || req.body.dni;
    const Direccion = req.body.Direccion || req.body.direccion || null;
    const Telefono = req.body.Telefono || req.body.telefono || null;
    const Ocupacion = req.body.Ocupacion || req.body.ocupacion || null;
    const idInstitucionEducativa = req.body.idInstitucionEducativa || req.body.idinstitucioneducativa || null;

    if (!idEstudiantes || !Array.isArray(idEstudiantes) || !NombreMadreApoderado || !DNI) {
      return res.status(400).json({ error: 'Faltan campos obligatorios o idEstudiantes no es array' });
    }

    // Normalizar ids a números y filtrar NaN
    const validIds = idEstudiantes
      .map(i => (typeof i === 'string' ? i.trim() : i))
      .map(i => Number(i))
      .filter(id => id != null && !isNaN(id));

    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No hay estudiantes válidos para asignar' });
    }

    // 0) Determinar la "clave" que agrupa las filas de la familia.
    // Preferimos usar el idFamilia (si nos lo pasan) para obtener el DNI actual en la BD,
    // luego usamos ese DNI para encontrar todas las filas relacionadas.
    let dniClave = (DNI || '').toString().trim();

    if (idFamilia) {
      const { data: rowById, error: errRow } = await supabase
        .from('familia_estudiante')
        .select('dni, idinstitucioneducativa')
        .eq('idfamilia', idFamilia)
        .maybeSingle();

      if (errRow) {
        console.error('[PUT /actualizar-familia] err fetching by idFamilia:', errRow);
        // no abortamos aún: fallback a usar DNI del body
      } else if (rowById) {
        // usamos el DNI que está en la BD como clave de agrupación (permite cambiar DNI en el body)
        dniClave = (rowById.dni || '').toString().trim();
      }
    }

    if (!dniClave) {
      return res.status(400).json({ error: 'No se pudo determinar el DNI clave para agrupar la familia' });
    }

    // Condición adicional para scoping por institución (si se proporcionó)
    const scopeEq = idInstitucionEducativa ? { idinstitucioneducativa: idInstitucionEducativa } : {};

    // 1) Actualizar los datos comunes en todas las filas que pertenezcan a esa familia (según dniClave)
    let updQuery = supabase.from('familia_estudiante').update({
      nombremadreapoderado: NombreMadreApoderado,
      dni: DNI, // actualizamos al nuevo DNI llegado (si el usuario lo cambió)
      direccion: Direccion,
      telefono: Telefono,
      ocupacion: Ocupacion
    }).eq('dni', dniClave);

    if (idInstitucionEducativa) updQuery = updQuery.eq('idinstitucioneducativa', idInstitucionEducativa);

    const { error: errUpdate } = await updQuery;

    if (errUpdate) {
      console.error('[PUT /actualizar-familia] errUpdate:', errUpdate);
      return res.status(500).json({ error: 'Error al actualizar datos de la familia', detail: errUpdate.message || errUpdate });
    }

    // 2) Leer filas actuales (cada fila tiene idestudiante)
    let selectQuery = supabase
      .from('familia_estudiante')
      .select('idfamilia, idestudiante')
      .eq('dni', dniClave);

    if (idInstitucionEducativa) selectQuery = selectQuery.eq('idinstitucioneducativa', idInstitucionEducativa);

    const { data: currentRows, error: errSelect } = await selectQuery;

    if (errSelect) {
      console.error('[PUT /actualizar-familia] errSelect:', errSelect);
      return res.status(500).json({ error: 'Error al leer relaciones actuales', detail: errSelect.message || errSelect });
    }

    // Normalizar currentIds
    const currentIds = Array.isArray(currentRows)
      ? currentRows.map(r => Number(r.idestudiante)).filter(n => !isNaN(n))
      : [];

    // 3) Calcular qué relaciones eliminar e insertar
    const toDeleteIds = currentIds.filter(id => !validIds.includes(id));
    const toInsertIds = validIds.filter(id => !currentIds.includes(id));

    // 4) Eliminar relaciones que ya no pertenecen (delete by dniClave + idestudiante IN ...)
    if (toDeleteIds.length > 0) {
      let delQ = supabase.from('familia_estudiante')
        .delete()
        .eq('dni', dniClave)
        .in('idestudiante', toDeleteIds);

      if (idInstitucionEducativa) delQ = delQ.eq('idinstitucioneducativa', idInstitucionEducativa);

      const { error: errDel } = await delQ;
      if (errDel) {
        console.error('[PUT /actualizar-familia] errDel:', errDel);
        return res.status(500).json({ error: 'Error al eliminar relaciones antiguas', detail: errDel.message || errDel });
      }
    }

    // 5) Insertar nuevas relaciones (una fila por estudiante nuevo)
    if (toInsertIds.length > 0) {
      const insertData = toInsertIds.map(idEst => ({
        idestudiante: idEst,
        nombremadreapoderado: NombreMadreApoderado,
        dni: DNI, // guardamos el DNI actualizado
        direccion: Direccion,
        telefono: Telefono,
        ocupacion: Ocupacion,
        idinstitucioneducativa: idInstitucionEducativa
      }));

      const { error: errIns } = await supabase
        .from('familia_estudiante')
        .insert(insertData);

      if (errIns) {
        console.error('[PUT /actualizar-familia] errIns:', errIns);
        return res.status(500).json({ error: 'Error al insertar nuevas relaciones', detail: errIns.message || errIns });
      }
    }

    return res.status(200).json({ message: 'Familia actualizada con éxito' });
  } catch (err) {
    console.error('Error al actualizar familia (catch):', err);
    return res.status(500).json({ error: 'Error interno al actualizar familia', detail: err?.message || err });
  }
});




app.get('/buscar-familia', async (req, res) => {
  try {
    const { nombreMadreApoderado, idInstitucionEducativa } = req.query;
    if (!nombreMadreApoderado || !idInstitucionEducativa) {
      return res.status(400).send('Falta nombreMadreApoderado o idInstitucionEducativa');
    }

    // 1) obtener idfamilia del primer registro
    const { data: baseRows, error: errBase } = await supabase
      .from('familia_estudiante')
      .select('idfamilia')
      .eq('nombremadreapoderado', nombreMadreApoderado)
      .eq('idinstitucioneducativa', idInstitucionEducativa)
      .limit(1);

    if (errBase) {
      console.error('Error en buscar-familia (base):', errBase);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!baseRows || baseRows.length === 0) {
      return res.status(404).send('Familia no encontrada');
    }

    const idfamilia = baseRows[0].idfamilia;

    // 2) traer todas las filas con ese idfamilia
    const { data: rows, error: errAll } = await supabase
      .from('familia_estudiante')
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
      .eq('idfamilia', idfamilia);

    if (errAll) {
      console.error('Error en buscar-familia (all):', errAll);
      return res.status(500).json({ error: 'Error interno' });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).send('Familia no encontrada');
    }

    // Tomar la info común de la familia (madre, dni, dirección, etc.)
    const any = rows[0];
    // Mapear los nombres de estudiantes (si existen relaciones)
    const estudiantes = rows.map(r => {
      if (Array.isArray(r.estudiantes)) {
        return r.estudiantes[0]?.apellidosnombres ?? null;
      }
      return r.estudiantes?.apellidosnombres ?? null;
    }).filter(Boolean);

    return res.json({
      idfamilia: any.idfamilia,
      NombreMadreApoderado: any.nombremadreapoderado,
      DNI: any.dni,
      Direccion: any.direccion,
      Telefono: any.telefono,
      Ocupacion: any.ocupacion,
      idEstudiantes: rows.map(r => r.idestudiante),
      Estudiantes: estudiantes
    });
  } catch (err) {
    console.error('Excepción buscar-familia:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});




// En lugar de usar .distinct(), haz la consulta normal
app.get('/estudiantes-con-familia', async (req, res) => {
  const { idInstitucionEducativa } = req.query;

  let query = supabase.from('familia_estudiante').select('idestudiante');

  if (idInstitucionEducativa) {
    query = query.eq('idinstitucioneducativa', idInstitucionEducativa);
  }

  try {
    const { data, error } = await query;
    if (error) {
      console.error('Error al obtener estudiantes con familia:', error);
      return res.status(500).json({ error: 'Error interno' });
    }

    // Elimina duplicados manualmente si es necesario
    const estudiantesUnicos = [...new Set(data.map(f => f.idestudiante))];

    res.json(estudiantesUnicos);
  } catch (err) {
    console.error('Error al obtener estudiantes con familia:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});








// --- 1) Estadísticas por tipo de discapacidad ---
app.get('/estadisticas/discapacidad', async (req, res) => {
  try {
    // usar nombre de columna en minúsculas
    const { data, error } = await supabase
      .from('estudiantes')
      .select('tipodiscapacidad');

    if (error) {
      console.error('Supabase error (discapacidad):', error);
      return res.status(500).json({ error: 'Error interno' });
    }

    const counts = new Map();
    (data || []).forEach(row => {
      // fallback por si la columna viene con capitalización distinta
      const key = row.tipodiscapacidad ?? row.TipoDiscapacidad ?? 'Sin especificar';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const result = Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    res.json(result);
  } catch (err) {
    console.error('Error (discapacidad):', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- 2) Estadísticas IPP vs PEP ---
app.get('/estadisticas/ipp-pep', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('estudiantes')
      .select('ipp,pep'); // minúsculas

    if (error) {
      console.error('Supabase error (ipp-pep):', error);
      return res.status(500).json({ error: 'Error interno' });
    }

    let ippSi = 0, ippNo = 0, pepSi = 0, pepNo = 0;
    (data || []).forEach(r => {
      const ipp = (r.ipp ?? r.IPP ?? '').toString().trim().toLowerCase();
      const pep = (r.pep ?? r.PEP ?? '').toString().trim().toLowerCase();

      if (ipp === 'si') ippSi++; else if (ipp === 'no') ippNo++;
      if (pep === 'si') pepSi++; else if (pep === 'no') pepNo++;
    });

    res.json({ ippSi, ippNo, pepSi, pepNo });
  } catch (err) {
    console.error('Error (ipp-pep):', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- 3) Alumnos por institución ---
app.get('/estadisticas/instituciones', async (req, res) => {
  try {
    const [{ data: instituciones, error: errI }, { data: estudiantes, error: errE }] = await Promise.all([
      // columnas en minúscula
      supabase.from('instituciones_educativas').select('idinstitucioneducativa,nombreinstitucion'),
      supabase.from('estudiantes').select('idestudiante,idinstitucioneducativa')
    ]);

    if (errI || errE) {
      console.error('Supabase error (instituciones):', errI || errE);
      return res.status(500).json({ error: 'Error interno' });
    }

    const counts = new Map();
    (instituciones || []).forEach(inst => {
      const id = inst.idinstitucioneducativa ?? inst.idInstitucionEducativa;
      const name = inst.nombreinstitucion ?? inst.NombreInstitucion ?? `Inst ${id}`;
      counts.set(id, { label: name, value: 0 });
    });

    (estudiantes || []).forEach(s => {
      const idInst = s.idinstitucioneducativa ?? s.idInstitucionEducativa;
      if (counts.has(idInst)) {
        counts.get(idInst).value++;
      } else {
        const key = 'no_especificado';
        if (!counts.has(key)) counts.set(key, { label: 'No especificado', value: 0 });
        counts.get(key).value++;
      }
    });

    const result = Array.from(counts.values()).sort((a, b) => b.value - a.value);
    res.json(result);
  } catch (err) {
    console.error('Error (instituciones):', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- 4) Familias por ocupación ---
app.get('/estadisticas/ocupacion-familia', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('familia_estudiante')
      .select('ocupacion'); // minúscula

    if (error) {
      console.error('Supabase error (ocupacion-familia):', error);
      return res.status(500).json({ error: 'Error interno' });
    }

    const counts = new Map();
    (data || []).forEach(row => {
      const key = row.ocupacion ?? row.Ocupacion ?? 'No especificado';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const result = Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    res.json(result);
  } catch (err) {
    console.error('Error (ocupacion-familia):', err);
    res.status(500).json({ error: 'Error interno' });
  }
});




// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
