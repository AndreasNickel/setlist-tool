// Gerätebezogene Einstellungen (Schriftgrößen usw.), gespeichert in IndexedDB.
import { hole, speichere } from './db.js';

export const STANDARD = {
  titelGroesse: 30, // Titel in der Übersicht (px); Kurzinfo/Anmerkung ≈ 0,62 × Titel
  textGroesse: 26, // Songtext ohne Akkorde (px)
  akkordTextGroesse: 24, // Songtext mit Akkorden (px); Akkorde ≈ 0,82 × Text
  mindestGroesse: 20, // kleinste Größe beim automatischen Verkleinern (px) – noch am iPad zu prüfen
  kennzeichen: true, // „Text“/„Akkorde“ neben dem Pfeil in der Übersicht zeigen
};

export const GRENZEN = {
  titelGroesse: [18, 56],
  textGroesse: [16, 56],
  akkordTextGroesse: [16, 56],
  mindestGroesse: [12, 40],
};

let cache = null;

export async function ladeEinstellungen() {
  if (cache) return cache;
  const gespeichert = (await hole('einstellungen', 'geraet')) || {};
  cache = { ...STANDARD, ...gespeichert };
  wendeAn(cache);
  return cache;
}

export async function speichereEinstellungen(werte) {
  cache = { ...STANDARD, ...werte };
  await speichere('einstellungen', cache, 'geraet');
  wendeAn(cache);
  return cache;
}

/** Schreibt die Größen als CSS-Variablen auf das Dokument. */
export function wendeAn(e) {
  const r = document.documentElement.style;
  r.setProperty('--titel-groesse', e.titelGroesse + 'px');
  r.setProperty('--info-groesse', Math.round(e.titelGroesse * 0.62) + 'px');
  document.documentElement.classList.toggle('ohne-kennzeichen', !e.kennzeichen);
}
