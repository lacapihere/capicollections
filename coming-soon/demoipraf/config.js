/* Configuración de entorno.
 *
 * Con url y anonKey rellenados, la app usa Supabase: autenticación real y
 * progreso persistido en la base. Vacíos, usa almacenamiento local del
 * navegador — útil para demo y desarrollo sin backend.
 *
 * La anonKey es pública por diseño: lo que protege los datos es RLS, no
 * esconder la clave. Nunca poner aquí la service_role.
 */
window.IPRAF_CONFIG = {
  url: "",       // https://xxxx.supabase.co
  anonKey: ""    // clave pública (anon / publishable)
};
