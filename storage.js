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
    esImportado: row.es_importado,
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
 * Redimensiona y comprime una imagen antes de subirla, para no gastar
 * espacio de más: en la lista solo se muestra como una miniatura, así
 * que no hace falta la resolución original de la foto del móvil.
 * @param {File} file
 * @param {number} maxLado - tamaño máximo (px) del lado más largo
 * @returns {Promise<Blob>}
 */
async function comprimirImagen(file, maxLado = 800) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.8);
  });
}

/**
 * Sube la portada al bucket `libros-portadas` y devuelve su URL pública.
 * @param {File} file
 * @returns {Promise<string|null>}
 */
async function subirPortada(file) {
  const imagenComprimida = await comprimirImagen(file);
  const nombreArchivo = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseClient.storage
    .from('libros-portadas')
    .upload(nombreArchivo, imagenComprimida, { contentType: 'image/jpeg' });

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

/**
 * Actualiza titulo, autor y/o fecha de fin de un libro ya existente.
 * Los libros del historial importado (esImportado) no se editan desde
 * la app.
 * @param {string} id
 * @param {Object} cambios - { titulo, autor, fechaFin }
 */
async function updateLibro(id, cambios) {
  const { error } = await supabaseClient
    .from('libros')
    .update({
      titulo: cambios.titulo,
      autor: cambios.autor,
      fecha_fin: cambios.fechaFin,
    })
    .eq('id', id);

  if (error) {
    console.error('Error al actualizar el libro:', error);
    throw error;
  }
}
