/**
 * Lógica de la portada: formulario de añadir libro y previsualización
 * de portada. No accede a Supabase directamente, usa storage.js.
 * El listado completo vive en historial.js / historial.html.
 */

const form = document.getElementById('form-libro');
const inputTitulo = document.getElementById('titulo');
const inputAutor = document.getElementById('autor');
const inputFechaFin = document.getElementById('fechaFin');
const inputPortada = document.getElementById('portada');
const previewPortada = document.getElementById('preview-portada');
const estadoLecturaIA = document.getElementById('estado-lectura-ia');
const btnSubmit = form.querySelector('.btn-primary');

// La foto elegida, ya comprimida una sola vez y reutilizada para todo:
// vista previa, lectura con IA y subida a Supabase.
let portadaComprimida = null;
// Promesa de la subida, que arranca al elegir la foto y no al guardar.
let subidaPortada = null;
// Cada foto elegida incrementa esto, para descartar resultados de una
// foto anterior si el usuario cambia de imagen a mitad.
let generacionPortada = 0;
let urlPreview = null;

// Al abrir la app, lo normal es haber terminado el libro hoy mismo.
inputFechaFin.value = hoyISO();

function blobABase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Muestra el mensajito que hay bajo el campo de portada.
 * `tipo` es 'info' (en curso / todo bien) o 'error' (algo ha fallado).
 */
function mostrarEstadoIA(texto, tipo = 'info') {
  estadoLecturaIA.hidden = false;
  estadoLecturaIA.textContent = texto;
  estadoLecturaIA.classList.toggle('estado-lectura-ia--error', tipo === 'error');
}

function ocultarEstadoIA() {
  estadoLecturaIA.hidden = true;
  estadoLecturaIA.classList.remove('estado-lectura-ia--error');
}

/**
 * Le pide a la funcion de servidor (que a su vez usa Gemini) que lea el
 * titulo y el autor de la portada, y rellena el formulario si esos
 * campos siguen vacios.
 *
 * Si algo falla se dice en pantalla en vez de callarselo: antes un fallo
 * de red, una funcion sin desplegar o una clave sin configurar dejaban
 * el formulario vacio sin ninguna explicacion.
 */
async function intentarLeerPortada(comprimida, generacion) {
  if (inputTitulo.value.trim() || inputAutor.value.trim()) {
    mostrarEstadoIA('Titulo y autor ya escritos: no se lee la portada. Vacialos y vuelve a elegir la foto si quieres que los lea.');
    return;
  }

  let imagenBase64;
  try {
    imagenBase64 = await blobABase64(comprimida);
  } catch (error) {
    console.error('No se pudo preparar la imagen para leerla:', error);
    mostrarEstadoIA('No se pudo procesar la foto. Escribe titulo y autor a mano.', 'error');
    return;
  }

  let respuesta;
  try {
    respuesta = await fetch('/api/leer-portada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagenBase64 }),
    });
  } catch (error) {
    console.error('No se pudo contactar con /api/leer-portada:', error);
    mostrarEstadoIA('Sin conexion con el servidor. Escribe titulo y autor a mano.', 'error');
    return;
  }

  const cuerpo = await respuesta.text();
  let datos = null;
  try {
    datos = JSON.parse(cuerpo);
  } catch (error) {
    // Respuesta que no es JSON: casi siempre el HTML de un 404, es decir
    // que /api/leer-portada no existe en el sitio donde esta corriendo
    // la app (por ejemplo sirviendola en local con un servidor estatico).
    console.error('Respuesta no-JSON de /api/leer-portada:', respuesta.status, cuerpo.slice(0, 200));
    mostrarEstadoIA(`La funcion /api/leer-portada no responde (HTTP ${respuesta.status}). Solo funciona en el despliegue de Vercel, no en un servidor estatico local.`, 'error');
    return;
  }

  if (!respuesta.ok) {
    console.error('Error de /api/leer-portada:', respuesta.status, datos);
    mostrarEstadoIA(`No se pudo leer la portada: ${datos.error || `HTTP ${respuesta.status}`}`, 'error');
    return;
  }

  if (!datos.titulo && !datos.autor) {
    mostrarEstadoIA('No se ha podido leer el titulo ni el autor de esta foto. Escribelos a mano.', 'error');
    return;
  }

  if (generacion !== generacionPortada) return; // el usuario cambio de foto

  if (datos.titulo) inputTitulo.value = datos.titulo;
  if (datos.autor) inputAutor.value = datos.autor;
  mostrarEstadoIA('Rellenado automaticamente, revisa que este bien.');
}

/**
 * Al elegir una foto hacemos, en este orden y sin bloquear nada:
 *   1. vista previa inmediata con createObjectURL (no leemos la foto
 *      entera a base64 solo para enseñarla),
 *   2. una unica compresion, que antes se hacia dos veces: una para la
 *      IA y otra al subirla,
 *   3. subida a Supabase en segundo plano, para que al darle a Guardar
 *      no haya que esperar a nada,
 *   4. lectura con IA, que es lo lento y ocurre mientras el usuario
 *      rellena la fecha.
 */
inputPortada.addEventListener('change', async () => {
  const file = inputPortada.files[0];
  const generacion = ++generacionPortada;

  if (urlPreview) URL.revokeObjectURL(urlPreview);
  portadaComprimida = null;
  subidaPortada = null;

  if (!file) {
    previewPortada.hidden = true;
    ocultarEstadoIA();
    return;
  }

  urlPreview = URL.createObjectURL(file);
  previewPortada.src = urlPreview;
  previewPortada.hidden = false;

  mostrarEstadoIA('Leyendo portada...');

  let comprimida;
  try {
    comprimida = await comprimirImagen(file, 800);
  } catch (error) {
    console.error('No se pudo procesar la foto:', error);
    mostrarEstadoIA('No se pudo procesar la foto (¿formato raro, tipo HEIC?). Escribe titulo y autor a mano.', 'error');
    return;
  }

  if (generacion !== generacionPortada) return; // hay una foto mas nueva

  portadaComprimida = comprimida;
  subidaPortada = subirPortada(comprimida);
  // Si falla la subida el libro se guarda sin portada, igual que antes.
  subidaPortada.catch(() => null);

  await intentarLeerPortada(comprimida, generacion);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const titulo = document.getElementById('titulo').value.trim();
  const autor = document.getElementById('autor').value.trim();
  const fechaFin = inputFechaFin.value;

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  try {
    // La subida arranco al elegir la foto, asi que normalmente esto ya
    // esta resuelto y no se espera nada.
    const portadaUrl = subidaPortada ? await subidaPortada : null;

    await saveLibro({ titulo, autor, fechaFin, portadaUrl });

    form.reset();
    inputFechaFin.value = hoyISO();
    generacionPortada++;
    portadaComprimida = null;
    subidaPortada = null;
    if (urlPreview) { URL.revokeObjectURL(urlPreview); urlPreview = null; }
    previewPortada.hidden = true;
    ocultarEstadoIA();

    await actualizarContador();

    btnSubmit.textContent = '¡Guardado! ✓';
    setTimeout(() => {
      btnSubmit.textContent = 'Añadir libro';
    }, 1200);
  } catch (error) {
    alert('No se pudo guardar el libro. Revisa tu conexión e inténtalo de nuevo.');
    btnSubmit.textContent = 'Añadir libro';
  } finally {
    btnSubmit.disabled = false;
  }
});
