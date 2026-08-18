/**
 * Capa de datos de la app.
 * Guarda los libros en Supabase (tabla `libros`) y las portadas en
 * Supabase Storage (bucket `libros-portadas`). El resto de la app (app.js)
 * solo conoce estas funciones, no sabe nada de Supabase.
 *
 * Cada libro solo guarda su fecha de fin: la fecha de inicio se calcula
 * en app.js a partir del fin del libro anterior (se lee uno detrás de otro).
 */

const SUPABASE_URL = 'https://jddklucqhsoqntrnrkbq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q0RUn8VkBG4F7j7InGhsGw_SczAuE7h';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function mapRowToLibro(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    autor: row.autor,
    fechaFin: row.fecha_fin,
    portada: row.portada_url,
  };
}

/**
 * Devuelve todos los libros guardados, ordenados por fecha de fin
 * ascendente (el más antiguo primero).
 * @returns {Promise<Array<Object>>}
 */
async function getLibros() {
  const { data, error } = await supabaseClient
    .from('libros')
    .select('*')
    .order('fecha_fin', { ascending: true });

  if (error) {
    console.error('Error al obtener los libros:', error);
    return [];
  }
  return data.map(mapRowToLibro);
}

/**
 * Sube la portada al bucket `libros-portadas` y devuelve su URL pública.
 * @param {File} file
 * @returns {Promise<string|null>}
 */
async function subirPortada(file) {
  const nombreArchivo = `${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabaseClient.storage
    .from('libros-portadas')
    .upload(nombreArchivo, file);

  if (error) {
    console.error('Error al subir la portada:', error);
    return null;
  }

  const { data } = supabaseClient.storage.from('libros-portadas').getPublicUrl(nombreArchivo);
  return data.publicUrl;
}

/**
 * Guarda un libro nuevo.
 * @param {Object} libro - { titulo, autor, fechaFin, portadaFile }
 * @returns {Promise<Object>} el libro guardado, con su id generado
 */
async function saveLibro(libro) {
  const portadaUrl = libro.portadaFile ? await subirPortada(libro.portadaFile) : null;

  const { data, error } = await supabaseClient
    .from('libros')
    .insert({
      titulo: libro.titulo,
      autor: libro.autor,
      fecha_fin: libro.fechaFin || null,
      portada_url: portadaUrl,
    })
    .select()
    .single();

  if (error) {
    console.error('Error al guardar el libro:', error);
    throw error;
  }
  return mapRowToLibro(data);
}

/**
 * Elimina un libro por su id.
 * @param {string} id
 */
async function deleteLibro(id) {
  const { error } = await supabaseClient.from('libros').delete().eq('id', id);
  if (error) {
    console.error('Error al eliminar el libro:', error);
  }
}
