import nodemailer from "nodemailer";
import { supabase } from "../../supabase.js";

const ALLOWED_EMAILS = [
  process.env.GMAIL_USER,
  "gezetab@ucvvirtual.edu.pe",
  "gerson29012004@gmail.com"
].map(e => e.toLowerCase());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

export default async function handler(req, res) {
  const { method, url } = req;

  // --- Solicitar reset
  if (method === "POST" && url.endsWith("/solicitar-reset")) {
    try {
      let { correo } = req.body;
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
          token_expiracion: new Date(Date.now() + 15 * 60000)
        })
        .eq("correo", correo)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) return res.status(404).json({ ok: false, mensaje: "Correo no encontrado" });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: correo,
        subject: "Tu código de seguridad",
        text: `Tu código de seguridad es: ${token}`
      });

      return res.json({ ok: true, mensaje: "Token enviado" });
    } catch (err) {
      return res.status(500).json({ ok: false, mensaje: "No se pudo generar token" });
    }
  }

  // --- Resetear clave
  if (method === "POST" && url.endsWith("/reset-security-code")) {
    try {
      const { correo, token, nuevaClave } = req.body;
      if (!correo || !token || !nuevaClave) return res.status(400).json({ ok: false, mensaje: "Faltan datos" });

      const { data, error } = await supabase
        .from("administrador")
        .select("reset_token, token_expiracion")
        .eq("correo", correo.trim().toLowerCase())
        .single();

      if (error || !data) return res.status(400).json({ ok: false, mensaje: "Correo inválido" });

      if (data.reset_token !== token.trim() || new Date(data.token_expiracion) < new Date()) {
        return res.status(400).json({ ok: false, mensaje: "Token inválido o expirado" });
      }

      const { error: updError } = await supabase
        .from("administrador")
        .update({ clave: nuevaClave, reset_token: null, token_expiracion: null })
        .eq("correo", correo.trim().toLowerCase());

      if (updError) throw updError;
      return res.json({ ok: true, mensaje: "Clave cambiada con éxito" });
    } catch {
      return res.status(500).json({ ok: false, mensaje: "Error al cambiar clave" });
    }
  }

  // --- Verificar si existe admin
  if (method === "GET" && url.endsWith("/existe-admin")) {
    try {
      const { count, error } = await supabase
        .from("administrador")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return res.json({ existe: count > 0 });
    } catch (err) {
      return res.status(500).json({ error: "Error servidor", detalle: err.message });
    }
  }

  // --- Registrar admin
  if (method === "POST" && url.endsWith("/registrar-admin")) {
    try {
      const { correo, clave } = req.body;
      if (!correo || !clave) return res.status(400).json({ ok: false, mensaje: "Faltan campos" });

      const { error } = await supabase
        .from("administrador")
        .insert([{ correo: correo.trim().toLowerCase(), clave }]);

      if (error) throw error;
      return res.json({ ok: true });
    } catch {
      return res.status(500).json({ ok: false, mensaje: "Error al registrar" });
    }
  }

  // --- Login admin
  if (method === "POST" && url.endsWith("/login-admin")) {
    try {
      const { correo, clave } = req.body;
      const { data, error } = await supabase
        .from("administrador")
        .select("clave")
        .eq("correo", correo.trim().toLowerCase())
        .single();

      if (error || !data) return res.json({ ok: false, mensaje: "Correo no registrado" });
      return res.json(data.clave === clave ? { ok: true } : { ok: false, mensaje: "Clave incorrecta" });
    } catch {
      return res.status(500).json({ ok: false, mensaje: "Error servidor" });
    }
  }

  // --- fallback
  return res.status(404).json({ error: "Ruta no encontrada" });
}
