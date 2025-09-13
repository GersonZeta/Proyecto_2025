import nodemailer from "nodemailer";
import { supabase } from "../../supabase.js";

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
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { action } = req.query; // ?action=solicitar-reset o ?action=reset-security-code

  try {
    if (action === "solicitar-reset") {
      let { correo } = req.body;
      if (!correo) return res.status(400).json({ ok: false, mensaje: "Correo requerido" });

      correo = correo.trim().toLowerCase();
      if (!ALLOWED_EMAILS.includes(correo)) {
        return res.status(401).json({ ok: false, mensaje: "Correo no autorizado" });
      }

      const token = Math.floor(100000 + Math.random() * 900000).toString();

      const { data, error } = await supabase
        .from("administrador")
        .update({ reset_token: token, token_expiracion: new Date(Date.now() + 15*60000) })
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
          text: `Tu código de seguridad es: ${token}`
        });
        console.log(`Token enviado a ${correo}: ${token}`);
      } catch (mailErr) {
        console.error("Error enviando correo:", mailErr);
        return res.status(500).json({ ok: false, mensaje: "Error enviando correo" });
      }

      return res.json({ ok: true, mensaje: "Token enviado" });
    }

    if (action === "reset-security-code") {
      const { correo, token, nuevaClave } = req.body;
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

    return res.status(400).json({ error: "Acción inválida" });
  } catch (err) {
    console.error("Error reset-admin:", err);
    return res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
}
