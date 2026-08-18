/**
 * Lógica de interfaz: formulario, listado, previsualización de portada.
 * No accede a Supabase directamente, usa las funciones de storage.js.
 */

const form = document.getElementById('form-libro');
const inputFechaFin = document.getElementById('fechaFin');
const inputPortada = document.getElementById('portada');
const previewPortada = document.getElementById('preview-portada');
const listaLibros = document.getElementById('lista-libros');
const listaVacia = document.getElementById('lista-vacia');
const contadorLibros = document.getElementById('contador-libros');
const btnSubmit = form.querySelector('.btn-primary');

let portadaFile = null;

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
    portadaFile = null;
    previewPortada.hidden = true;

    await renderLibros();
  } catch (error) {
    alert('No se pudo guardar el libro. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Añadir libro';
  }
});

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

function crearElementoLibro(libro) {
  const li = document.createElement('li');
  li.className = 'libro-item';

  const estadoLectura = libro.dias !== null
    ? `${libro.dias} día${libro.dias === 1 ? '' : 's'}`
    : `Terminado el ${formatearFecha(libro.fechaFin)}`;

  const rangoFechas = libro.fechaInicioCalculada
    ? `${formatearFecha(libro.fechaInicioCalculada)} → ${formatearFecha(libro.fechaFin)}`
    : '';

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
      ${rangoFechas ? `<p class="libro-fechas">${rangoFechas}</p>` : ''}
      <p class="libro-dias">${estadoLectura}</p>
    </div>
    <button class="btn-eliminar" data-id="${libro.id}" aria-label="Eliminar libro">✕</button>
  `;

  return li;
}

async function renderLibros() {
  const librosAsc = await getLibros();
  const librosConRangos = calcularRangosLectura(librosAsc);
  const librosDesc = librosConRangos.slice().reverse();

  contadorLibros.textContent = `${librosAsc.length} libro${librosAsc.length === 1 ? '' : 's'} en tu historial`;

  listaLibros.innerHTML = '';

  if (librosDesc.length === 0) {
    listaVacia.hidden = false;
    return;
  }

  listaVacia.hidden = true;
  librosDesc.forEach((libro) => {
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
