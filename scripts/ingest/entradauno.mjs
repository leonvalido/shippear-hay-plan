/**
 * Entradauno (also sells as TurboEntrada): one public JSON with the whole billboard.
 * Venues carry a Google Maps embed whose URL holds the coordinates, so no geocoding.
 * One event per show, dated at its next function (oFuncionMenor).
 */
import { fetchJson, toIso, inWindow, inRosario, guessCategory, normalizeEvent, dedupe, writeRaw, clean } from "./lib.mjs";

const API = "https://api-ecommerce-live-entradauno.entradauno.com/v1/api/v2/Cartelera";
const TYPE_CATEGORY = { 1: "teatro", 2: "musica", 4: "cultura", 5: "cultura", 7: "deporte", 8: "infantil" };

const stripHtml = (s) => clean(decodeURIComponent(s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"'));

export async function run(now = new Date()) {
  const data = await fetchJson(API, { headers: { Origin: "https://www.entradauno.com", Referer: "https://www.entradauno.com/" } });
  const cartelera = data?.oData?.oCartelera;
  if (!cartelera) throw new Error("unexpected Cartelera payload");

  const venues = new Map();
  for (const v of cartelera.listaEstablecimiento ?? []) {
    const m = (v.cGoogleMapTag ?? "").match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
    const lng = m ? Number(m[1]) : undefined, lat = m ? Number(m[2]) : undefined;
    const rosario = inRosario(lat, lng) || /rosario/i.test(`${v.cZona} ${v.cNombre} ${v.cDomicilio}`);
    if (rosario) venues.set(v.idEstablecimiento, { name: clean(v.cNombre), address: clean(v.cDomicilio), lat, lng });
  }

  const events = [];
  for (const show of cartelera.listaEspectaculoCartel ?? []) {
    const venueId = (show.listaIdEstablecimiento ?? []).find((id) => venues.has(id));
    const f = show.oFuncionMenor?.oFuncionFecha;
    if (venueId == null || !f) continue;
    const venue = venues.get(venueId);
    const startsAt = toIso(f.nFuncionAnio, f.nFuncionMes, f.nFuncionDia, show.oFuncionMenor.bIncluyeHora ? f.nFuncionHora : 0, show.oFuncionMenor.bIncluyeHora ? f.nFuncionMinuto : 0);
    if (!inWindow(startsAt, now)) continue;
    const img = (show.listaImagenes ?? []).find((i) => i.listaEtiquetas?.includes("WEB_DESTACADO")) ?? show.listaImagenes?.[0];
    const ev = normalizeEvent({
      title: show.cNombre,
      description: stripHtml(show.cDescripcion).slice(0, 2000) || undefined,
      startsAt,
      venueName: venue.name,
      address: venue.address || undefined,
      lat: venue.lat,
      lng: venue.lng,
      category: TYPE_CATEGORY[show.idEspectaculoTipo] ?? guessCategory(`${show.cNombre} ${venue.name}`, "musica"),
      sourceType: "ticketing",
      sourceName: "Entradauno",
      sourceUrl: show.cWebUri || `https://www.entradauno.com/landing/${show.cSeo}`,
      imageUrl: img?.cUri,
    });
    if (ev) events.push(ev);
  }
  return dedupe(events);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  writeRaw("entradauno", await run());
}
