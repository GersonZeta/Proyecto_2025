// pages/api/server/[...slug].js
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Cliente Supabase (usa la service role key porque esto corre en backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Nodemailer transporter (usa env vars GMAIL_USER y GMAIL_APP_PASS)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

const ALLOWED_EMAILS = [
  process.env.GMAIL_USER,
  "gezetab@ucvvirtual.edu.pe",
  "gerson29012004@gmail.com",
].map((e) => e && e.toLowerCase());

// Helper de CORS + respuestas
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    // Preflight
    return res.status(204).end();
  }

  try {
    const slug = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug].filter(Boolean);
    // slug[0] será la ruta principal (ej: 'solicitar-reset', 'profesores', 'institucion', etc.)
    const route = (slug && slug[0]) || "";

    // ----------------- SOLICITAR RESET -----------------
    if (route === "solicitar-reset" && req.method === "POST") {
      let { correo } = req.body || {};
      if (!correo) return res.status(400).json({ ok: false, mensaje: "Correo requerido" });

      correo = correo.trim().toLowerCase();
      if (!ALLOWED_EMAILS.includes(correo)) {
        return res.status(401).json({ ok: false, mensaje: "Correo no autorizado" });
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();

      const { data, error } = await supabase
        .from("administrador")
        .update({
          reset_token: token,
          token_expiracion: new Date(Date.now() + 15 * 60000), // 15 min
        })
        .eq("correo", correo)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        console.log("Correo no encontrado en DB:", correo);
        return res.status(404).json({ ok: false, mensaje: "Correo no encontrado" });
      }

      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: correo,
          subject: "Tu código de seguridad",
          text: `Tu código de seguridad es: ${token}`,
        });
        console.log(`Token enviado a ${correo}: ${token}`);
      } catch (mailErr) {
        console.error("Error enviando correo:", mailErr);
        return res.status(500).json({ ok: false, mensaje: "Error enviando correo" });
      }

      return res.json({ ok: true, mensaje: "Token enviado" });
    }

    // ----------------- RESET SECURITY CODE -----------------
    if (route === "reset-security-code" && req.method === "POST") {
      const { correo, token, nuevaClave } = req.body || {};
      if (!correo || !token || !nuevaClave) {
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });
      }

      const { data, error } = await supabase
        .from("administrador")
        .select("reset_token, token_expiracion")
        .eq("correo", correo.trim().toLowerCase())
        .single();

      if (error || !data) return res.status(400).json({ ok: false, mensaje: "Correo inválido" });

      const { reset_token, token_expiracion } = data;
      if (reset_token !== token.trim() || new Date(token_expiracion) < new Date()) {
        return res.status(400).json({ ok: false, mensaje: "Token inválido o expirado" });
      }

      const { error: updError } = await supabase
        .from("administrador")
        .update({ clave: nuevaClave, reset_token: null, token_expiracion: null })
        .eq("correo", correo.trim().toLowerCase());

      if (updError) throw updError;

      return res.json({ ok: true, mensaje: "Clave cambiada con éxito" });
    }

    // ----------------- EXISTE ADMIN -----------------
    if (route === "existe-admin" && req.method === "GET") {
      const { count, error } = await supabase
        .from("administrador")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return res.json({ existe: count > 0 });
    }

    // ----------------- REGISTRAR ADMIN -----------------
    if (route === "registrar-admin" && req.method === "POST") {
      const { correo, clave } = req.body || {};
      if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

      const { error } = await supabase
        .from("administrador")
        .insert([{ correo: correo.trim().toLowerCase(), clave }]);

      if (error) throw error;
      return res.json({ ok: true });
    }

    // ----------------- LOGIN ADMIN -----------------
    if (route === "login-admin" && req.method === "POST") {
      const { correo, clave } = req.body || {};
      if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

      const { data, error } = await supabase
        .from("administrador")
        .select("clave")
        .eq("correo", correo.trim().toLowerCase())
        .maybeSingle();

      if (error || !data) return res.json({ ok: false, mensaje: "Correo no registrado" });

      if (data.clave === clave) return res.json({ ok: true });
      else return res.json({ ok: false, mensaje: "Clave incorrecta" });
    }

    // ----------------- PROFESORES (GET all) -----------------
    if (route === "profesores" && req.method === "GET") {
      const { data: profesores, error } = await supabase.from("profesores_saanee").select("*");
      if (error) throw error;

      const profesoresConInst = await Promise.all(
        (profesores || []).map(async (prof) => {
          const { data: insts, error: instError } = await supabase
            .from("profesores_saanee_institucion")
            .select("idinstitucioneducativa")
            .eq("idprofesorsaanee", prof.idprofesorsaanee);
          if (instError) throw instError;
          return { ...prof, instituciones: (insts || []).map((i) => i.idinstitucioneducativa) };
        })
      );

      return res.json(profesoresConInst);
    }

    // ----------------- BUSCAR PROFESOR (GET) -----------------
    if (route === "buscar-profesor" && req.method === "GET") {
      const nombre = req.query.nombreProfesor;
      if (!nombre) return res.status(400).json({ error: "Falta nombreProfesor" });

      const { data: profs, error } = await supabase
        .from("profesores_saanee")
        .select("*")
        .ilike("nombreprofesorsaanee", `%${nombre}%`);

      if (error) throw error;
      if (!profs || profs.length === 0) return res.status(404).json({ error: "Profesor no encontrado" });

      const prof = profs[0];
      const { data: insts, error: instError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .eq("idprofesorsaanee", prof.idprofesorsaanee);
      if (instError) throw instError;

      return res.json({ ...prof, instituciones: (insts || []).map((i) => i.idinstitucioneducativa) });
    }

    // ----------------- REGISTRAR PROFESOR (POST) -----------------
    if (route === "registrar-profesor" && req.method === "POST") {
      const { correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = req.body || {};

      const { data: prof, error } = await supabase
        .from("profesores_saanee")
        .insert([{ correo, nombreprofesorsaanee, clave, telefonosaanee }])
        .select()
        .single();

      if (error) throw error;

      if (instituciones && instituciones.length > 0) {
        const instInsert = instituciones.map((id) => ({
          idprofesorsaanee: prof.idprofesorsaanee,
          idinstitucioneducativa: id,
        }));
        const { error: instError } = await supabase.from("profesores_saanee_institucion").insert(instInsert);
        if (instError) throw instError;
      }

      return res.json({ success: true });
    }

    // ----------------- ACTUALIZAR PROFESOR (PUT) -----------------
    if (route === "actualizar-profesor" && req.method === "PUT") {
      const { idprofesorsaanee, correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = req.body || {};

      const { error } = await supabase
        .from("profesores_saanee")
        .update({ correo, nombreprofesorsaanee, clave, telefonosaanee })
        .eq("idprofesorsaanee", idprofesorsaanee);
      if (error) throw error;

      // eliminar antiguas instituciones
      const { error: delError } = await supabase
        .from("profesores_saanee_institucion")
        .delete()
        .eq("idprofesorsaanee", idprofesorsaanee);
      if (delError) throw delError;

      if (instituciones && instituciones.length > 0) {
        const instInsert = instituciones.map((id) => ({
          idprofesorsaanee,
          idinstitucioneducativa: id,
        }));
        const { error: instError } = await supabase
          .from("profesores_saanee_institucion")
          .insert(instInsert);
        if (instError) throw instError;
      }

      return res.json({ success: true });
    }

    // ----------------- INSTITUCIONES (sin asignar) -----------------
    if (route === "instituciones" && req.method === "GET") {
      const { data: usedInsts, error: usedError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa");
      if (usedError) throw usedError;

      const idsUsadas = (usedInsts || []).map((x) => x.idinstitucioneducativa);
      let query = supabase.from("instituciones_educativas").select("idinstitucioneducativa, nombreinstitucion");

      if (idsUsadas.length) {
        query = query.not("idinstitucioneducativa", "in", idsUsadas);
      }

      const { data, error } = await query;
      if (error) throw error;

      return res.json(data);
    }

    // ----------------- INSTITUCIONES ALL -----------------
    if (route === "instituciones-all" && req.method === "GET") {
      const { data, error } = await supabase
        .from("instituciones_educativas")
        .select("idinstitucioneducativa, nombreinstitucion");
      if (error) throw error;
      return res.json(data);
    }

    // ----------------- INSTITUCIONES NO EDITABLES -----------------
    if (route === "instituciones-no-editables" && req.method === "GET") {
      const idprofesorsaanee = req.query.idprofesorsaanee;
      if (!idprofesorsaanee) return res.status(400).send("Se requiere idprofesorsaanee");

      const { data, error } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .neq("idprofesorsaanee", idprofesorsaanee);

      if (error) throw error;
      return res.json((data || []).map((r) => r.idinstitucioneducativa));
    }

    // ----------------- INSTITUCIONES PROFESOR -----------------
    if (route === "instituciones-profesor" && req.method === "GET") {
      const { idprofesorsaanee, correo } = req.query;
      if (!idprofesorsaanee && !correo) return res.status(400).send("Se requiere idprofesorsaanee o correo");

      const filtro = idprofesorsaanee ? { idprofesorsaanee } : { correo: correo.trim().toLowerCase() };

      const { data: profs, error: profError } = await supabase.from("profesores_saanee").select("*").match(filtro);
      if (profError) throw profError;
      if (!profs || profs.length === 0) return res.status(404).send("Profesor no encontrado");
      const prof = profs[0];

      const { data: insts, error: instError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .eq("idprofesorsaanee", prof.idprofesorsaanee);
      if (instError) throw instError;

      return res.json({
        idProfesor: prof.idprofesorsaanee,
        Correo: prof.correo,
        NombreProfesor: prof.nombreprofesorsaanee,
        Clave: prof.clave,
        TelefonoProf: prof.telefonosaanee,
        Instituciones: (insts || []).map((r) => r.idinstitucioneducativa),
      });
    }

    // ----------------- CREAR INSTITUCION (POST) -----------------
    if (route === "institucion" && req.method === "POST") {
      const { nombreinstitucion } = req.body || {};
      if (!nombreinstitucion) return res.status(400).json({ error: "Nombre de institución es obligatorio" });

      const { data, error } = await supabase
        .from("instituciones_educativas")
        .insert([{ nombreinstitucion }])
        .select();

      if (error) throw error;
      return res.status(201).json(data[0]);
    }

    // ----------------- EDITAR INSTITUCION (PUT /institucion/:id) -----------------
    if (route === "institucion" && req.method === "PUT") {
      // path: /api/server/institucion/:id -> slug[1] es id
      const id = slug[1];
      if (!id) return res.status(400).json({ error: "Se requiere id en la ruta" });

      const { nombreinstitucion } = req.body || {};
      if (!nombreinstitucion) return res.status(400).json({ error: "Nombre de institución es obligatorio" });

      const { error } = await supabase
        .from("instituciones_educativas")
        .update({ nombreinstitucion })
        .eq("idinstitucioneducativa", id);

      if (error) throw error;
      return res.json({ message: "Institución actualizada con éxito" });
    }

    // ----------------- Ruta no encontrada -----------------
    return res.status(404).json({ error: "Ruta no encontrada (usa /api/server/<nombre-ruta>)" });
  } catch (err) {
    console.error("Error en API /api/server:", err);
    return res.status(500).json({ error: "Error interno", detalle: err.message || err.toString() });
  }
}
