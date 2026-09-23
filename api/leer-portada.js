/**
 * Funcion de servidor (Vercel Serverless Function). Recibe una portada en
 * base64, se la pasa a Gemini para que lea el titulo y el autor, y
 * devuelve el resultado. La clave de la API vive solo aqui (variable de
 * entorno GEMINI_API_KEY en Vercel), nunca llega al navegador.
 */

const MODELO = 'gemini-2.0-flash';

const PROMPT = 'Mira la portada de este libro y responde SOLO con un JSON de la forma '
  + '{"titulo": "...", "autor": "..."}, con el titulo y el autor exactos tal como aparecen '
  + 'en la portada, sin comillas extra ni texto adicional. Si no puedes leerlos con '
  + 'seguridad, devuelve {"titulo": "", "autor": ""}.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo no permitido' });
    return;
  }

  // Vercel parsea el JSON solo,  pero si llega como texto plano lo
  // parseamos aqui para no fallar por un detalle de cabeceras.
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
    const respuestaGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: 'image/jpeg', data: imagenBase64 } },
            ],
          }],
        }),
      }
    );

    const datos = await respuestaGemini.json();

    // Sin esto, una clave invalida o un modelo retirado acababan
    // devolviendo titulo y autor vacios con un 200, indistinguible de
    // "no he sabido leer la portada".
    if (!respuestaGemini.ok) {
      const detalle = datos?.error?.message || `HTTP ${respuestaGemini.status}`;
      console.error('Gemini respondio con error:', detalle);
      res.status(502).json({ error: `Gemini: ${detalle}` });
      return;
    }

    const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) {
      console.error('Gemini no devolvio texto:', JSON.stringify(datos).slice(0, 500));
      res.status(502).json({ error: 'Gemini no devolvio ninguna respuesta para esta imagen' });
      return;
    }

    const limpio = texto.replace(/```json|```/g, '').trim();
    let resultado;
    try {
      resultado = JSON.parse(limpio);
    } catch {
      console.error('Gemini no devolvio JSON:', limpio.slice(0, 300));
      res.status(502).json({ error: 'Gemini no devolvio un JSON valido' });
      return;
    }

    res.status(200).json({
      titulo: resultado.titulo || '',
      autor: resultado.autor || '',
    });
  } catch (error) {
    console.error('Error leyendo portada con Gemini:', error);
    res.status(500).json({ error: `Fallo al llamar a Gemini: ${error.message}` });
  }
}
