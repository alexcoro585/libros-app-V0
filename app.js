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

let portadaFile = null;

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
 * Le pide a la funcion de servidor (que a su vez usa Gemini) que lea el
 * titulo y el autor de la portada, y rellena el formulario si esos
 * campos siguen vacios. Si algo falla, no pasa nada: se rellenan a mano.
 */
async function intentarLeerPortada(file) {
  if (inputTitulo.value.trim() || inputAutor.value.trim()) return;

  estadoLecturaIA.hidden = false;
  estadoLecturaIA.textContent = 'Leyendo portada...';

  try {
    const comprimida = await comprimirImagen(file, 800);
    const imagenBase64 = await blobABase64(comprimida);

    const respuesta = await fetch('/api/leer-portada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagenBase64 }),
    });
    const datos = await respuesta.json();

    if (datos.titulo) inputTitulo.value = datos.titulo;
    if (datos.autor) inputAutor.value = datos.autor;

    estadoLecturaIA.hidden = !(datos.titulo || datos.autor);
    estadoLecturaIA.textContent = 'Rellenado automáticamente, revisa que esté bien.';
  } catch (error) {
    console.error('No se pudo leer la portada automáticamente:', error);
    estadoLecturaIA.hidden = true;
  }
}

// Guardamos el archivo real (se sube a Supabase Storage al enviar el
// formulario), mostramos una vista previa local, e intentamos rellenar
// título/autor automáticamente leyendo la portada.
inputPortada.addEventListener('change', () => {
  const file = inputPortada.files[0];
  portadaFile = file || null;

  if (!file) {
    previewPortada.hidden = true;
    estadoLecturaIA.hidden = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    previewPortada.src = reader.result;
    previewPortada.hidden = false;
  };
  reader.readAsDataURL(file);

  intentarLeerPortada(file);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const titulo = document.getElementById('titulo').value.trim();
  const autor = document.getElementById('autor').value.trim();
  const fechaFin = inputFechaFin.value;

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  try {
    await saveLibro({ titulo, autor, fechaFin, portadaFile });

    form.reset();
    inputFechaFin.value = hoyISO();
    portadaFile = null;
    previewPortada.hidden = true;
    estadoLecturaIA.hidden = true;

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
