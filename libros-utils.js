/**
 * Utilidades compartidas entre la portada (app.js) y el historial
 * (historial.js): cálculo de fechas/días, contador de libros del año
 * en curso, y registro del service worker.
 */

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function diffDias(fechaA, fechaB) {
  const diffMs = new Date(fechaB) - new Date(fechaA);
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

/**
 * Añade a cada libro su fecha de inicio calculada (el fin del libro
 * anterior) y los días que tardó en leerlo. `libros` debe venir
 * ordenado por fecha de fin ascendente.
 */
function calcularRangosLectura(libros) {
  let fechaFinAnterior = null;

  return libros.map((libro) => {
    const fechaInicioCalculada = fechaFinAnterior;
    const dias = fechaInicioCalculada ? diffDias(fechaInicioCalculada, libro.fechaFin) : null;
    fechaFinAnterior = libro.fechaFin;
    return { ...libro, fechaInicioCalculada, dias };
  });
}

async function actualizarContador() {
  const contadorLibros = document.getElementById('contador-libros');
  if (!contadorLibros) return;

  const libros = await getLibros();
  const anioActual = new Date().getFullYear();
  const librosDelAnio = libros.filter((libro) => libro.fechaFin.startsWith(String(anioActual)));
  contadorLibros.textContent = `${librosDelAnio.length} libro${librosDelAnio.length === 1 ? '' : 's'} en ${anioActual}`;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.error('Error registrando el service worker:', err);
    });
  });
}

actualizarContador();
