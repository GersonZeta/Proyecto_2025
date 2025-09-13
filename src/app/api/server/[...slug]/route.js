// src/app/api/server/[...slug]/route.js
export const runtime = "nodejs"; // importante para nodemailer / librerías node

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

const ALLOWED_EMAILS = [process.env.GMAIL_USER, "gezetab@ucvvirtual.edu.pe", "gerson29012004@gmail.com"]
  .filter(Boolean)
  .map(e => e.toLowerCase());

// Helper para extraer slug y query params
function getSlug(params) {
  // params.slug viene como array o undefined
  return Array.isArray(params?.slug) ? params.slug : params?.slug ? [params.slug] : [];
}

export async function GET(req, { params }) {
  try {
    const slug = getSlug(params);
    const route = slug[0] || "";

    // usar URL para leer query params
    const url = new URL(req.url);
    // ------------ rutas GET ------------
    if (route === "existe-admin") {
      const { count, error } = await supabase.from("administrador").select("*", { count: "exact", head: true });
      if (error) throw error;
      return jsonResponse({ existe: count > 0 });
    }

    if (route === "profesores") {
      const { data: profesores, error } = await supabase.from("profesores_saanee").select("*");
      if (error) throw error;
      const profesWithInst = await Promise.all((profes || []).map(async prof => {
        const { data: insts, error: instErr } = await supabase
          .from("profesores_saanee_institucion")
          .select("idinstitucioneducativa")
          .eq("idprofesorsaanee", prof.idprofesorsaanee);
        if (instErr) throw instErr;
        return { ...prof, instituciones: (insts || []).map(i => i.idinstitucioneducativa) };
      }));
      return jsonResponse(profesWithInst);
    }

    if (route === "buscar-profesor") {
      const nombre = url.searchParams.get("nombreProfesor");
      if (!nombre) return jsonResponse({ error: "Falta nombreProfesor" }, 400);
      const { data: profs, error } = await supabase
        .from("profesores_saanee")
        .select("*")
        .ilike("nombreprofesorsaanee", `%${nombre}%`);
      if (error) throw error;
      if (!profs || profs.length === 0) return jsonResponse({ error: "Profesor no encontrado" }, 404);
      const prof = profs[0];
      const { data: insts, error: instErr } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .eq("idprofesorsaanee", prof.idprofesorsaanee);
      if (instErr) throw instErr;
      return jsonResponse({ ...prof, instituciones: (insts || []).map(i => i.idinstitucioneducativa) });
    }

    if (route === "instituciones") {
      // instituciones sin asignar
      const { data: usedInsts, error: usedError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa");
      if (usedError) throw usedError;
      const idsUsadas = (usedInsts || []).map(x => x.idinstitucioneducativa);
      let q = supabase.from("instituciones_educativas").select("idinstitucioneducativa, nombreinstitucion");
      if (idsUsadas.length) q = q.not("idinstitucioneducativa", "in", idsUsadas);
      const { data, error } = await q;
      if (error) throw error;
      return jsonResponse(data);
    }

    if (route === "instituciones-all") {
      const { data, error } = await supabase.from("instituciones_educativas").select("idinstitucioneducativa, nombreinstitucion");
      if (error) throw error;
      return jsonResponse(data);
    }

    if (route === "instituciones-no-editables") {
      const idprof = url.searchParams.get("idprofesorsaanee");
      if (!idprof) return jsonResponse({ error: "Se requiere idprofesorsaanee" }, 400);
      const { data, error } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .neq("idprofesorsaanee", idprof);
      if (error) throw error;
      return jsonResponse((data || []).map(r => r.idinstitucioneducativa));
    }

    if (route === "instituciones-profesor") {
      const idprof = url.searchParams.get("idprofesorsaanee");
      const correo = url.searchParams.get("correo");
      if (!idprof && !correo) return jsonResponse({ error: "Se requiere idprofesorsaanee o correo" }, 400);
      const filtro = idprof ? { idprofesorsaanee: idprof } : { correo: correo.trim().toLowerCase() };
      const { data: profs, error: profErr } = await supabase.from("profesores_saanee").select("*").match(filtro);
      if (profErr) throw profErr;
      if (!profs || profs.length === 0) return jsonResponse({ error: "Profesor no encontrado" }, 404);
      const prof = profs[0];
      const { data: insts, error: instErr } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa")
        .eq("idprofesorsaanee", prof.idprofesorsaanee);
      if (instErr) throw instErr;
      return jsonResponse({
        idProfesor: prof.idprofesorsaanee,
        Correo: prof.correo,
        NombreProfesor: prof.nombreprofesorsaanee,
        Clave: prof.clave,
        TelefonoProf: prof.telefonosaanee,
        Instituciones: (insts || []).map(r => r.idinstitucioneducativa),
      });
    }

    return jsonResponse({ error: "Ruta GET no encontrada" }, 404);
  } catch (err) {
    console.error("Error GET /api/server:", err);
    return jsonResponse({ error: "Error interno", detalle: err?.message || String(err) }, 500);
  }
}

export async function POST(req, { params }) {
  try {
    const slug = getSlug(params);
    const route = slug[0] || "";
    const body = await req.json();

    // ----------------- solicitar-reset -----------------
    if (route === "solicitar-reset") {
      let correo = (body?.correo || "").toString().trim().toLowerCase();
      if (!correo) return jsonResponse({ ok: false, mensaje: "Correo requerido" }, 400);
      if (!ALLOWED_EMAILS.includes(correo)) return jsonResponse({ ok: false, mensaje: "Correo no autorizado" }, 401);
      const token = Math.floor(100000 + Math.random() * 900000).toString();
      const { data, error } = await supabase
        .from("administrador")
        .update({ reset_token: token, token_expiracion: new Date(Date.now() + 15 * 60000) })
        .eq("correo", correo)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) return jsonResponse({ ok: false, mensaje: "Correo no encontrado" }, 404);
      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: correo,
          subject: "Tu código de seguridad",
          text: `Tu código de seguridad es: ${token}`
        });
      } catch (mailErr) {
        console.error("Error nodemailer:", mailErr);
        return jsonResponse({ ok: false, mensaje: "Error enviando correo" }, 500);
      }
      return jsonResponse({ ok: true, mensaje: "Token enviado" });
    }

    // ----------------- reset-security-code -----------------
    if (route === "reset-security-code") {
      const { correo, token, nuevaClave } = body || {};
      if (!correo || !token || !nuevaClave) return jsonResponse({ ok: false, mensaje: "Faltan datos" }, 400);
      const { data, error } = await supabase
        .from("administrador")
        .select("reset_token, token_expiracion")
        .eq("correo", correo.trim().toLowerCase())
        .single();
      if (error || !data) return jsonResponse({ ok: false, mensaje: "Correo inválido" }, 400);
      if (data.reset_token !== token.trim() || new Date(data.token_expiracion) < new Date()) {
        return jsonResponse({ ok: false, mensaje: "Token inválido o expirado" }, 400);
      }
      const { error: updError } = await supabase
        .from("administrador")
        .update({ clave: nuevaClave, reset_token: null, token_expiracion: null })
        .eq("correo", correo.trim().toLowerCase());
      if (updError) throw updError;
      return jsonResponse({ ok: true, mensaje: "Clave cambiada con éxito" });
    }

    // ----------------- registrar-admin -----------------
    if (route === "registrar-admin") {
      const { correo, clave } = body || {};
      if (!correo || !clave) return jsonResponse({ ok: false, mensaje: "Faltan campos" }, 400);
      const { error } = await supabase.from("administrador").insert([{ correo: correo.trim().toLowerCase(), clave }]);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    // ----------------- registrar-profesor -----------------
    if (route === "registrar-profesor") {
      const { correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = body || {};
      const { data: prof, error } = await supabase
        .from("profesores_saanee")
        .insert([{ correo, nombreprofesorsaanee, clave, telefonosaanee }])
        .select()
        .single();
      if (error) throw error;
      if (instituciones && instituciones.length > 0) {
        const instInsert = instituciones.map(id => ({ idprofesorsaanee: prof.idprofesorsaanee, idinstitucioneducativa: id }));
        const { error: instError } = await supabase.from("profesores_saanee_institucion").insert(instInsert);
        if (instError) throw instError;
      }
      return jsonResponse({ success: true });
    }

    // ----------------- crear institucion -----------------
    if (route === "institucion") {
      const { nombreinstitucion } = body || {};
      if (!nombreinstitucion) return jsonResponse({ error: "Nombre de institución es obligatorio" }, 400);
      const { data, error } = await supabase.from("instituciones_educativas").insert([{ nombreinstitucion }]).select();
      if (error) throw error;
      return jsonResponse(data?.[0] ?? null, 201);
    }

    return jsonResponse({ error: "Ruta POST no encontrada" }, 404);
  } catch (err) {
    console.error("Error POST /api/server:", err);
    return jsonResponse({ error: "Error interno", detalle: err?.message || String(err) }, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const slug = getSlug(params);
    const route = slug[0] || "";
    const body = await req.json();

    // actualizar-profesor
    if (route === "actualizar-profesor") {
      const { idprofesorsaanee, correo, nombreprofesorsaanee, clave, telefonosaanee, instituciones } = body || {};
      const { error } = await supabase.from("profesores_saanee")
        .update({ correo, nombreprofesorsaanee, clave, telefonosaanee })
        .eq("idprofesorsaanee", idprofesorsaanee);
      if (error) throw error;
      const { error: delError } = await supabase.from("profesores_saanee_institucion")
        .delete().eq("idprofesorsaanee", idprofesorsaanee);
      if (delError) throw delError;
      if (instituciones && instituciones.length > 0) {
        const instInsert = instituciones.map(id => ({ idprofesorsaanee, idinstitucioneducativa: id }));
        const { error: instError } = await supabase.from("profesores_saanee_institucion").insert(instInsert);
        if (instError) throw instError;
      }
      return jsonResponse({ success: true });
    }

    // editar institucion: route "institucion" con slug[1] = id
    if (route === "institucion") {
      const id = slug[1];
      if (!id) return jsonResponse({ error: "Se requiere id en la ruta" }, 400);
      const { nombreinstitucion } = body || {};
      if (!nombreinstitucion) return jsonResponse({ error: "Nombre de institución es obligatorio" }, 400);
      const { error } = await supabase.from("instituciones_educativas")
        .update({ nombreinstitucion }).eq("idinstitucioneducativa", id);
      if (error) throw error;
      return jsonResponse({ message: "Institución actualizada con éxito" });
    }

    return jsonResponse({ error: "Ruta PUT no encontrada" }, 404);
  } catch (err) {
    console.error("Error PUT /api/server:", err);
    return jsonResponse({ error: "Error interno", detalle: err?.message || String(err) }, 500);
  }
}
