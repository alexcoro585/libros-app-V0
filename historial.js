/**
 * Lógica de la pantalla de historial: lista completa de libros con
 * filtro por año. No accede a Supabase directamente, usa storage.js.
 */

const listaLibros = document.getElementById('lista-libros');
const listaVacia = document.getElementById('lista-vacia');
const filtroAnio = document.getElementById('filtro-anio');

let todosLosLibros = []; // ascendente por fecha de fin, con rangos ya calculados

function poblarFiltroAnios(libros) {
  const anios = [...new Set(libros.map((libro) => libro.fechaFin.slice(0, 4)))]
    .sort((a, b) => b.localeCompare(a));

  filtroAnio.innerHTML = ['<option value="todos">Todos los años</option>']
    .concat(anios.map((anio) => `<option value="${anio}">${anio}</option>`))
    .join('');
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

function renderLista() {
  const anioSeleccionado = filtroAnio.value;
  const librosFiltrados = anioSeleccionado === 'todos'
    ? todosLosLibros
    : todosLosLibros.filter((libro) => libro.fechaFin.startsWith(anioSeleccionado));

  const librosDesc = librosFiltrados.slice().reverse();

  listaLibros.innerHTML = '';

  if (librosDesc.length === 0) {
    listaVacia.textContent = todosLosLibros.length === 0
      ? 'Todavía no has añadido ningún libro.'
      : `No hay libros registrados en ${anioSeleccionado}.`;
    listaVacia.hidden = false;
    return;
  }

  listaVacia.hidden = true;
  librosDesc.forEach((libro) => {
    listaLibros.appendChild(crearElementoLibro(libro));
  });
}

async function cargarHistorial() {
  const librosAsc = await getLibros();
  todosLosLibros = calcularRangosLectura(librosAsc);
  poblarFiltroAnios(todosLosLibros);
  renderLista();
}

filtroAnio.addEventListener('change', renderLista);

listaLibros.addEventListener('click', async (event) => {
  const boton = event.target.closest('.btn-eliminar');
  if (!boton) return;

  await deleteLibro(boton.dataset.id);
  await cargarHistorial();
  await actualizarContador();
});

cargarHistorial();
