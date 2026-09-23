/**
 * Mantiene despierto el proyecto de Supabase.
 *
 * El plan gratuito pausa los proyectos que pasan varios dias sin
 * actividad, y al pausarse deja de resolver hasta su dominio: la app se
 * queda sin historial y sin poder guardar. Un cron diario (configurado
 * en vercel.json) llama a esta funcion, que hace una consulta minima y
 * cuenta como actividad.
 *
 * Las credenciales son las mismas publicas que ya usa el navegador en
 * storage.js, asi que no hace falta ninguna variable de entorno.
 */

const SUPABASE_URL = 'https://jddklucqhsoqntrnrkbq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q0RUn8VkBG4F7j7InGhsGw_SczAuE7h';

export default async function handler(req, res) {
  try {
    const respuesta = await fetch(
      `${SUPABASE_URL}/rest/v1/libros?select=id&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error('Supabase no respondio bien al ping:', respuesta.status, detalle.slice(0, 200));
      res.status(502).json({ ok: false, estado: respuesta.status });
      return;
    }

    res.status(200).json({ ok: true, momento: new Date().toISOString() });
  } catch (error) {
    console.error('No se pudo contactar con Supabase:', error);
    res.status(502).json({ ok: false, error: error.message });
  }
}
