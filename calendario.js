/**
 * Lógica de la pantalla de calendario: vista anual con un mini-calendario
 * por mes (coloreado por libro), y al pulsar un mes se entra en el
 * detalle día a día. No accede a Supabase directamente, usa storage.js.
 */

const PALETA_COLORES = [
  '#2f6f4f', '#b8792f', '#5b7fb8', '#a4534f',
  '#6f8f3f', '#8a5fa8', '#4f8f8a', '#c25b7f',
  '#7f6f3f', '#3f6f8f',
];

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const NOMBRES_MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const btnVolverAnio = document.getElementById('btn-volver-anio');
const navAnterior = document.getElementById('nav-anterior');
const navSiguiente = document.getElementById('nav-siguiente');
const tituloCalendario = document.getElementById('calendario-titulo');
const vistaAnual = document.getElementById('vista-anual');
const vistaMensual = document.getElementById('vista-mensual');
const gridCalendario = document.getElementById('calendario-grid');
const detalleCalendario = document.getElementById('calendario-detalle');
const leyendaCalendario = document.getElementById('calendario-leyenda');
const totalPeriodo = document.getElementById('total-periodo');

let librosConRangos = [];
let mapaDias = new Map(); // fechaISO -> índice en librosConRangos

let modo = 'anio'; // 'anio' | 'mes'
let anioVisible = new Date().getFullYear();
let mesVisible = new Date().getMonth();

/**
 * Asigna cada día, desde el inicio calculado de cada libro hasta su fin,
 * al libro correspondiente. En el día límite compartido entre un libro y
 * el siguiente, se queda con el libro que termina ese día.
 */
function construirMapaDias(libros) {
  const mapa = new Map();

  libros.forEach((libro, indice) => {
    const inicioISO = libro.fechaInicioCalculada || libro.fechaFin;
    const cursor = new Date(`${inicioISO}T00:00:00`);
    const fin = new Date(`${libro.fechaFin}T00:00:00`);

    while (cursor <= fin) {
      const iso = fechaALocalISO(cursor);
      if (!mapa.has(iso)) {
        mapa.set(iso, indice);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return mapa;
}

function indicesEnRango(fechaInicioISO, fechaFinISO) {
  const indices = new Set();
  for (const [iso, indice] of mapaDias.entries()) {
    if (iso >= fechaInicioISO && iso <= fechaFinISO) {
      indices.add(indice);
    }
  }
  return indices;
}

/**
 * Cuenta libros terminados dentro del rango (mismo criterio que el
 * contador de la cabecera y el historial), a diferencia de
 * indicesEnRango, que cuenta tambien libros que solo se solapan con
 * el rango sin haber terminado en el.
 */
function contarTerminadosEnRango(fechaInicioISO, fechaFinISO) {
  return librosConRangos.filter(
    (libro) => libro.fechaFin >= fechaInicioISO && libro.fechaFin <= fechaFinISO
  ).length;
}

function renderLeyenda(indices) {
  leyendaCalendario.innerHTML = '';
  if (indices.size === 0) {
    leyendaCalendario.innerHTML = '<p class="lista-vacia">Sin lecturas registradas.</p>';
    return;
  }

  [...indices].sort((a, b) => a - b).forEach((indice) => {
    const libro = librosConRangos[indice];
    const item = document.createElement('div');
    item.className = 'calendario-leyenda-item';
    item.innerHTML = `
      <span class="calendario-leyenda-color" style="background-color: ${PALETA_COLORES[indice % PALETA_COLORES.length]}"></span>
      <span>${libro.titulo}</span>
    `;
    leyendaCalendario.appendChild(item);
  });
}

function mostrarDetalleLibro(libro) {
  detalleCalendario.hidden = false;
  detalleCalendario.innerHTML = `
    <div class="calendario-detalle-portada">
      ${
        libro.portada
          ? `<img src="${libro.portada}" alt="Portada de ${libro.titulo}">`
          : `<div class="libro-portada-placeholder">📖</div>`
      }
    </div>
    <div>
      <h3 class="libro-titulo">${libro.titulo}</h3>
      <p class="libro-autor">${libro.autor}</p>
      <p class="libro-fechas">
        ${libro.fechaInicioCalculada ? formatearFecha(libro.fechaInicioCalculada) + ' → ' : ''}${formatearFecha(libro.fechaFin)}
      </p>
    </div>
  `;
}

function irAMes(anio, mes) {
  modo = 'mes';
  anioVisible = anio;
  mesVisible = mes;
  detalleCalendario.hidden = true;
  render();
}

function irAAnio() {
  modo = 'anio';
  detalleCalendario.hidden = true;
  render();
}

function crearMiniMes(anio, mes) {
  const primerDiaMes = new Date(anio, mes, 1);
  const ultimoDiaMes = new Date(anio, mes + 1, 0);
  const diaSemanaInicio = (primerDiaMes.getDay() + 6) % 7;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'mini-mes';

  const grid = document.createElement('div');
  grid.className = 'mini-mes-grid';

  for (let i = 0; i < diaSemanaInicio; i++) {
    grid.appendChild(document.createElement('span'));
  }

  for (let dia = 1; dia <= ultimoDiaMes.getDate(); dia++) {
    const iso = fechaALocalISO(new Date(anio, mes, dia));
    const indiceLibro = mapaDias.get(iso);
    const celda = document.createElement('span');
    if (indiceLibro !== undefined) {
      celda.style.backgroundColor = PALETA_COLORES[indiceLibro % PALETA_COLORES.length];
    }
    grid.appendChild(celda);
  }

  boton.innerHTML = `<span class="mini-mes-titulo">${NOMBRES_MES_CORTO[mes]}</span>`;
  boton.appendChild(grid);
  boton.addEventListener('click', () => irAMes(anio, mes));
  return boton;
}

function renderVistaAnual() {
  vistaAnual.hidden = false;
  vistaMensual.hidden = true;
  btnVolverAnio.hidden = true;

  tituloCalendario.textContent = String(anioVisible);

  vistaAnual.innerHTML = '';
  for (let mes = 0; mes < 12; mes++) {
    vistaAnual.appendChild(crearMiniMes(anioVisible, mes));
  }

  const totalAnio = contarTerminadosEnRango(`${anioVisible}-01-01`, `${anioVisible}-12-31`);
  totalPeriodo.textContent = `${totalAnio} libro${totalAnio === 1 ? '' : 's'} en ${anioVisible}`;
  renderLeyenda(indicesEnRango(`${anioVisible}-01-01`, `${anioVisible}-12-31`));
}

function renderVistaMensual() {
  vistaAnual.hidden = true;
  vistaMensual.hidden = false;
  btnVolverAnio.hidden = false;

  tituloCalendario.textContent = `${NOMBRES_MES[mesVisible]} ${anioVisible}`;

  const primerDiaMes = new Date(anioVisible, mesVisible, 1);
  const ultimoDiaMes = new Date(anioVisible, mesVisible + 1, 0);
  const diaSemanaInicio = (primerDiaMes.getDay() + 6) % 7;

  gridCalendario.innerHTML = '';

  for (let i = 0; i < diaSemanaInicio; i++) {
    gridCalendario.appendChild(document.createElement('div'));
  }

  for (let dia = 1; dia <= ultimoDiaMes.getDate(); dia++) {
    const iso = fechaALocalISO(new Date(anioVisible, mesVisible, dia));
    const indiceLibro = mapaDias.get(iso);

    const celda = document.createElement('button');
    celda.type = 'button';
    celda.className = 'calendario-dia';
    celda.textContent = String(dia);

    if (indiceLibro !== undefined) {
      const libro = librosConRangos[indiceLibro];
      celda.style.backgroundColor = PALETA_COLORES[indiceLibro % PALETA_COLORES.length];
      celda.classList.add('calendario-dia--con-libro');
      if (libro.fechaFin === iso) {
        celda.classList.add('calendario-dia--fin');
      }
      celda.addEventListener('click', () => mostrarDetalleLibro(libro));
    } else {
      celda.disabled = true;
    }

    gridCalendario.appendChild(celda);
  }

  const ultimoDiaISO = fechaALocalISO(ultimoDiaMes);
  const primerDiaISO = fechaALocalISO(primerDiaMes);
  const totalMes = contarTerminadosEnRango(primerDiaISO, ultimoDiaISO);
  totalPeriodo.textContent = `${totalMes} libro${totalMes === 1 ? '' : 's'} terminado${totalMes === 1 ? '' : 's'} este mes`;
  renderLeyenda(indicesEnRango(primerDiaISO, ultimoDiaISO));
}

function render() {
  if (modo === 'anio') {
    renderVistaAnual();
  } else {
    renderVistaMensual();
  }
}

navAnterior.addEventListener('click', () => {
  if (modo === 'anio') {
    anioVisible -= 1;
  } else {
    mesVisible -= 1;
    if (mesVisible < 0) {
      mesVisible = 11;
      anioVisible -= 1;
    }
  }
  detalleCalendario.hidden = true;
  render();
});

navSiguiente.addEventListener('click', () => {
  if (modo === 'anio') {
    anioVisible += 1;
  } else {
    mesVisible += 1;
    if (mesVisible > 11) {
      mesVisible = 0;
      anioVisible += 1;
    }
  }
  detalleCalendario.hidden = true;
  render();
});

btnVolverAnio.addEventListener('click', irAAnio);

async function cargarCalendario() {
  const librosAsc = await getLibros();
  librosConRangos = calcularRangosLectura(librosAsc);
  mapaDias = construirMapaDias(librosConRangos);
  render();
}

cargarCalendario();
