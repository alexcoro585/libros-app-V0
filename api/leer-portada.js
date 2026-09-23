/**
 * Funcion de servidor (Vercel Serverless Function). Recibe una portada en
 * base64, se la pasa a Gemini para que lea el titulo y el autor, y
 * devuelve el resultado. La clave de la API vive solo aqui (variable de
 * entorno GEMINI_API_KEY en Vercel), nunca llega al navegador.
 *
 * En el plan gratuito la latencia de Gemini es una loteria: midiendo la
 * misma portada, un modelo tardo 2,4 s y otro 33 s, y el mas rapido
 * rechazaba peticiones por saturacion. Por eso no se elige un modelo:
 * se le pregunta a varios a la vez y se responde con el primero que
 * acierte. Cuesta lo mismo en la practica (son ~1.100 tokens por
 * intento, dentro del nivel gratuito) y convierte la loteria en el
 * mejor de tres.
 */

export const maxDuration = 60;

// Ordenados por rapidez medida. El ultimo es el mas lento pero el que
// menos rechaza, asi que hace de red de seguridad.
const MODELOS = (process.env.GEMINI_MODELOS || 'gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const PROMPT = 'Mira la portada de este libro y responde SOLO con un JSON de la forma '
  + '{"titulo": "...", "autor": "..."}, con el titulo y el autor exactos tal como aparecen '
  + 'en la portada, sin comillas extra ni texto adicional. Si no puedes leerlos con '
  + 'seguridad, devuelve {"titulo": "", "autor": ""}.';

/** Error de un modelo que respondio bien pero no supo leer la portada. */
class NoLegible extends Error {}

async function preguntarAModelo(modelo, imagenBase64, apiKey) {
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: 'image/jpeg', data: imagenBase64 } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(`${modelo}: ${datos?.error?.message || `HTTP ${respuesta.status}`}`);
  }

  const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error(`${modelo}: respuesta vacia`);

  const resultado = JSON.parse(texto.replace(/```json|```/g, '').trim());
  const titulo = resultado.titulo || '';
  const autor = resultado.autor || '';

  // Que un modelo diga "no lo se" no debe ganar la carrera: puede que
  // otro si sepa leerla. Se descarta y se espera a los demas.
  if (!titulo && !autor) throw new NoLegible(modelo);

  return { titulo, autor };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo no permitido' });
    return;
  }

  let cuerpo = req.body || {};
  if (typeof cuerpo === 'string') {
    try {
      cuerpo = JSON.parse(cuerpo);
    } catch {
      res.status(400).json({ error: 'El cuerpo de la peticion no es JSON valido' });
      return;
    }
  }

  const { imagenBase64 } = cuerpo;
  if (!imagenBase64) {
    res.status(400).json({ error: 'Falta la imagen' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel' });
    return;
  }

  try {
    // Promise.any devuelve el primero que salga bien; los demas siguen
    // en vuelo pero ya no importan.
    const ganador = await Promise.any(
      MODELOS.map((modelo) => preguntarAModelo(modelo, imagenBase64, apiKey))
    );
    res.status(200).json(ganador);
  } catch (agregado) {
    const fallos = agregado.errors || [agregado];

    // Si algun modelo llego a responder pero no supo leer la portada,
    // eso no es un error de la app: es una foto ilegible.
    if (fallos.some((e) => e instanceof NoLegible)) {
      res.status(200).json({ titulo: '', autor: '' });
      return;
    }

    const detalle = fallos.map((e) => e.message).join(' | ');
    console.error('Ningun modelo pudo leer la portada:', detalle);
    res.status(502).json({ error: `Gemini: ${fallos[0]?.message || 'fallo desconocido'}` });
  }
}
