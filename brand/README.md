# HayPlan · kit de marca

Mapa de eventos de Rosario. Qué pasa hoy, dónde, y un concierge que te lo cuenta en criollo.

Este kit lo usa la sesión **web** para vestir la app en un paso (copiar `tokens.css` sobre las variables de `src/app/globals.css`) y el equipo para presentar. Abrí `preview.html` en cualquier navegador para verlo todo junto.

## Nombre: se queda **HayPlan**

Se queda. "¿Hay plan?" es la pregunta exacta que la app responde, se dice igual que se escribe, suena a Rosario y `hayplan.com` / `hayplan.app` funcionan como palabra sola.

Alternativa considerada, por si el dominio no está: **Rosariazo** (un "rosariazo" es salir con todo; también una sola palabra, pero pierde la pregunta y suena a evento único, no a app diaria). Recomendación: HayPlan.

Escritura: `HayPlan`, una palabra, H y P mayúsculas. Nunca "Hay Plan", "hayplan" ni "HAYPLAN" en texto corrido (en el logo sí va en minúscula por diseño).

## Tagline

> **¿Qué hacés hoy? Hay plan.**

Versión corta para favicon/stores: **Hay plan en Rosario.**

## Tono de voz

Las reglas largas, con la evidencia de 46 marcas argentinas y el glosario de HayPlan, están en `voz.md`.

Todas las líneas de abajo pasaron por el editor rioplatense de Cuentas Claras (`antigravity/.claude/agents/editor-rioplatense.md`) el 2026-10-24. Cualquier texto nuevo en español pasa por ahí antes de salir.

1. **Rioplatense, con voseo y sin vergüenza.** "Mirá", "tenés", "dale". Nunca "usted", nunca "haz click".
   - Nav: `Mapa` · `Hoy` · `Finde` · `Preguntá` · `Guardados`
2. **Corto, como un mensaje de WhatsApp.** Una idea por línea; el usuario está en la calle con una mano ocupada.
   - Estado vacío (sin eventos en el filtro): *"No hay nada con esos filtros. Sacá uno o probá otro día."*
   - Estado vacío (sin guardados): *"Todavía no guardaste nada. Tocá el pin de un evento y queda acá."*
3. **Concreto, con datos reales.** Siempre hora, lugar y precio si existen. Nunca inventa un evento; si no sabe, dice que no sabe.
   - Saludo del concierge: *"Hola, soy HayPlan. Decime qué tenés ganas de hacer o a qué hora salís y te armo algo con lo que hay hoy en Rosario."*
   - Concierge sin resultados: *"Para eso hoy no encontré nada. Si querés te paso algo parecido, o buscamos para mañana."*
4. **Amable con el error, nunca cómplice del pánico.** Se dice qué pasó y qué hacer, sin códigos ni culpa.
   - Sin conexión: *"Sin conexión. El mapa que ya cargaste sigue ahí y lo nuevo aparece cuando vuelva."*
   - Error del concierge: *"Se me trabó. Mandá el mensaje de nuevo."*
   - Fuente caída: *"La agenda municipal no responde. Te muestro el resto mientras tanto."*
5. **Entusiasmo medido.** Un signo de exclamación por pantalla como máximo. Sin emojis en la interfaz (los pines ya son el color). Sin "¡increíble!", sin "¡no te lo pierdas!".
   - Botón principal: `Ver en el mapa` · secundario: `Cómo llegar` · guardar: `Guardar` / `Guardado`
   - Confirmación: *"Listo, guardado para el sábado."*

## Landing (`src/app/page.tsx`)

Copia final, con la forma de `voz.md` y aprobada por el editor el 2026-10-24. Un eslogan por página: el tagline va en la nav o al pie, no en el titular.

- Eyebrow: `Shippear #3 · Rosario`
- Titular: **Mirá qué pasa hoy en Rosario.**
- Bajada: *Ves en un mapa los recitales, las ferias, el teatro y las fiestas de hoy, con hora, lugar y precio de la entrada.*
- Botón: `Abrir el mapa`
- Tarjetas:
  1. **El mapa de hoy** · Junta en un solo mapa lo que pasa hoy en la agenda municipal, los teatros y los bares de Rosario.
  2. **El concierge** · Le decís qué tenés ganas de hacer y a qué hora salís, y te contesta con eventos de hoy, con hora, lugar y precio.
  3. **El plan de esta noche** · Guardás el que te gusta, tocás "Cómo llegar" y salís.

## Logo

Archivos: `logo.svg` (color, marca + wordmark), `logo-mono.svg` (un solo color, usa `currentColor`), `icon.svg` (ícono cuadrado de app, 512×512, esquinas redondeadas).

- El **mark** es un pin de mapa con un destello de cuatro puntas adentro: "acá hay algo". Funciona solo desde 24 px (favicon, pestaña, pin en el mapa).
- El wordmark es `hayplan` en minúsculas, peso bold, fuente del sistema (`ui-rounded, "SF Pro Rounded", "Segoe UI", Inter, system-ui, sans-serif`). No hay fuente externa que cargar.
- **Espacio libre** alrededor: la altura del pin. Nada entra ahí.
- **Tamaño mínimo:** mark solo 24 px; mark + wordmark 120 px de ancho.
- **Fondos:** color sobre blanco o sobre `--background` oscuro. Sobre fotos o fondos de color, usar siempre `logo-mono.svg` en blanco o en `--foreground`.
- **No hacer:** estirar, rotar, cambiar el violeta, poner sombra, agregar degradé, separar el destello del pin, escribir "Hay Plan" en dos palabras.

## Color

Base: violeta nocturno. Un solo color de marca (`--primary`); los diez colores de categoría son para pines y chips, nunca para botones ni texto corrido.

| Token | Claro | Hex | Oscuro | Hex |
|---|---|---|---|---|
| `--primary` | `oklch(0.55 0.24 320)` | `#aa24c5` | `oklch(0.72 0.20 320)` | `#da74f1` |
| `--background` | `oklch(0.99 0.005 300)` | `#fcfbff` | `oklch(0.16 0.02 300)` | `#0f0b15` |
| `--foreground` | `oklch(0.18 0.02 300)` | `#131019` | `oklch(0.97 0.01 300)` | `#f6f4fb` |

Reglas:
- El violeta `--primary` va en: botón principal, enlaces, foco, el mark del logo. No va en fondos grandes (cansa en la calle).
- Texto sobre `--primary` siempre `--primary-foreground` (blanco en claro, casi negro en oscuro).
- Los colores de categoría se usan como **fondo de pin o chip con texto blanco**, o como punto de color junto a texto normal. Nunca como color de texto sobre blanco sin verificar.
- `--destructive` solo para borrar y errores. No reutilizar `teatro` (rojo) para errores.
- Modo oscuro es el default de la demo (de noche se usa de noche); el modo claro tiene que seguir siendo legible al sol, por eso el fondo claro es casi blanco y el texto casi negro.

### Categorías (fondo de pin, texto blanco)

Contraste calculado con la fórmula WCAG 2.1 sobre el sRGB resultante. Mínimo AA para texto normal: 4.5:1. Todos cumplen.

| Categoría | Token | oklch | Hex | Contraste vs blanco |
|---|---|---|---|---|
| Música | `--category-musica` | `oklch(0.52 0.24 330)` | `#ad00a8` | 6.28 |
| Teatro | `--category-teatro` | `oklch(0.52 0.21 20)` | `#c50031` | 6.14 |
| Fiesta | `--category-fiesta` | `oklch(0.50 0.23 295)` | `#7330d4` | 6.77 |
| Feria | `--category-feria` | `oklch(0.55 0.15 65)` | `#ab5a00` | 5.02 |
| Deporte | `--category-deporte` | `oklch(0.52 0.16 150)` | `#008130` | 5.04 |
| Cultura | `--category-cultura` | `oklch(0.50 0.20 255)` | `#005dd1` | 6.03 |
| Gastronomía | `--category-gastronomia` | `oklch(0.55 0.20 40)` | `#ca3200` | 5.29 |
| Infantil | `--category-infantil` | `oklch(0.52 0.13 205)` | `#007c8c` | 4.91 |
| Charla | `--category-charla` | `oklch(0.50 0.12 110)` | `#686800` | 5.88 |
| Otro | `--category-otro` | `oklch(0.50 0.02 280)` | `#61626f` | 6.02 |

Otros contrastes que importan:

| Par | Ratio |
|---|---|
| `--primary` claro `#aa24c5` sobre blanco (texto de enlace) | 5.55 |
| blanco sobre `--primary` claro (botón) | 5.55 |
| `--primary-foreground` oscuro `#0f0b15` sobre `--primary` oscuro `#da74f1` | 7.16 |
| `--primary` oscuro `#da74f1` sobre fondo oscuro (enlace) | 7.16 |
| `--muted-foreground` claro `#65616d` sobre fondo claro | 5.86 |
| `--muted-foreground` oscuro `#a6a2b0` sobre fondo oscuro | 7.80 |
| blanco sobre `--destructive` claro `#d40924` | 5.44 |
| `--foreground` oscuro sobre `--background` oscuro | 17.80 |
| `--foreground` claro sobre `--background` claro | 18.31 |

Los colores de categoría son los mismos en claro y oscuro: sobre `#0f0b15` el pin se lee por el borde blanco de 2 px que lleva siempre (ver `preview.html`).

## Principios de diseño (inspiración: Apple)

La referencia visual es la sobriedad de Apple, no su azul. Cinco reglas:

1. **Un lienzo, un acento.** Fondo casi negro (o casi blanco de día), texto casi negro/blanco, y un solo color para la acción: el violeta. Nada más compite.
2. **Titulares grandes y apretados.** Semibold o bold, `letter-spacing: -0.02em`, `line-height: 1.05`. El titular dice una cosa. El párrafo de abajo es gris (`--muted-foreground`) y corto.
3. **Aire.** Secciones separadas por mucho espacio (80 a 120 px en desktop, 48 en móvil), no por líneas ni cajas. Si dudás, sacá un borde.
4. **Vidrio, no sombras.** Paneles flotantes (barra de búsqueda, chat del concierge, tarjeta del pin) con fondo translúcido y `backdrop-filter: blur(20px)`, borde de 1 px al 10 %. Esquinas grandes (`--radius` 14 px; 24 px en tarjetas grandes).
5. **El mapa es la imagen.** Como Apple deja que el producto haga el trabajo, acá el mapa de Rosario de noche es la imagen de marca. Nada de ilustraciones ni stock.

## Tipografía

Fuente del sistema, sin descarga: `ui-rounded, "SF Pro Rounded", "Segoe UI", Inter, system-ui, sans-serif` para títulos y `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` para texto. Escala (px / line-height): 12/16 meta · 14/20 cuerpo · 16/24 cuerpo grande · 20/28 título de card · 28/34 título de pantalla · 44/48 titular · 72/76 pitch.

## Cómo aplicar (sesión web)

1. Reemplazar el bloque `:root { … }` y `.dark { … }` de `src/app/globals.css` por el contenido de `tokens.css` (el `@theme inline` existente no cambia; agregarle las diez líneas `--color-category-*` que están comentadas al final de `tokens.css`).
2. Copiar `icon.svg` a `src/app/icon.svg` (Next lo usa como favicon) y `logo.svg` a `public/`.
3. Poner `class="dark"` en `<html>` para la demo.
