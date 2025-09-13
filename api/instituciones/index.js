// api/instituciones/index.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { data: usedInsts = [], error: usedError } = await supabase
        .from("profesores_saanee_institucion")
        .select("idinstitucioneducativa");
      if (usedError) throw usedError;

      const idsUsadas = usedInsts.map(x => x.idinstitucioneducativa);

      let query = supabase
        .from("instituciones_educativas")
        .select("idinstitucioneducativa, nombreinstitucion");

      if (idsUsadas.length > 0) {
        // supabase-js acepta array en "in" cuando viene como array
        query = query.not("idinstitucioneducativa", "in", `(${idsUsadas.join(",")})`);
      }

      const { data = [], error } = await query;
      if (error) throw error;

      return res.json(data);
    } catch (err) {
      console.error("Error al obtener instituciones:", err);
      return res.status(500).json({ error: "Error al obtener instituciones" });
    }
  }

  if (req.method === "POST") {
    const { nombreinstitucion } = req.body;
    if (!nombreinstitucion) return res.status(400).json({ error: "Nombre de institución es obligatorio" });

    try {
      const { data, error } = await supabase
        .from("instituciones_educativas")
        .insert([{ nombreinstitucion }])
        .select();
      if (error) throw error;
      return res.status(201).json((data || [])[0]);
    } catch (err) {
      console.error("Error al crear institución:", err);
      return res.status(500).json({ error: "Error interno al crear institución" });
    }
  }

  return res.status(405).json({ error: "Método no permitido" });
}
