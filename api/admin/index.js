import { supabase } from "../supabase.js";
import nodemailer from "nodemailer";

const ALLOWED_EMAILS = [
  process.env.GMAIL_USER,
  "gezetab@ucvvirtual.edu.pe",
  "gerson29012004@gmail.com"
].map(e => e.toLowerCase());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS }
});

export default async function handler(req, res) {
  const { action } = req.query;

  try {
    // --- VERIFICAR SI EXISTE ADMIN
    if (action === "existe") {
      if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

      const { count, error } = await supabase
        .from("administrador")
        .select("*", { head: true, count: "exact" });

      if (error) throw error;
      return res.json({ existe: count > 0 });
    }

    // --- LOGIN / REGISTRAR ADMIN
    if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

    const { correo, clave, nuevaClave, token } = req.body;
    const correoLower = correo?.trim().toLowerCase();

    // --- LOGIN
    if (action === "login") {
      if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

      const { data, error } = await supabase
        .from("administrador")
        .select("clave")
        .eq("correo", correoLower)
        .single();

      if (error || !data) return res.json({ ok: false, mensaje: "Correo no registrado" });
      return res.json(data.clave === clave ? { ok: true } : { ok: false, mensaje: "Clave incorrecta" });
    }

    // --- REGISTRAR
    if (action === "registrar") {
      if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

      const { data: existe, error: checkErr } = await supabase
        .from("administrador")
        .select("*")
        .eq("correo", correoLower)
        .single();

      if (!checkErr && existe) return res.json({ ok: false, mensaje: "Correo ya registrado" });

      const { error } = await supabase
        .from("administrador")
        .insert([{ correo: correoLower, clave }]);

      if (error) throw error;
      return res.json({ ok: true });
    }

    // --- RESET: solicitar token
    if (action === "solicitar-reset") {
      if (!correo) return res.status(400).json({ ok: false, mensaje: "Correo requerido" });
      if (!ALLOWED_EMAILS.includes(correoLower))
        return res.status(401).json({ ok: false, mensaje: "Correo no autorizado" });

      const tokenGen = Math.floor(100000 + Math.random() * 900000).toString();
      const { data, error } = await supabase
        .from("administrador")
        .update({ reset_token: tokenGen, token_expiracion: new Date(Date.now() + 15*60000) })
        .eq("correo", correoLower)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).json({ ok: false, mensaje: "Correo no encontrado" });

      try {
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: correoLower,
          subject: "Tu código de seguridad",
          text: `Tu código de seguridad es: ${tokenGen}`
        });
      } catch (mailErr) {
        console.error("Error enviando correo:", mailErr);
        return res.status(500).json({ ok: false, mensaje: "Error enviando correo" });
      }

      return res.json({ ok: true, mensaje: "Token enviado" });
    }

    // --- RESET: cambiar clave con token
    if (action === "reset-security-code") {
      if (!correo || !token || !nuevaClave)
        return res.status(400).json({ ok: false, mensaje: "Faltan datos" });

      const { data, error } = await supabase
        .from("administrador")
        .select("reset_token, token_expiracion")
        .eq("correo", correoLower)
        .single();

      if (error || !data) return res.status(400).json({ ok: false, mensaje: "Correo inválido" });

      if (data.reset_token !== token.trim() || new Date(data.token_expiracion) < new Date()) {
        return res.status(400).json({ ok: false, mensaje: "Token inválido o expirado" });
      }

      const { error: updError } = await supabase
        .from("administrador")
        .update({ clave: nuevaClave, reset_token: null, token_expiracion: null })
        .eq("correo", correoLower);

      if (updError) throw updError;
      return res.json({ ok: true, mensaje: "Clave cambiada con éxito" });
    }

    return res.status(400).json({ error: "Acción inválida" });
  } catch (err) {
    console.error("Error admin:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
}
