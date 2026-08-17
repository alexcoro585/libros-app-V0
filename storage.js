/**
 * Capa de datos de la app.
 * V0: todo se guarda en localStorage.
 * Más adelante, para migrar a Supabase, solo hay que reescribir el
 * contenido de estas funciones (getLibros, saveLibro, deleteLibro...),
 * el resto de la app (app.js) no debería necesitar cambios.
 */

const STORAGE_KEY = 'libros-app:libros';

/**
 * Devuelve todos los libros guardados, ordenados por fecha de inicio
 * descendente (el más reciente primero).
 * @returns {Array<Object>}
 */
function getLibros() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const libros = raw ? JSON.parse(raw) : [];
  return libros.sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
}

/**
 * Guarda un libro nuevo.
 * @param {Object} libro - { titulo, autor, fechaInicio, fechaFin, portada }
 * @returns {Object} el libro guardado, con su id generado
 */
function saveLibro(libro) {
  const libros = getLibros();
  const nuevoLibro = {
    id: crypto.randomUUID(),
    titulo: libro.titulo,
    autor: libro.autor,
    fechaInicio: libro.fechaInicio,
    fechaFin: libro.fechaFin || null,
    portada: libro.portada || null,
  };
  libros.push(nuevoLibro);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(libros));
  return nuevoLibro;
}

/**
 * Elimina un libro por su id.
 * @param {string} id
 */
function deleteLibro(id) {
  const libros = getLibros().filter((libro) => libro.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(libros));
}
