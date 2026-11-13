// Beispieldaten mit Platzhaltertexten – zum Ausprobieren, bevor eigene Songs angelegt sind.
// Bewusst keine echten Songtexte (das Repository ist öffentlich).
// Platzhalter stehen in ‹…›, weil eckige Klammern im Songformat Akkorde sind.
import { speichereSong, speichereSetlist, neueId } from './db.js';
import { loeseAuf, speicherform } from './setlist-modell.js';

function strophe(n, zeilen = 4) {
  return Array.from({ length: zeilen }, (_, i) => `‹Strophe ${n} – Zeile ${i + 1}›`).join('\n');
}

function akkordStrophe(n) {
  return [
    `[Am]‹Strophe ${n} – [F]Zeile 1 des [C]Textes›`,
    `[G]‹Zeile 2 – [Am]Akkord über der [E]Silbe›`,
    `[Am]‹Strophe ${n} – [F]Zeile 3›`,
    `[G]‹Zeile 4 – [E7]Ende›`,
  ].join('\n');
}

const SONGS = [
  { titel: '[Beispielsong Eins]', darstellung: 'titel', kurzinfo: 'Capo 2', inhalt: '' },
  {
    titel: '[Beispielsong Zwei]',
    darstellung: 'text',
    kurzinfo: 'Einzähler langsam',
    inhalt: [strophe(1), '', 'Refrain:', '> ‹Markierte Zeile 1›', '> ‹Markierte Zeile 2›', '', strophe(2), '', 'Refrain:', '> ‹Markierte Zeile 1›', '> ‹Markierte Zeile 2›'].join('\n'),
  },
  {
    titel: '[Beispielsong Drei]',
    darstellung: 'akkorde',
    kurzinfo: 'neu – Akkorde liegen aus',
    inhalt: [akkordStrophe(1), '', 'Refrain:', '[F]‹Refrain – [G]Zeile 1›', '> [C]‹Refrain – [E7]Zeile 2, markiert›', '', akkordStrophe(2), '', 'Refrain:', '[F]‹Refrain – [G]Zeile 1›', '> [C]‹Refrain – [E7]Zeile 2, markiert›'].join('\n'),
  },
  {
    titel: '[Langer Beispielsong]',
    darstellung: 'text',
    kurzinfo: '',
    inhalt: Array.from({ length: 8 }, (_, i) => [`Strophe ${i + 1}:`, strophe(i + 1, 5)].join('\n')).join('\n\n'),
  },
  { titel: '[Beispielsong Fünf]', darstellung: 'titel', kurzinfo: 'Tonart A', inhalt: '' },
  { titel: '[Beispielsong Sechs]', darstellung: 'text', kurzinfo: '', inhalt: [strophe(1), '', strophe(2)].join('\n') },
];

const SETLIST_TEXT = `# Set 1
Beispielsong Eins
Beispielsong Zwei
! Ansage: Begrüßung, Band vorstellen
Beispielsong Drei | E-Gitarre
Langer Beispielsong
! Pause – ca. 20 Minuten

# Set 2
Beispielsong Fünf
Beispielsong Sechs
[Titel noch nicht im Bestand]`;

export async function ladeBeispieldaten() {
  const songs = [];
  for (const s of SONGS) songs.push(await speichereSong({ id: neueId(), ...s }));
  const eintraege = speicherform(loeseAuf(SETLIST_TEXT, songs));
  await speichereSetlist({ id: neueId(), name: '[Beispiel-Auftritt]', datum: new Date().toISOString().slice(0, 10), ort: '[Ort]', eintraege, wahl: {} });
}
