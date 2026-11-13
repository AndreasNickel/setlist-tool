// Tests der reinen Logik. Nur Platzhaltertexte – keine echten Songdaten!
import { parseSetlistText, entriesToText } from '../js/setlist-syntax.js';
import { normalisiere, sucheSong, abstand } from '../js/titelsuche.js';
import { parseSong, zerlegeZeile, ohneAkkorde, schalteMarkierung } from '../js/songformat.js';
import { istAkkord, wandleAkkordzeilen } from '../js/akkordzeilen.js';
import { loeseAuf, speicherform, editorText, uebersichtZeilen } from '../js/setlist-modell.js';

export const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function gleich(ist, soll, text = '') {
  const a = JSON.stringify(ist);
  const b = JSON.stringify(soll);
  if (a !== b) throw new Error(`${text}\n  erwartet: ${b}\n  erhalten: ${a}`);
}

const SONGS = [
  { id: 'a', titel: 'Erster Song', darstellung: 'text', kurzinfo: 'Capo 2', inhalt: 'x' },
  { id: 'b', titel: 'Zweiter Song', darstellung: 'akkorde', kurzinfo: '', inhalt: '[Am]x' },
  { id: 'c', titel: 'Platzhalter', darstellung: 'titel', kurzinfo: '', inhalt: '' },
  { id: 'd', titel: 'Alter Platzhalter', darstellung: 'text', kurzinfo: '', inhalt: '' },
  { id: 'e', titel: 'Über den Fluss', darstellung: 'text', kurzinfo: '', inhalt: 'x' },
];

// ---- Setlist-Syntax ----
test('Setlist: Set, Song, Song mit Info, Anmerkung, Leerzeilen', () => {
  const e = parseSetlistText('# Set 1\nErster Song\n\nZweiter Song | Capo 4\n! Pause – 20 Minuten\n');
  gleich(e, [
    { typ: 'set', titel: 'Set 1', zeile: 0 },
    { typ: 'song', eingabe: 'Erster Song', info: '', zeile: 1 },
    { typ: 'song', eingabe: 'Zweiter Song', info: 'Capo 4', zeile: 3 },
    { typ: 'notiz', text: 'Pause – 20 Minuten', zeile: 4 },
  ]);
});

test('Setlist: Leerraum wird getrimmt, „| Info“ ohne Titel ignoriert, Windows-Zeilenenden', () => {
  const e = parseSetlistText('  Erster Song  |  Info  \r\n| nur Info\r\n#Set 2');
  gleich(e.map((x) => [x.typ, x.eingabe ?? x.titel, x.info]), [
    ['song', 'Erster Song', 'Info'],
    ['set', 'Set 2', undefined],
  ]);
});

test('Setlist: Text ↔ Einträge hin und zurück', () => {
  const text = '# Set 1\nErster Song | Capo 2\n! Ansage\n\n# Set 2\nZweiter Song';
  gleich(entriesToText(parseSetlistText(text)), text);
});

// ---- Titelsuche ----
test('Titelsuche: Normalisierung (Groß/klein, Umlaute, Satzzeichen)', () => {
  gleich(normalisiere('  Über den   Fluß! '), 'uber den fluss');
});

test('Titelsuche: Levenshtein', () => {
  gleich(abstand('fieber', 'fiber'), 1);
  gleich(abstand('abc', 'xyz', 1), 2);
});

test('Titelsuche: exakter Treffer schlägt Teiltitel', () => {
  const r = sucheSong('platzhalter', SONGS);
  gleich([r.status, r.song?.id], ['treffer', 'c']);
});

test('Titelsuche: Teiltitel', () => {
  gleich(sucheSong('Zweiter', SONGS).song?.id, 'b');
  gleich(sucheSong('uber den', SONGS).song?.id, 'e');
});

test('Titelsuche: mehrdeutiger Teiltitel', () => {
  const r = sucheSong('Song', SONGS);
  gleich([r.status, r.kandidaten.map((s) => s.id)], ['mehrdeutig', ['a', 'b']]);
});

test('Titelsuche: Tippfehler', () => {
  gleich(sucheSong('Erstr Song', SONGS).song?.id, 'a');
  gleich(sucheSong('Zwieter Song', SONGS).song?.id, 'b');
});

test('Titelsuche: unbekannt', () => {
  gleich(sucheSong('Ganz anderer Titel', SONGS).status, 'unbekannt');
  gleich(sucheSong('xy', SONGS).status, 'unbekannt');
});

// ---- Setlist-Modell ----
test('Modell: Abgleich mit Wahl bei Mehrdeutigkeit', () => {
  const ohne = loeseAuf('Song', SONGS);
  gleich(ohne[0].status, 'mehrdeutig');
  const mit = loeseAuf('Song', SONGS, { song: 'b' });
  gleich([mit[0].status, mit[0].songId], ['treffer', 'b']);
});

test('Modell: Editor-Text nutzt aktuelle Titel, unbekannte bleiben wie getippt', () => {
  const eintraege = speicherform(loeseAuf('# Set 1\nerstr song | Ansage\nNeuer Titel', SONGS));
  gleich(editorText({ eintraege }, SONGS), '# Set 1\nErster Song | Ansage\nNeuer Titel');
});

test('Modell: Übersichtszeilen – Nummern, Kurzinfo, Darstellung', () => {
  const eintraege = speicherform(loeseAuf('# Set 1\nErster Song\n! Ansage\nZweiter Song | Tonart A\nAlter Platzhalter\nUnbekannt XY', SONGS));
  const z = uebersichtZeilen(eintraege, SONGS);
  gleich(
    z.map((x) => [x.art, x.nr ?? null, x.titel, x.info ?? null, x.darstellung ?? null]),
    [
      ['set', null, 'Set 1', null, null],
      ['song', 1, 'Erster Song', 'Capo 2', 'text'],
      ['notiz', null, 'Ansage', null, null],
      ['song', 2, 'Zweiter Song', 'Tonart A', 'akkorde'],
      ['song', 3, 'Alter Platzhalter', '', 'titel'], // Text-Darstellung, aber kein Inhalt → nur Titel
      ['song', 4, 'Unbekannt XY', '', 'titel'],
    ]
  );
});

// ---- Songformat ----
test('Songformat: Akkorde zerlegen', () => {
  gleich(zerlegeZeile('[Am]Erste Zeile des [F]Textes'), [
    { akkord: 'Am', text: 'Erste Zeile des ' },
    { akkord: 'F', text: 'Textes' },
  ]);
  gleich(zerlegeZeile('Auftakt [C]Zeile'), [
    { akkord: '', text: 'Auftakt ' },
    { akkord: 'C', text: 'Zeile' },
  ]);
  gleich(zerlegeZeile('[G] [D]'), [
    { akkord: 'G', text: ' ' },
    { akkord: 'D', text: '' },
  ]);
  gleich(zerlegeZeile('ohne'), [{ akkord: '', text: 'ohne' }]);
});

test('Songformat: Akkorde entfernen', () => {
  gleich(ohneAkkorde('[Am]Erste Zeile des [F]Textes'), 'Erste Zeile des Textes');
});

test('Songformat: Abschnitte, Namen, Markierungen', () => {
  const s = parseSong('Strophe 1:\nZeile A\nZeile B\n\nRefrain:\n> Markiert\nNormal\n\n\nZeile C');
  gleich(
    s.map((a) => [a.name, a.zeilen.map((z) => (z.markiert ? '!' : '') + z.segmente.map((x) => x.text).join(''))]),
    [
      ['Strophe 1', ['Zeile A', 'Zeile B']],
      ['Refrain', ['!Markiert', 'Normal']],
      ['', ['Zeile C']],
    ]
  );
});

test('Songformat: Zeile mit Akkord und Doppelpunkt ist kein Abschnittsname', () => {
  const s = parseSong('[Am]Er sagte:');
  gleich([s[0].name, s[0].zeilen.length], ['', 1]);
});

// ---- Akkordzeilen ----
test('Akkordzeilen: Akkord-Erkennung', () => {
  const ja = ['A', 'Am', 'C#m7', 'Bb', 'Hmaj7', 'Dsus4', 'Cadd9', 'G/H', 'F#m7b5', 'E7', 'Gdim', 'Caug', 'D/F#'];
  const nein = ['Am,', 'Abend', 'a', 'X', 'Ich', 'Der', 'Echo'];
  gleich(ja.filter((w) => !istAkkord(w)), []);
  gleich(nein.filter(istAkkord), []);
});

test('Akkordzeilen: Akkordzeile über Textzeile wird ChordPro', () => {
  const r = wandleAkkordzeilen('Am          F\nErste Zeile des Textes');
  gleich(r, { text: '[Am]Erste Zeile [F]des Textes', anzahl: 1 });
});

test('Akkordzeilen: Akkord hinter dem Zeilenende, reine Akkordzeile, Abschnitt bleibt', () => {
  const r = wandleAkkordzeilen('Refrain:\nC          G\nKurz\n\nAm  F  C  G\n\nTextzeile ohne Akkorde');
  gleich(r.text, 'Refrain:\n[C]Kurz       [G]\n\n[Am]  [F]  [C]  [G]\n\nTextzeile ohne Akkorde');
  gleich(r.anzahl, 2);
});

test('Akkordzeilen: zwei Akkordzeilen hintereinander, Tabs, ChordPro bleibt', () => {
  gleich(wandleAkkordzeilen('Am F\nC G\nText').text, '[Am] [F]\n[C]Te[G]xt');
  gleich(wandleAkkordzeilen('\tG\nZeile mit Tab davor').text, 'Zeile mi[G]t Tab davor');
  gleich(wandleAkkordzeilen('[Am]Schon [F]ChordPro').anzahl, 0);
});

// ---- Markieren ----
test('Markieren: einzelne Zeile an/aus', () => {
  const t = 'Zeile A\nZeile B\nZeile C';
  const an = schalteMarkierung(t, 9, 9);
  gleich(an.text, 'Zeile A\n> Zeile B\nZeile C');
  gleich([an.start, an.ende], [8, 17]);
  gleich(schalteMarkierung(an.text, an.start, an.ende).text, t);
});

test('Markieren: Auswahl über mehrere Zeilen, Leerzeilen und Abschnittsnamen bleiben', () => {
  const t = 'Refrain:\nZeile A\n\n> Zeile B';
  gleich(schalteMarkierung(t, 0, t.length).text, 'Refrain:\n> Zeile A\n\n> Zeile B');
  gleich(schalteMarkierung('> A\n> B', 0, 7).text, 'A\nB');
});
