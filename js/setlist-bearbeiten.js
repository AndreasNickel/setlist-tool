// Logik für kurzfristige Änderungen an einer Setlist (Bearbeitungsmodus der Bühnen-Übersicht).
// Arbeitsliste: [{ schluessel, e: Eintrag in Speicherform, alt: ursprünglicher Index | null }]
import { normalisiere, sucheSong } from './titelsuche.js';

let zaehler = 0;
const neuerSchluessel = () => 'z' + ++zaehler;

/** Arbeitsliste aus den gespeicherten Einträgen. */
export function arbeitsliste(eintraege) {
  return (eintraege || []).map((e, alt) => ({ schluessel: neuerSchluessel(), e: { ...e }, alt }));
}

/** Verschiebt den Eintrag an Position `von` nach Position `nach` (neue Liste). */
export function verschiebe(liste, von, nach) {
  if (von === nach || von < 0 || von >= liste.length) return liste;
  const neu = [...liste];
  const [x] = neu.splice(von, 1);
  neu.splice(Math.max(0, Math.min(nach, neu.length)), 0, x);
  return neu;
}

/** Fügt einen Song aus dem Bestand hinter Position `nach` ein (-1 = ganz vorne, null = am Ende). */
export function fuegeSongEin(liste, song, nach = null) {
  const eintrag = { schluessel: neuerSchluessel(), e: { typ: 'song', eingabe: song.titel, info: '', songId: song.id }, alt: null };
  const pos = nach === null ? liste.length : nach + 1;
  const neu = [...liste];
  neu.splice(pos, 0, eintrag);
  return { liste: neu, pos };
}

/** Einträge in Speicherform. */
export const eintraegeAus = (liste) => liste.map((x) => x.e);

/** „gespielt“ hängt an der Position – nach dem Umsortieren auf die neuen Positionen übertragen. */
export function gespieltNeu(liste, gespielt) {
  const neu = new Set();
  liste.forEach((x, i) => {
    if (x.alt !== null && gespielt.has(x.alt)) neu.add(i);
  });
  return neu;
}

/** Hat sich gegenüber den gespeicherten Einträgen etwas geändert? */
export function istGeaendert(liste, eintraege) {
  return JSON.stringify(eintraegeAus(liste)) !== JSON.stringify(eintraege || []);
}

/** Songs aus dem Bestand zur Eingabe: erst Titelanfang, dann Teiltreffer, sonst die tolerante Suche. */
export function sucheImBestand(text, songs, max = 8) {
  const n = normalisiere(text);
  if (!n) return [];
  const mitN = songs.map((s) => ({ s, n: normalisiere(s.titel) }));
  const sortiert = (a) => a.sort((x, y) => x.s.titel.localeCompare(y.s.titel, 'de')).map((x) => x.s);
  const anfang = sortiert(mitN.filter((x) => x.n.startsWith(n)));
  const teil = sortiert(mitN.filter((x) => !x.n.startsWith(n) && x.n.includes(n)));
  const treffer = [...anfang, ...teil];
  if (!treffer.length) treffer.push(...sucheSong(text, songs).kandidaten);
  return treffer.slice(0, max);
}
