// Verbindet Setlist-Text, Bestand und Bühnenansicht.
import { parseSetlistText, entriesToText } from './setlist-syntax.js';
import { normalisiere, sucheSong } from './titelsuche.js';

/**
 * Gleicht den Setlist-Text mit dem Bestand ab.
 * `wahl` hält getroffene Entscheidungen bei mehrdeutigen Titeln: { normalisierteEingabe: songId }.
 * Ergebnis-Einträge tragen zusätzlich `status` und `kandidaten` (nur für den Editor).
 */
export function loeseAuf(text, songs, wahl = {}) {
  const proId = new Map(songs.map((s) => [s.id, s]));
  return parseSetlistText(text).map((e) => {
    if (e.typ !== 'song') return e;
    const gewaehlt = proId.get(wahl[normalisiere(e.eingabe)]);
    if (gewaehlt) return { ...e, songId: gewaehlt.id, status: 'treffer', kandidaten: [gewaehlt], gewaehlt: true };
    const r = sucheSong(e.eingabe, songs);
    return { ...e, songId: r.song?.id ?? null, status: r.status, kandidaten: r.kandidaten };
  });
}

/** Speicherform der Einträge (ohne Editor-Hilfsfelder). */
export function speicherform(eintraege) {
  return eintraege.map((e) => {
    if (e.typ === 'set') return { typ: 'set', titel: e.titel };
    if (e.typ === 'notiz') return { typ: 'notiz', text: e.text };
    return { typ: 'song', eingabe: e.eingabe, info: e.info || '', songId: e.songId ?? null };
  });
}

/**
 * Text für den Editor aus gespeicherten Einträgen. Erkannte Songs erscheinen mit ihrem
 * aktuellen Titel (damit Umbenennungen durchschlagen), solange der Titel eindeutig ist.
 */
export function editorText(setlist, songs) {
  const proId = new Map(songs.map((s) => [s.id, s]));
  const anzahl = new Map();
  for (const s of songs) anzahl.set(normalisiere(s.titel), (anzahl.get(normalisiere(s.titel)) || 0) + 1);
  return entriesToText(setlist.eintraege || [], (e) => {
    const song = proId.get(e.songId);
    if (song && anzahl.get(normalisiere(song.titel)) === 1) return song.titel;
    return e.eingabe;
  });
}

/** Wirksame Darstellung eines Songs: ohne Inhalt bleibt nur der Titel. */
export function darstellungVon(song) {
  if (!song || !String(song.inhalt || '').trim()) return 'titel';
  return song.darstellung === 'akkorde' || song.darstellung === 'text' ? song.darstellung : 'titel';
}

/**
 * Zeilen für die Übersicht (Bühne und Vorschau).
 * Jede Zeile: { art: 'set'|'notiz'|'song', index, nr?, titel, info, darstellung, songId }
 */
export function uebersichtZeilen(eintraege, songs) {
  const proId = new Map(songs.map((s) => [s.id, s]));
  let nr = 0;
  return (eintraege || []).map((e, index) => {
    if (e.typ === 'set') return { art: 'set', index, titel: e.titel };
    if (e.typ === 'notiz') return { art: 'notiz', index, titel: e.text };
    const song = proId.get(e.songId);
    nr += 1;
    return {
      art: 'song',
      index,
      nr,
      songId: song?.id ?? null,
      titel: song?.titel ?? e.eingabe,
      info: e.info || song?.kurzinfo || '',
      darstellung: darstellungVon(song),
    };
  });
}

/** Indexe der Song-Einträge, die eine eigene Seite haben (Text oder Akkorde). */
export function seitenIndexe(zeilen) {
  return zeilen.filter((z) => z.art === 'song' && z.darstellung !== 'titel').map((z) => z.index);
}

/** Ersetzt in einer Setlist-Zeile den Titel und behält eine Kurzinfo („Titel | Info“). */
export function zeileMitTitel(zeile, titel) {
  const trenner = zeile.indexOf('|');
  return trenner >= 0 ? `${titel} ${zeile.slice(trenner).trim()}`.replace(/\s*\|\s*/, ' | ') : titel;
}
