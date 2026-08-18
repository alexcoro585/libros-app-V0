/**
 * Lógica de la pantalla de calendario: muestra, día a día, qué libro se
 * estaba leyendo (desde que terminaste el anterior hasta que terminaste
 * ese). No accede a Supabase directamente, usa storage.js.
 */

const PALETA_COLORES = [
  '#2f6f4f', '#b8792f', '#5b7fb8', '#a4534f',
  '#6f8f3f', '#8a5fa8', '#4f8f8a', '#c25b7f',
  '#7f6f3f', '#3f6f8f',
];

const gridCalendario = document.getElementById('calendario-grid');
const tituloCalendario = document.getElementById('calendario-titulo');
const btnMesAnterior = document.getElementById('mes-anterior');
const btnMesSiguiente = document.getElementById('mes-siguiente');
const detalleCalendario = document.getElementById('calendario-detalle');
const leyendaCalendario = document.getElementById('calendario-leyenda');

let librosConRangos = [];
let mapaDias = new Map(); // fechaISO -> índice en librosConRangos
let mesVisible = new Date(); // se usa solo año/mes; el día se ignora

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

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
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

function renderCalendario() {
  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();

  tituloCalendario.textContent = capitalizar(
    new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(mesVisible)
  );

  const primerDiaMes = new Date(anio, mes, 1);
  const ultimoDiaMes = new Date(anio, mes + 1, 0);
  // Lunes = 0 ... Domingo = 6
  const diaSemanaInicio = (primerDiaMes.getDay() + 6) % 7;

  gridCalendario.innerHTML = '';

  for (let i = 0; i < diaSemanaInicio; i++) {
    gridCalendario.appendChild(document.createElement('div'));
  }

  const librosDelMes = new Set();

  for (let dia = 1; dia <= ultimoDiaMes.getDate(); dia++) {
    const fecha = new Date(anio, mes, dia);
    const iso = fechaALocalISO(fecha);
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
      librosDelMes.add(indiceLibro);
    } else {
      celda.disabled = true;
    }

    gridCalendario.appendChild(celda);
  }

  leyendaCalendario.innerHTML = '';
  if (librosDelMes.size === 0) {
    leyendaCalendario.innerHTML = '<p class="lista-vacia">Sin lecturas registradas este mes.</p>';
  } else {
    [...librosDelMes].sort((a, b) => a - b).forEach((indice) => {
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
}

btnMesAnterior.addEventListener('click', () => {
  mesVisible.setMonth(mesVisible.getMonth() - 1);
  detalleCalendario.hidden = true;
  renderCalendario();
});

btnMesSiguiente.addEventListener('click', () => {
  mesVisible.setMonth(mesVisible.getMonth() + 1);
  detalleCalendario.hidden = true;
  renderCalendario();
});

async function cargarCalendario() {
  const librosAsc = await getLibros();
  librosConRangos = calcularRangosLectura(librosAsc);
  mapaDias = construirMapaDias(librosConRangos);
  renderCalendario();
}

cargarCalendario();
