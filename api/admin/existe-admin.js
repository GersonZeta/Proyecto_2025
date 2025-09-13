// api/admin/existe-admin.js
import { supabase } from "../supabase.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });

  try {
    const { count, error } = await supabase
      .from("administrador")
      .select("*", { head: true, count: "exact" });

    if (error) throw error;

    return res.json({ existe: count > 0 });
  } catch (err) {
    console.error("Error existe-admin:", err);
    return res.status(500).json({ existe: false, error: err.message });
  }
}
