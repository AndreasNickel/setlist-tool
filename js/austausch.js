// Export/Import aller Songs und Setlists als Datei (*.setlist.json).
// Die Datei ist zugleich die Sicherung. Der Import ersetzt den Stand komplett (keine Mischstände).
// Nicht enthalten: Einstellungen und „gespielt“ – beides gehört zum jeweiligen Gerät.
import { alleSongs, alleSetlists, ersetzeAlles, hole, speichere } from './db.js';

export const FORMAT = 'setlist-tool';
export const FORMAT_VERSION = 1;

export async function erstelleExport() {
  const [songs, setlists] = await Promise.all([alleSongs(), alleSetlists()]);
  return { format: FORMAT, version: FORMAT_VERSION, exportiert: new Date().toISOString(), songs, setlists };
}

export function dateiname(datum = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `setlist-tool-${datum.getFullYear()}-${z(datum.getMonth() + 1)}-${z(datum.getDate())}-${z(datum.getHours())}${z(datum.getMinutes())}.setlist.json`;
}

export function exportDatei(daten) {
  return new File([JSON.stringify(daten, null, 1)], dateiname(new Date(daten.exportiert)), { type: 'application/json' });
}

/** Speichert die Datei per Download (Laptop) oder über „Teilen“ (iPad: „In Dateien sichern“). */
export async function gibDateiAus(datei, { teilen = false } = {}) {
  if (teilen && navigator.canShare?.({ files: [datei] })) {
    await navigator.share({ files: [datei], title: datei.name });
    return 'geteilt';
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(datei);
  link.download = datei.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  return 'heruntergeladen';
}

const str = (v) => (typeof v === 'string' ? v : '');

/**
 * Prüft eine Importdatei und bringt sie in saubere Form.
 * Wirft mit verständlicher Meldung, wenn die Datei nicht passt.
 */
export function pruefeImport(text) {
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist keine gültige Exportdatei (kein JSON).');
  }
  if (!d || d.format !== FORMAT) throw new Error('Die Datei stammt nicht aus dem Setlist-Tool.');
  if (typeof d.version !== 'number' || d.version > FORMAT_VERSION)
    throw new Error('Die Datei stammt aus einer neueren Version des Setlist-Tools. Bitte die App aktualisieren.');
  if (!Array.isArray(d.songs) || !Array.isArray(d.setlists)) throw new Error('Die Datei ist unvollständig.');

  const songs = d.songs.map((s, i) => {
    if (!s || !str(s.id)) throw new Error(`Song Nr. ${i + 1} hat keine Kennung.`);
    return {
      id: s.id,
      titel: str(s.titel) || 'Ohne Titel',
      darstellung: ['titel', 'text', 'akkorde'].includes(s.darstellung) ? s.darstellung : 'text',
      kurzinfo: str(s.kurzinfo),
      inhalt: str(s.inhalt),
      geaendert: str(s.geaendert),
    };
  });
  const songIds = new Set(songs.map((s) => s.id));
  const setlists = d.setlists.map((l, i) => {
    if (!l || !str(l.id)) throw new Error(`Setlist Nr. ${i + 1} hat keine Kennung.`);
    const eintraege = (Array.isArray(l.eintraege) ? l.eintraege : []).flatMap((e) => {
      if (e?.typ === 'set') return [{ typ: 'set', titel: str(e.titel) }];
      if (e?.typ === 'notiz') return [{ typ: 'notiz', text: str(e.text) }];
      if (e?.typ === 'song') return [{ typ: 'song', eingabe: str(e.eingabe), info: str(e.info), songId: songIds.has(e.songId) ? e.songId : null }];
      return [];
    });
    const wahl = {};
    for (const [k, v] of Object.entries(l.wahl && typeof l.wahl === 'object' ? l.wahl : {})) if (songIds.has(v)) wahl[k] = v;
    return { id: l.id, name: str(l.name) || 'Setlist', datum: str(l.datum), ort: str(l.ort), eintraege, wahl, geaendert: str(l.geaendert) };
  });
  return { exportiert: str(d.exportiert), songs, setlists };
}

/** Jüngste Änderung auf diesem Gerät (für die Warnung vor dem Überschreiben). */
export async function letzteAenderung() {
  const [songs, setlists] = await Promise.all([alleSongs(), alleSetlists()]);
  return [...songs, ...setlists].map((x) => x.geaendert || '').sort().pop() || '';
}

export async function fuehreImportAus(daten, dateiName = '') {
  await ersetzeAlles(daten.songs, daten.setlists);
  await merkeAustausch({ letzterImport: new Date().toISOString(), importDatei: dateiName, importStand: daten.exportiert });
}

export async function merkeAustausch(werte) {
  const bisher = (await hole('einstellungen', 'austausch')) || {};
  await speichere('einstellungen', { ...bisher, ...werte }, 'austausch');
}

export const ladeAustausch = async () => (await hole('einstellungen', 'austausch')) || {};
