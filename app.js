/**
 * Lógica de interfaz: formulario, listado, previsualización de portada.
 * No accede a Supabase directamente, usa las funciones de storage.js.
 */

const form = document.getElementById('form-libro');
const inputFechaFin = document.getElementById('fechaFin');
const checkboxEnCurso = document.getElementById('enCurso');
const inputPortada = document.getElementById('portada');
const previewPortada = document.getElementById('preview-portada');
const listaLibros = document.getElementById('lista-libros');
const listaVacia = document.getElementById('lista-vacia');
const btnSubmit = form.querySelector('.btn-primary');

let portadaFile = null;

// Si el usuario marca "en curso", deshabilitamos la fecha de fin.
checkboxEnCurso.addEventListener('change', () => {
  inputFechaFin.disabled = checkboxEnCurso.checked;
  if (checkboxEnCurso.checked) {
    inputFechaFin.value = '';
  }
});

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
  const fechaInicio = document.getElementById('fechaInicio').value;
  const fechaFin = checkboxEnCurso.checked ? null : (inputFechaFin.value || null);

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  try {
    await saveLibro({
      titulo,
      autor,
      fechaInicio,
      fechaFin,
      portadaFile,
    });

    form.reset();
    portadaFile = null;
    previewPortada.hidden = true;
    inputFechaFin.disabled = false;

    await renderLibros();
  } catch (error) {
    alert('No se pudo guardar el libro. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Añadir libro';
  }
});

/**
 * Calcula los días entre fecha de inicio y fecha de fin.
 * Si no hay fecha de fin, devuelve null (libro en curso).
 */
function calcularDias(fechaInicio, fechaFin) {
  if (!fechaFin) return null;
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);
  const diffMs = fin - inicio;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

function crearElementoLibro(libro) {
  const li = document.createElement('li');
  li.className = 'libro-item';

  const dias = calcularDias(libro.fechaInicio, libro.fechaFin);
  const estadoLectura = libro.fechaFin
    ? `${dias} día${dias === 1 ? '' : 's'}`
    : 'En curso';

  const portadaSrc = libro.portada || '';

  li.innerHTML = `
    <div class="libro-portada">
      ${
        portadaSrc
          ? `<img src="${portadaSrc}" alt="Portada de ${libro.titulo}">`
          : `<div class="libro-portada-placeholder">📖</div>`
      }
    </div>
    <div class="libro-info">
      <h3 class="libro-titulo">${libro.titulo}</h3>
      <p class="libro-autor">${libro.autor}</p>
      <p class="libro-fechas">${formatearFecha(libro.fechaInicio)} ${libro.fechaFin ? '→ ' + formatearFecha(libro.fechaFin) : ''}</p>
      <p class="libro-dias">${estadoLectura}</p>
    </div>
    <button class="btn-eliminar" data-id="${libro.id}" aria-label="Eliminar libro">✕</button>
  `;

  return li;
}

async function renderLibros() {
  const libros = await getLibros();
  listaLibros.innerHTML = '';

  if (libros.length === 0) {
    listaVacia.hidden = false;
    return;
  }

  listaVacia.hidden = true;
  libros.forEach((libro) => {
    listaLibros.appendChild(crearElementoLibro(libro));
  });
}

listaLibros.addEventListener('click', async (event) => {
  const boton = event.target.closest('.btn-eliminar');
  if (!boton) return;

  await deleteLibro(boton.dataset.id);
  await renderLibros();
});

// Registro del service worker para funcionalidad PWA.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.error('Error registrando el service worker:', err);
    });
  });
}

renderLibros();
