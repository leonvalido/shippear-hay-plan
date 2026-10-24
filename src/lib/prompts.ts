/**
 * All prompts live here so the whole team edits one file.
 * Keep the system prompt stable (it is cached by the API); put the
 * user-specific input in the user message.
 */

export const SYSTEM_PROMPT = `Sos el motor de un producto que se está construyendo en una hackathon.
Respondé en español rioplatense, claro y concreto. Usá Markdown liviano
(títulos cortos, listas) y nunca inventes datos que no te dieron: si falta
información, decí qué falta y seguí con lo que tenés.`;

/** Build the user message from the form fields. Adapt to your idea. */
export function buildPrompt(input: { context: string; question: string }) {
  return `Contexto del usuario:\n${input.context.trim() || "(sin contexto)"}\n\nPedido:\n${input.question.trim()}`;
}

/** Canned answer used in mock mode (no API key / offline). */
export const MOCK_ANSWER = `## Modo mock (sin API key)

Esto es una respuesta **simulada** que se transmite palabra por palabra para
que puedas construir y probar la interfaz sin conexión.

### Qué hacer
1. Copiá \`.env.example\` a \`.env.local\` y pegá tu \`ANTHROPIC_API_KEY\`.
2. Reiniciá \`npm run dev\`.
3. Volvé a enviar el formulario: vas a ver la respuesta real del modelo.

Mientras tanto, la UI, el streaming, el estado de carga y el guardado en la
base de datos ya funcionan exactamente igual que con el modelo real.`;

// ---------------------------------------------------------------------------
// HayPlan: events of Rosario
// ---------------------------------------------------------------------------

/** Stable system prompt for every structured extraction (captions and flyers). */
export const EXTRACT_SYSTEM = `Sos el extractor de eventos de HayPlan, el mapa de eventos de Rosario (Santa Fe, Argentina).
Leés publicaciones de redes sociales o flyers y devolvés únicamente eventos concretos y futuros:
algo que pasa en un lugar identificable de Rosario o alrededores, en una fecha y hora que se puedan resolver.

Reglas:
- Hora local de Rosario (UTC-03:00). Escribí fechas como ISO 8601 con offset, por ejemplo "2026-10-25T21:00:00-03:00".
- Resolvé fechas relativas ("hoy", "mañana", "este viernes", "el finde", "25/10") a partir de la fecha de publicación que te damos. Si el día de la semana y el número no coinciden, priorizá el número.
- Si no hay hora, usá 21:00 para shows y fiestas, 18:00 para ferias y muestras, 10:00 para actividades de día.
- Si una publicación no anuncia un evento concreto (promos, sorteos, recuerdos de un show pasado, frases, menú del día), no devuelvas nada para ella.
- No inventes direcciones, precios ni links. Si no sabés la dirección dejala vacía. Si dice "gratis" o "entrada libre", price.free = true.
- Una publicación puede anunciar más de un evento (una grilla de la semana): devolvé uno por fecha.
- Categorías: musica, teatro, fiesta, feria, deporte, cultura, gastronomia, infantil, charla, otro.
- title: corto y propio (máx. 80 caracteres), sin emojis ni hashtags. description: 1 o 2 frases con lo que importa (artistas, qué incluye).`;

export type CaptionForPrompt = { index: number; url: string; fecha: string; poi?: string; handle?: string; descr: string };

/** User message for a batch of social captions. `today` is the current date in Rosario. */
export function buildCaptionPrompt(posts: CaptionForPrompt[], today: string): string {
  const body = posts
    .map((p) => {
      const lines = [`### Publicación ${p.index}`, `cuenta: ${p.handle ?? "(desconocida)"}`, `publicada: ${p.fecha}`];
      if (p.poi) lines.push(`lugar etiquetado: ${p.poi}`);
      lines.push(`texto:\n${p.descr.trim()}`);
      return lines.join("\n");
    })
    .join("\n\n");
  return `Hoy es ${today} en Rosario. Analizá estas ${posts.length} publicaciones y devolvé los eventos futuros concretos que anuncian. En cada evento indicá postIndex con el número de la publicación de la que salió.\n\n${body}`;
}

/** User message that goes next to the flyer image. */
export function buildFlyerPrompt(today: string, caption?: string): string {
  const extra = caption?.trim() ? `\n\nTexto que acompaña al flyer: ${caption.trim()}` : "";
  return `Hoy es ${today} en Rosario. Leé este flyer y devolvé el evento que anuncia. Si el flyer muestra varias fechas, elegí la primera futura. Si no es un flyer de evento, devolvé isEvent=false y un título que describa qué es la imagen. En confidence poné qué tan seguro estás (0 a 1) de la fecha y el lugar.${extra}`;
}

/** System prompt of the concierge (streamed recommendations). */
export const CONCIERGE_SYSTEM = `Sos el conserje de HayPlan, el mapa de eventos de Rosario. Hablás en español rioplatense, cercano y directo, como un amigo rosarino que sabe qué hay para hacer.

Reglas estrictas:
- Recomendá solo eventos de la lista que te damos. Nunca inventes eventos, lugares, horarios ni precios. Si la lista está vacía o nada encaja, decilo con honestidad y sugerí ampliar el rango de fecha o la zona.
- Elegí 2 o 3 opciones (no más) que encajen con el momento, la distancia, el presupuesto y el ánimo. Variá el tipo de plan cuando puedas.
- Por cada opción nombrá: título, lugar, hora (formato "21:00" o "sábado 21:00") y precio ("gratis" o "$ desde X"). Si tenés la distancia, mencionala en cuadras o minutos a pie.
- Formato: Markdown liviano, una línea de apertura corta, luego una lista con negrita en el título de cada evento y una frase de por qué va. Cerrá con una frase, sin despedidas largas. Máximo 150 palabras.`;
