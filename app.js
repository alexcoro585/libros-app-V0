/**
 * Lógica de interfaz: formulario, listado, previsualización de portada.
 * No accede a localStorage directamente, usa las funciones de storage.js.
 */

const form = document.getElementById('form-libro');
const inputFechaFin = document.getElementById('fechaFin');
const checkboxEnCurso = document.getElementById('enCurso');
const inputPortada = document.getElementById('portada');
const previewPortada = document.getElementById('preview-portada');
const listaLibros = document.getElementById('lista-libros');
const listaVacia = document.getElementById('lista-vacia');

let portadaBase64 = null;

// Si el usuario marca "en curso", deshabilitamos la fecha de fin.
checkboxEnCurso.addEventListener('change', () => {
  inputFechaFin.disabled = checkboxEnCurso.checked;
  if (checkboxEnCurso.checked) {
    inputFechaFin.value = '';
  }
});

// Convertimos la foto a base64 para poder guardarla en localStorage
// y mostramos una vista previa.
inputPortada.addEventListener('change', () => {
  const file = inputPortada.files[0];
  if (!file) {
    portadaBase64 = null;
    previewPortada.hidden = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    portadaBase64 = reader.result;
    previewPortada.src = portadaBase64;
    previewPortada.hidden = false;
  };
  reader.readAsDataURL(file);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const titulo = document.getElementById('titulo').value.trim();
  const autor = document.getElementById('autor').value.trim();
  const fechaInicio = document.getElementById('fechaInicio').value;
  const fechaFin = checkboxEnCurso.checked ? null : (inputFechaFin.value || null);

  saveLibro({
    titulo,
    autor,
    fechaInicio,
    fechaFin,
    portada: portadaBase64,
  });

  form.reset();
  portadaBase64 = null;
  previewPortada.hidden = true;
  inputFechaFin.disabled = false;

  renderLibros();
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

function renderLibros() {
  const libros = getLibros();
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

listaLibros.addEventListener('click', (event) => {
  const boton = event.target.closest('.btn-eliminar');
  if (!boton) return;

  deleteLibro(boton.dataset.id);
  renderLibros();
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
