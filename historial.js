/**
 * Lógica de la pantalla de historial: lista completa de libros con
 * filtro por año. No accede a Supabase directamente, usa storage.js.
 */

const listaLibros = document.getElementById('lista-libros');
const listaVacia = document.getElementById('lista-vacia');
const filtroAnio = document.getElementById('filtro-anio');
const totalPeriodo = document.getElementById('total-periodo');

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
  li.dataset.id = libro.id;

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
    <div class="libro-acciones">
      ${libro.esImportado ? '' : `<button class="btn-editar" data-id="${libro.id}" aria-label="Editar libro">✎</button>`}
      <button class="btn-eliminar" data-id="${libro.id}" aria-label="Eliminar libro">✕</button>
    </div>
  `;

  return li;
}

function crearFormularioEdicion(libro) {
  const div = document.createElement('div');
  div.className = 'form-edicion';
  div.innerHTML = `
    <label>Título</label>
    <input type="text" class="input-editar-titulo" value="${libro.titulo}">
    <label>Autor</label>
    <input type="text" class="input-editar-autor" value="${libro.autor}">
    <label>Fecha en la que lo terminaste</label>
    <input type="date" class="input-editar-fecha" value="${libro.fechaFin}">
    <div class="form-edicion-botones">
      <button type="button" class="btn-guardar-edicion">Guardar</button>
      <button type="button" class="btn-cancelar-edicion">Cancelar</button>
    </div>
  `;
  return div;
}

function renderLista() {
  const anioSeleccionado = filtroAnio.value;
  const librosFiltrados = anioSeleccionado === 'todos'
    ? todosLosLibros
    : todosLosLibros.filter((libro) => libro.fechaFin.startsWith(anioSeleccionado));

  const librosDesc = librosFiltrados.slice().reverse();

  totalPeriodo.textContent = anioSeleccionado === 'todos'
    ? `${librosFiltrados.length} libro${librosFiltrados.length === 1 ? '' : 's'} en total`
    : `${librosFiltrados.length} libro${librosFiltrados.length === 1 ? '' : 's'} en ${anioSeleccionado}`;

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
  const botonEliminar = event.target.closest('.btn-eliminar');
  if (botonEliminar) {
    await deleteLibro(botonEliminar.dataset.id);
    await cargarHistorial();
    await actualizarContador();
    return;
  }

  const botonEditar = event.target.closest('.btn-editar');
  if (botonEditar) {
    const li = botonEditar.closest('.libro-item');
    const libro = todosLosLibros.find((l) => l.id === botonEditar.dataset.id);
    const infoOriginal = li.innerHTML;
    li.innerHTML = '';
    li.appendChild(crearFormularioEdicion(libro));
    li.dataset.infoOriginal = infoOriginal;
    return;
  }

  const botonCancelar = event.target.closest('.btn-cancelar-edicion');
  if (botonCancelar) {
    const li = botonCancelar.closest('.libro-item');
    li.innerHTML = li.dataset.infoOriginal;
    return;
  }

  const botonGuardar = event.target.closest('.btn-guardar-edicion');
  if (botonGuardar) {
    const li = botonGuardar.closest('.libro-item');
    const titulo = li.querySelector('.input-editar-titulo').value.trim();
    const autor = li.querySelector('.input-editar-autor').value.trim();
    const fechaFin = li.querySelector('.input-editar-fecha').value;

    if (!titulo || !autor || !fechaFin) {
      alert('Rellena título, autor y fecha antes de guardar.');
      return;
    }

    await updateLibro(li.dataset.id, { titulo, autor, fechaFin });
    await cargarHistorial();
    await actualizarContador();
  }
});

cargarHistorial();
