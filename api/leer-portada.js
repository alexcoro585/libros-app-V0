/**
 * Funcion de servidor (Vercel Serverless Function). Recibe una portada en
 * base64, se la pasa a Gemini para que lea el titulo y el autor, y
 * devuelve el resultado. La clave de la API vive solo aqui (variable de
 * entorno GEMINI_API_KEY en Vercel), nunca llega al navegador.
 */

const PROMPT = 'Mira la portada de este libro y responde SOLO con un JSON de la forma '
  + '{"titulo": "...", "autor": "..."}, con el titulo y el autor exactos tal como aparecen '
  + 'en la portada, sin comillas extra ni texto adicional. Si no puedes leerlos con '
  + 'seguridad, devuelve {"titulo": "", "autor": ""}.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo no permitido' });
    return;
  }

  const { imagenBase64 } = req.body || {};
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const limpio = texto.replace(/```json|```/g, '').trim();
    const resultado = JSON.parse(limpio);

    res.status(200).json({
      titulo: resultado.titulo || '',
      autor: resultado.autor || '',
    });
  } catch (error) {
    console.error('Error leyendo portada con Gemini:', error);
    res.status(500).json({ error: 'No se pudo leer la portada' });
  }
}
