// Tests der reinen Logik. Nur Platzhaltertexte – keine echten Songdaten!
import { parseSetlistText, entriesToText } from '../js/setlist-syntax.js';
import { normalisiere, sucheSong, abstand } from '../js/titelsuche.js';
import { parseSong, zerlegeZeile, ohneAkkorde, schalteMarkierung } from '../js/songformat.js';
import { istAkkord, wandleAkkordzeilen } from '../js/akkordzeilen.js';
import { leseZip, zipText } from '../js/zip.js';
import { leseDocx } from '../js/docx.js';
import { wandleWordDokument } from '../js/word-import.js';
import { zip, baueDocx } from './docx-bauer.js';
import { pruefeImport, dateiname, neuereSetlists } from '../js/austausch.js';
import { loeseAuf, speicherform, editorText, uebersichtZeilen, zeileMitTitel } from '../js/setlist-modell.js';
import { arbeitsliste, verschiebe, fuegeSongEin, eintraegeAus, gespieltNeu, istGeaendert, sucheImBestand } from '../js/setlist-bearbeiten.js';
import { druckSets, druckDatum } from '../js/views/druck.js';

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

// ---- Word-Import ----
const mono = (lauf, text) => text.length * 10; // jede Schrift gleich breit: 10 px pro Zeichen
const C = 'Courier New';
const p = (...laeufe) => laeufe;
const t = (text, extra = {}) => ({ text, schrift: C, ...extra });

test('ZIP: gespeicherte und gepackte Einträge lesen', async () => {
  for (const packen of [false, true]) {
    const puffer = await zip({ 'a.txt': 'Hallo', 'ordner/b.txt': 'Welt äöü' }, { packen });
    const d = leseZip(puffer);
    gleich([await zipText(d, 'a.txt'), await zipText(d, 'ordner/b.txt'), await zipText(d, 'fehlt')], ['Hallo', 'Welt äöü', null]);
  }
});

test('DOCX: Schriften aus Standard und Lauf, Größe, Textmarker, Farbe, Umbruch', async () => {
  const puffer = await baueDocx(
    [p({ text: 'Titel' }), p(t('Am', { pt: 12 }), { br: true }, { text: 'Zeile', marker: 'yellow', farbe: 'FF0000' })],
    { schrift: 'Times New Roman', pt: 18 }
  );
  const doc = await leseDocx(puffer);
  gleich(doc.absaetze.length, 2);
  gleich(doc.absaetze[0].zeilen[0][0].schrift, 'Times New Roman');
  gleich(doc.absaetze[0].zeilen[0][0].pt, 18);
  const [z1, z2] = doc.absaetze[1].zeilen;
  gleich([z1[0].text, z1[0].schrift, z1[0].pt], ['Am', 'Courier New', 12]);
  gleich([z2[0].text, z2[0].marker, z2[0].farbe], ['Zeile', 'yellow', '#ff0000']);
});

test('DOCX: keine ZIP-Datei → verständlicher Fehler', async () => {
  let meldung = '';
  try {
    await leseDocx(new TextEncoder().encode('kein zip').buffer);
  } catch (e) {
    meldung = e.message;
  }
  gleich(meldung.includes('.docx'), true);
});

const DOKUMENT = {
  tabPt: 36,
  absaetze: [
    { zeilen: [[t('‹Testtitel›')]] },
    { zeilen: [[]] },
    { zeilen: [[t('Strophe 1:')]] },
    { zeilen: [[t('Am         F')]] }, // eigener Absatz
    { zeilen: [[t('Zeile eins des Textes')]] },
    { zeilen: [[t('C     G')], [t('Zeile zwei')]] }, // manueller Zeilenumbruch
    { zeilen: [[]] },
    { zeilen: [[]] },
    { zeilen: [[t('Refrain:')]] },
    { zeilen: [[t('D', { farbe: '#ff0000' })]] }, // farbige Akkordzeile markiert NICHT
    { zeilen: [[t('Zeile ohne Marker')]] },
    { zeilen: [[t('Markierte Zeile', { marker: 'yellow' })]] },
    { zeilen: [[t('Am  F  Zeile drei')]] }, // Akkorde und Text im selben Absatz
    { zeilen: [[]] },
    { zeilen: [[t('G   D')]] }, // nur Akkorde
  ],
};

test('Word-Import: Titel, Abschnitte, Akkordzeilen (Absatz und Umbruch), Markierung, Hinweis', () => {
  const r = wandleWordDokument(DOKUMENT, mono);
  gleich(r.titel, '‹Testtitel›');
  gleich(
    r.inhalt.split('\n'),
    [
      'Strophe 1:',
      '[Am]Zeile eins [F]des Textes',
      '[C]Zeile [G]zwei',
      '',
      'Refrain:',
      '[D]Zeile ohne Marker',
      '> Markierte Zeile',
      '[Am]Zeil[F]e drei',
      '',
      '[G] [D]',
    ]
  );
  gleich([r.darstellung, r.akkordzeilen, r.markiert], ['akkorde', 5, 1]);
  gleich(r.hinweise, [{ zeile: 8, text: 'Akkorde und Text standen im selben Absatz – Zuordnung prüfen.' }]);
});

test('Word-Import: Proportionalschrift über Zeichenbreiten', () => {
  // schmale Zeichen i, l und Leerzeichen 4 px, alle anderen 10 px
  const prop = (lauf, text) => [...text].reduce((s, z) => s + ('il '.includes(z) ? 4 : 10), 0);
  const T = (text) => ({ text, schrift: 'Times New Roman' });
  const doc = { absaetze: [{ zeilen: [[T('Titel')]] }, { zeilen: [[T('Am      F')]] }, { zeilen: [[T('Will ich')]] }] };
  // F liegt bei 20 + 6·4 = 44 px; „Will ic|h“ beginnt bei 40 px → vor dem h
  gleich(wandleWordDokument(doc, prop).inhalt, '[Am]Will ic[F]h');
  // dieselbe Zeile in gleich breiter Schrift ergäbe eine andere Stelle
  gleich(wandleWordDokument(doc, mono).inhalt, '[Am]Will ich[F]');
});

test('Word-Import: Tabulatoren, Akkord hinter dem Zeilenende, „Am“ als Wort', () => {
  const doc = {
    tabPt: 30, // 40 px
    absaetze: [
      { zeilen: [[t('Titel')]] },
      { zeilen: [[t('\tG'), t('        C')]] }, // G bei 40 px, C bei 40+10+80 = 130 px
      { zeilen: [[t('Kurze Zeile')]] }, // 110 px lang → C dahinter
      { zeilen: [[t('Am Abend ohne Akkorde')]] }, // ein Akkordwort am Anfang ist noch keine Akkordzeile
    ],
  };
  gleich(wandleWordDokument(doc, mono).inhalt.split('\n'), ['Kurz[G]e Zeile  [C]', 'Am Abend ohne Akkorde']);
});

test('Word-Import: ohne Akkorde → Darstellung Text, leere Absätze zusammengefasst', () => {
  const doc = { absaetze: [{ zeilen: [[]] }, { zeilen: [[t('Titel')]] }, { zeilen: [[]] }, { zeilen: [[t('A eins')]] }, { zeilen: [[]] }, { zeilen: [[]] }, { zeilen: [[t('B zwei')]] }, { zeilen: [[]] }] };
  const r = wandleWordDokument(doc, mono);
  gleich([r.titel, r.inhalt, r.darstellung], ['Titel', 'A eins\n\nB zwei', 'text']);
});

// ---- Export/Import ----
const EXPORT = {
  format: 'setlist-tool',
  version: 1,
  exportiert: '2026-11-13T10:00:00.000Z',
  songs: [
    { id: 's1', titel: 'Erster Song', darstellung: 'akkorde', kurzinfo: 'Capo 2', inhalt: '[Am]‹Zeile›', geaendert: '2026-11-12T10:00:00.000Z', fremd: 'weg' },
    { id: 's2', titel: '', darstellung: 'unsinn' },
  ],
  setlists: [
    {
      id: 'l1', name: 'Auftritt', datum: '2026-11-20', ort: '[Ort]',
      eintraege: [{ typ: 'set', titel: 'Set 1' }, { typ: 'song', eingabe: 'erster', info: '', songId: 's1' }, { typ: 'song', eingabe: 'weg', songId: 'gibtsnicht' }, { typ: 'notiz', text: 'Pause' }, { typ: 'kaputt' }],
      wahl: { erster: 's1', alt: 'gibtsnicht' },
    },
  ],
};

test('Import: gültige Datei wird bereinigt (Felder, Darstellung, verwaiste Verweise)', () => {
  const d = pruefeImport(JSON.stringify(EXPORT));
  gleich(d.songs[0], { id: 's1', titel: 'Erster Song', darstellung: 'akkorde', kurzinfo: 'Capo 2', inhalt: '[Am]‹Zeile›', geaendert: '2026-11-12T10:00:00.000Z' });
  gleich([d.songs[1].titel, d.songs[1].darstellung], ['Ohne Titel', 'text']);
  gleich(d.setlists[0].eintraege, [
    { typ: 'set', titel: 'Set 1' },
    { typ: 'song', eingabe: 'erster', info: '', songId: 's1' },
    { typ: 'song', eingabe: 'weg', info: '', songId: null },
    { typ: 'notiz', text: 'Pause' },
  ]);
  gleich(d.setlists[0].wahl, { erster: 's1' });
});

test('Import: falsche Dateien werden mit verständlicher Meldung abgelehnt', () => {
  const fehler = (text) => {
    try {
      pruefeImport(text);
      return 'kein Fehler';
    } catch (e) {
      return e.message;
    }
  };
  gleich(fehler('kein json').includes('kein JSON'), true);
  gleich(fehler('{"format":"anderes"}').includes('nicht aus dem Setlist-Tool'), true);
  gleich(fehler(JSON.stringify({ ...EXPORT, version: 99 })).includes('neueren Version'), true);
  gleich(fehler(JSON.stringify({ ...EXPORT, songs: [{ titel: 'ohne id' }] })).includes('Kennung'), true);
});

test('Export: Dateiname endet auf .setlist.json', () => {
  gleich(dateiname(new Date(2026, 10, 13, 9, 5)), 'setlist-tool-2026-11-13-0905.setlist.json');
});

// ---- Druckansicht ----
test('Druck: Sets mit durchgehender Nummerierung, Einträge vor dem ersten Set ohne Überschrift', () => {
  const songs = [{ id: 'a', titel: 'Song A', darstellung: 'akkorde', kurzinfo: 'Capo 2', inhalt: '[Am]‹Zeile›' }];
  const zeilen = uebersichtZeilen(
    [
      { typ: 'song', eingabe: 'unbekannt', info: '', songId: null },
      { typ: 'set', titel: 'Set 1' },
      { typ: 'song', eingabe: 'song a', info: '', songId: 'a' },
      { typ: 'notiz', text: 'Pause' },
      { typ: 'set', titel: 'Leer' },
      { typ: 'set', titel: 'Set 2' },
      { typ: 'song', eingabe: 'song a', info: 'Ansage', songId: 'a' },
    ],
    songs
  );
  const sets = druckSets(zeilen);
  gleich(sets.map((s) => s.titel), ['', 'Set 1', 'Leer', 'Set 2']);
  gleich(sets[1].zeilen.map((z) => [z.art, z.nr, z.titel, z.info]), [['song', 2, 'Song A', 'Capo 2'], ['notiz', undefined, 'Pause', undefined]]);
  gleich(sets[3].zeilen.map((z) => [z.nr, z.info]), [[3, 'Ansage']]);
  // keine Songinhalte in den Druckzeilen
  gleich(JSON.stringify(sets).includes('Zeile'), false);
});

test('Druck: Datum ausgeschrieben, ungültige Werte unverändert', () => {
  gleich(druckDatum('2026-11-20'), 'Freitag, 20. November 2026');
  gleich(druckDatum(''), '');
  gleich(druckDatum('demnächst'), 'demnächst');
});

// ---- Kurzfristige Änderungen am iPad ----
const E = [
  { typ: 'set', titel: 'Set 1' },
  { typ: 'song', eingabe: 'A', info: '', songId: 'a' },
  { typ: 'song', eingabe: 'B', info: '', songId: 'b' },
  { typ: 'notiz', text: 'Pause' },
  { typ: 'song', eingabe: 'C', info: 'Capo 2', songId: 'c' },
];
const namen = (l) => eintraegeAus(l).map((e) => e.eingabe || e.titel || e.text);

test('Bearbeiten: verschieben, einfügen, Änderung erkennen', () => {
  let l = arbeitsliste(E);
  gleich(istGeaendert(l, E), false);
  l = verschiebe(l, 4, 1);
  gleich(namen(l), ['Set 1', 'C', 'A', 'B', 'Pause']);
  gleich(verschiebe(l, 0, -1) === l || namen(verschiebe(l, 0, -1))[0] === 'Set 1', true);
  const r = fuegeSongEin(l, { id: 'd', titel: 'Neu D' }, 1);
  gleich(r.pos, 2);
  gleich(namen(r.liste), ['Set 1', 'C', 'Neu D', 'A', 'B', 'Pause']);
  gleich(r.liste[2].e, { typ: 'song', eingabe: 'Neu D', info: '', songId: 'd' });
  gleich(namen(fuegeSongEin(l, { id: 'd', titel: 'Neu D' }, null).liste).pop(), 'Neu D');
  gleich(istGeaendert(l, E), true);
});

test('Bearbeiten: „gespielt“ wandert mit den Einträgen', () => {
  let l = arbeitsliste(E);
  l = verschiebe(l, 1, 4); // A ans Ende
  l = fuegeSongEin(l, { id: 'd', titel: 'D' }, -1).liste; // D ganz nach vorn
  // vorher gespielt: A (1) und C (4)
  gleich([...gespieltNeu(l, new Set([1, 4]))].sort(), [4, 5]);
  gleich(namen(l), ['D', 'Set 1', 'B', 'Pause', 'C', 'A']);
});

test('Bearbeiten: Suche im Bestand – Anfang vor Teiltreffer, sonst tolerant', () => {
  const songs = [
    { id: '1', titel: 'Zweiter Morgen' },
    { id: '2', titel: 'Morgenrot' },
    { id: '3', titel: 'Abendlied' },
  ];
  gleich(sucheImBestand('morgen', songs).map((s) => s.id), ['2', '1']);
  gleich(sucheImBestand('abendlid', songs).map((s) => s.id), ['3']);
  gleich(sucheImBestand('  ', songs), []);
});

test('Editor: Titel im Bestand übernehmen behält die Kurzinfo', () => {
  gleich(zeileMitTitel('beispielsong eins', 'Beispielsong Eins'), 'Beispielsong Eins');
  gleich(zeileMitTitel('beispelsong eins |  Capo 2', 'Beispielsong Eins'), 'Beispielsong Eins | Capo 2');
});

test('Import: neuere Setlists auf dem Gerät werden erkannt und genannt', () => {
  const datei = { exportiert: '2026-11-13T10:00:00Z', setlists: [{ id: 'l1', geaendert: '2026-11-13T09:00:00Z' }, { id: 'l2', geaendert: '2026-11-13T09:00:00Z' }] };
  const lokal = [
    { id: 'l1', name: 'Älter', geaendert: '2026-11-13T08:00:00Z' },
    { id: 'l2', name: 'Am iPad geändert', geaendert: '2026-11-13T11:00:00Z' },
    { id: 'l3', name: 'Nur hier, neu', geaendert: '2026-11-13T12:00:00Z' },
    { id: 'l4', name: 'Nur hier, alt', geaendert: '2026-11-12T12:00:00Z' },
  ];
  gleich(neuereSetlists(lokal, datei).map((l) => [l.name, l.inDatei]), [['Am iPad geändert', true], ['Nur hier, neu', false]]);
});

// ---- Offline: alle benötigten Dateien stehen in der Liste des Service Workers ----
test('Offline: Service Worker kennt alle Dateien der App', async () => {
  const swText = await (await fetch('../sw.js', { cache: 'no-store' })).text();
  const liste = new Set([...swText.match(/const DATEIEN = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const fehlt = new Set();
  const gesehen = new Set();
  const lade = async (pfad) => (await fetch('../' + pfad, { cache: 'no-store' })).text();

  // JavaScript: allen Importen ab js/app.js folgen
  const offen = ['js/app.js'];
  while (offen.length) {
    const pfad = offen.pop();
    if (gesehen.has(pfad)) continue;
    gesehen.add(pfad);
    if (!liste.has(pfad)) fehlt.add(pfad);
    const text = await lade(pfad);
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*'(\.{1,2}\/[^']+)'/g)) {
      const ziel = new URL(m[1], 'https://x/' + pfad).pathname.slice(1);
      offen.push(ziel);
    }
  }
  // CSS-Schriften, index.html, Manifest
  for (const m of (await lade('css/app.css')).matchAll(/url\('\.\.\/([^']+)'\)/g)) if (!liste.has(m[1])) fehlt.add(m[1]);
  for (const m of (await lade('index.html')).matchAll(/(?:href|src)="([^"#:]+)"/g)) if (!liste.has(m[1])) fehlt.add(m[1]);
  for (const i of JSON.parse(await lade('manifest.webmanifest')).icons) if (!liste.has(i.src)) fehlt.add(i.src);
  gleich([...fehlt], [], 'fehlt in sw.js DATEIEN');

  // umgekehrt: jede gelistete Datei existiert
  const kaputt = [];
  for (const p of liste) if (!(await fetch('../' + p, { cache: 'no-store' })).ok) kaputt.push(p);
  gleich(kaputt, [], 'in sw.js gelistet, aber nicht vorhanden');
});
