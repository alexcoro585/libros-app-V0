# Libros App

PWA personal para registrar los libros que termino de leer. Cada libro
guarda titulo, autor, fecha de fin y una foto de la portada. La fecha de
inicio no se guarda: se calcula como la fecha de fin del libro anterior,
porque los leo uno detras de otro.

## Como funciona

Sin framework ni build: HTML + CSS + JS a pelo, scripts con `<script>`.
Tres pantallas (`index.html` añadir, `historial.html`, `calendario.html`)
que comparten `storage.js` (datos) y `libros-utils.js` (fechas, contador,
service worker).

- **Datos**: Supabase. Tabla `libros`, bucket `libros-portadas`.
  Las credenciales estan escritas en `storage.js` a proposito: es la
  clave *publishable*, pensada para ir en el navegador.
- **Lectura de portadas**: `api/leer-portada.js`, funcion serverless de
  Vercel que llama a Gemini. La clave (`GEMINI_API_KEY`) vive solo ahi.
- **Despliegue**: push a `main` → Vercel despliega solo.
  https://libros-app-v0.vercel.app

## Cosas que cuesta descubrir

**El proyecto de Supabase se pausa.** El plan gratuito pausa los
proyectos tras unos dias sin actividad, y al pausarse su dominio deja
**incluso de resolver por DNS**. Un `nslookup` devuelve *Non-existent
domain*, que parece un proyecto borrado pero no lo es: se reactiva desde
el dashboard con "Resume" y los datos siguen intactos. Para evitarlo,
`api/mantener-viva.js` + el cron diario de `vercel.json` hacen una
consulta al dia. Si eso deja de funcionar, el sintoma sera este otra vez.

**Google retira modelos de Gemini.** `gemini-2.0-flash` se apago y la
lectura de portadas dejo de funcionar. Antes de dar por bueno un
diagnostico, comprobar en ai.google.dev/gemini-api/docs/models que el
modelo sigue vivo.

**La latencia de Gemini en gratuito es una loteria**, y no va con el
tamaño del modelo. Midiendo la misma portada: `3.8-flash` 2,4 s,
`3.6-flash` 4,5 s, `3.5-flash-lite` 25,5 s, `3.7-flash` 33,3 s. Ademas
el mas rapido rechaza peticiones por saturacion. Por eso
`api/leer-portada.js` **pregunta a varios modelos a la vez** y se queda
con el primero que sepa leer la portada (un "no se leerla" no gana la
carrera). Mediana resultante: ~7 s. Se pueden cambiar los modelos sin
tocar codigo con la variable `GEMINI_MODELOS`.

**Las variables de entorno de Vercel no entran en despliegues ya
hechos.** Tras añadir o cambiar una, hay que redesplegar. Un commit
vacio sirve.

**Es una PWA con service worker.** Al cambiar codigo, subir
`CACHE_NAME` en `service-worker.js`, y al probar en el movil cerrar la
app del todo antes.

## Como se trabaja aqui

- Los errores **se enseñan al usuario**, nunca se tragan. Esta app tuvo
  tres fallos encadenados invisibles (clave ausente, modelo apagado,
  Supabase pausado) porque los `catch` escondian todo y el formulario se
  quedaba vacio sin explicacion. `getLibros()` lanza en vez de devolver
  `[]` justo por esto: un servidor caido no debe parecerse a "no tengo
  libros".
- Comentarios y mensajes de commit en castellano, sin acentos en el
  codigo. Los textos de cara al usuario si llevan acentos.
- Para verificar cambios, medir contra el despliegue real desde el
  navegador (`fetch` a `/api/...`, `getLibros()`), no suponer.
- Si se inserta una fila de prueba en Supabase, borrarla despues,
  incluida la portada que deje en Storage.

## Pendiente

- La tabla `libros` no tiene RLS restrictivo: cualquiera con la URL
  (que va en el codigo) puede escribir. Asumido de momento por ser una
  app personal, pero sin revisar.
