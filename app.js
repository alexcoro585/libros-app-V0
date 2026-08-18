/**
 * Lógica de la portada: formulario de añadir libro y previsualización
 * de portada. No accede a Supabase directamente, usa storage.js.
 * El listado completo vive en historial.js / historial.html.
 */

const form = document.getElementById('form-libro');
const inputFechaFin = document.getElementById('fechaFin');
const inputPortada = document.getElementById('portada');
const previewPortada = document.getElementById('preview-portada');
const btnSubmit = form.querySelector('.btn-primary');

let portadaFile = null;

// Al abrir la app, lo normal es haber terminado el libro hoy mismo.
inputFechaFin.value = hoyISO();

// Guardamos el archivo real (se sube a Supabase Storage al enviar el
// formulario) y mostramos una vista previa local mientras tanto.
inputPortada.addEventListener('change', () => {
  const file = inputPortada.files[0];
  portadaFile = file || null;

  if (!file) {
    previewPortada.hidden = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    previewPortada.src = reader.result;
    previewPortada.hidden = false;
  };
  reader.readAsDataURL(file);
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
