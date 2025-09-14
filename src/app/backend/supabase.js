// // supabase.js
// require("dotenv").config();
// const { createClient } = require("@supabase/supabase-js");

// const SUPABASE_URL = process.env.SUPABASE_URL;
// const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// // Función para obtener todos los administradores
// async function obtenerAdministradores() {
//   try {
//     const { data, error } = await supabase
//       .from('administrador')
//       .select('correo, clave');

//     if (error) throw error;

//     console.log("Administradores:", data);
//     return data;
//   } catch (err) {
//     console.error("Error al obtener administradores:", err.message);
//     return [];
//   }
// }

// // Ping inicial
// (async () => {
//   console.log("🔄 Intentando conectar a Supabase...");
//   const admins = await obtenerAdministradores();
//   if (admins.length > 0) {
//     console.log("✅ Administradores cargados correctamente");
//   } else {
//     console.log("⚠️ No hay administradores o error al cargar");
//   }
// })();

// // Opcional: mantener ping cada 5 minutos SOLO si falla
// setInterval(async () => {
//   try {
//     const { error } = await supabase.from('administrador').select('correo').limit(1);
//     if (error) {
//       console.warn("⚠️ Error ping Supabase:", error.message);
//     }
//     // 👈 Si no hay error, no imprime nada
//   } catch (err) {
//     console.error("❌ Error ping Supabase:", err.message);
//   }
// }, 5 * 60 * 1000); // cada 5 minutos

// module.exports = { supabase, obtenerAdministradores };
