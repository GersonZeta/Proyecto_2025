// api/instituciones/[id].js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  const { id } = req.query; // en Vercel las rutas dinámicas pasan por req.query.id
  if (req.method !== "PUT") return res.status(405).json({ error: "Método no permitido" });

  const { nombreinstitucion } = req.body;
  if (!nombreinstitucion) return res.status(400).json({ error: "Nombre de institución es obligatorio" });

  try {
    const { error } = await supabase
      .from("instituciones_educativas")
      .update({ nombreinstitucion })
      .eq("idinstitucioneducativa", id);
    if (error) throw error;
    res.json({ message: "Institución actualizada con éxito" });
  } catch (err) {
    console.error("Error al editar institución:", err);
    res.status(500).json({ error: "Error interno al editar institución" });
  }
}
