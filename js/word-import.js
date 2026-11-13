// Wandelt ein gelesenes Word-Dokument (siehe docx.js) in das Songformat um.
//
// - Erste nicht leere Zeile = Titel
// - Akkordzeile (eigener Absatz oder vor einem manuellen Zeilenumbruch) über einer Textzeile
//   → ChordPro; die Position jedes Akkords wird über die gemessene Breite in der
//   Originalschrift bestimmt (funktioniert für Courier New wie für Proportionalschriften)
// - Akkorde und Text im selben Absatz ohne Umbruch → getrennt am ersten Nicht-Akkord, Hinweis „prüfen“
// - Akkorde ohne Text → reine Akkordzeile
// - Textmarker oder Schriftfarbe auf der Textzeile → markierte Zeile
// - „Refrain:“ usw. → Abschnittsname, leere Absätze → Abschnittsgrenze
import { istAkkord } from './akkordzeilen.js';

const ABSCHNITT = /^[^\[\]>:][^\[\]:]{0,39}:\s*$/;

/** Breitenmesser über ein Canvas (Pixel). Für Tests lässt sich ein eigener Messer übergeben. */
export function canvasMesser() {
  const ctx = document.createElement('canvas').getContext('2d');
  const cache = new Map();
  return (lauf, text) => {
    const font = `${lauf.kursiv ? 'italic ' : ''}${lauf.fett ? 'bold ' : ''}${lauf.pt || 11}pt "${lauf.schrift || 'Times New Roman'}", serif`;
    const key = font + '\u0000' + text;
    let w = cache.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width;
      cache.set(key, w);
    }
    return w;
  };
}

/** Text einer Zeile und die x-Position vor jedem Zeichen (Länge + 1 Werte). */
export function positionen(laeufe, messer, tabBreite, startX = 0) {
  let text = '';
  const x = [startX];
  let akt = startX;
  for (const lauf of laeufe) {
    let segStart = 0;
    let segX = akt;
    for (let i = 0; i < lauf.text.length; i++) {
      const z = lauf.text[i];
      if (z === '\t') {
        akt = (Math.floor(akt / tabBreite + 1e-6) + 1) * tabBreite;
        segStart = i + 1;
        segX = akt;
      } else {
        akt = segX + messer(lauf, lauf.text.slice(segStart, i + 1));
      }
      text += z;
      x.push(akt);
    }
  }
  return { text, x };
}

const woerter = (text) => {
  const aus = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) aus.push({ wort: m[0], index: m.index });
  return aus;
};

/** Anteil markierter (Textmarker oder Farbe) sichtbarer Zeichen ≥ 50 %? */
function istMarkiert(laeufe) {
  let alle = 0;
  let markiert = 0;
  for (const l of laeufe) {
    const n = l.text.replace(/\s/g, '').length;
    alle += n;
    if (l.marker || l.farbe) markiert += n;
  }
  return alle > 0 && markiert / alle >= 0.5;
}

/** Läufe ab einer Zeichenposition abschneiden (für „Akkorde und Text im selben Absatz“). */
function teileLaeufe(laeufe, ab) {
  const vorne = [];
  const hinten = [];
  let pos = 0;
  for (const l of laeufe) {
    const ende = pos + l.text.length;
    if (ende <= ab) vorne.push(l);
    else if (pos >= ab) hinten.push(l);
    else {
      vorne.push({ ...l, text: l.text.slice(0, ab - pos) });
      hinten.push({ ...l, text: l.text.slice(ab - pos) });
    }
    pos = ende;
  }
  return [vorne, hinten];
}

/** Ordnet jedem Akkord die Textstelle zu und baut die ChordPro-Zeile. */
export function setzeAkkorde(akkorde, ziel, messer, letzterLauf) {
  const { text, x } = ziel;
  const ende = x[text.length];
  const leer = Math.max(1, messer(letzterLauf || {}, ' '));
  const einfuegen = []; // { index, akkord }
  let schwanz = '';
  let schwanzX = ende;
  for (const a of akkorde) {
    if (a.x > ende + leer * 0.5) {
      const abstand = Math.max(1, Math.round((a.x - schwanzX) / leer));
      schwanz += ' '.repeat(abstand) + `[${a.akkord}]`;
      schwanzX = a.x;
      continue;
    }
    // nächstgelegene Zeichengrenze
    let best = 0;
    for (let i = 1; i <= text.length; i++) if (Math.abs(x[i] - a.x) < Math.abs(x[best] - a.x)) best = i;
    // Akkord in einer Lücke → an den Anfang des folgenden Wortes
    while (best < text.length && /\s/.test(text[best]) && /\S/.test(text.slice(best))) best++;
    einfuegen.push({ index: best, akkord: a.akkord });
  }
  let aus = text;
  for (let i = einfuegen.length - 1; i >= 0; i--) {
    const { index, akkord } = einfuegen[i];
    aus = aus.slice(0, index) + `[${akkord}]` + aus.slice(index);
  }
  return (aus.replace(/\s+$/, '') + schwanz).replace(/\t/g, ' ');
}

/**
 * Hauptfunktion.
 * @param dokument  Ergebnis von leseDocx()
 * @param messer    (lauf, text) → Breite in px; Standard: Canvas
 * Ergebnis: { titel, inhalt, darstellung, hinweise: [{ zeile, text }], akkordzeilen, markiert }
 */
export function wandleWordDokument(dokument, messer = canvasMesser()) {
  const tabBreite = (dokument.tabPt || 36) * (4 / 3);

  // 1. flache Zeilenliste mit Einordnung
  const zeilen = [];
  for (const absatz of dokument.absaetze) {
    for (const laeufe of absatz.zeilen) {
      const text = laeufe.map((l) => l.text).join('');
      const t = text.trim();
      if (!t) {
        zeilen.push({ art: 'leer' });
        continue;
      }
      const w = woerter(text);
      if (w.every((x) => istAkkord(x.wort))) {
        zeilen.push({ art: 'akkorde', laeufe });
        continue;
      }
      // Akkorde und Text im selben Absatz, ohne Umbruch?
      let k = 0;
      while (k < w.length && istAkkord(w[k].wort)) k++;
      const luecke = k > 0 ? w[k].index - (w[k - 1].index + w[k - 1].wort.length) : 0;
      if (k >= 2 || (k === 1 && luecke >= 3)) {
        const [vorne, hinten] = teileLaeufe(laeufe, w[k].index);
        zeilen.push({ art: 'akkorde', laeufe: vorne, gemischt: true });
        zeilen.push({ art: 'text', laeufe: hinten });
        continue;
      }
      zeilen.push({ art: ABSCHNITT.test(t) ? 'abschnitt' : 'text', laeufe });
    }
  }

  // 2. Titel = erste nicht leere Zeile
  const ersterIndex = zeilen.findIndex((z) => z.art !== 'leer');
  let titel = '';
  if (ersterIndex >= 0) {
    titel = zeilen[ersterIndex].laeufe.map((l) => l.text).join('').replace(/\s+/g, ' ').trim().replace(/:$/, '');
    zeilen.splice(0, ersterIndex + 1);
  }

  // 3. Ausgabe
  const aus = [];
  const hinweise = [];
  let akkordzeilen = 0;
  let markiert = 0;
  const leerzeile = () => {
    if (aus.length && aus[aus.length - 1] !== '') aus.push('');
  };
  const akkordeVon = (z) => {
    const p = positionen(z.laeufe, messer, tabBreite);
    return woerter(p.text).map((w) => ({ akkord: w.wort, x: p.x[w.index] }));
  };

  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    if (z.art === 'leer') {
      leerzeile();
    } else if (z.art === 'abschnitt') {
      if (aus.length && aus[aus.length - 1] !== '') aus.push('');
      aus.push(z.laeufe.map((l) => l.text).join('').trim());
    } else if (z.art === 'akkorde') {
      akkordzeilen++;
      const naechste = zeilen[i + 1];
      const akkorde = akkordeVon(z);
      if (naechste && naechste.art === 'text') {
        const ziel = positionen(naechste.laeufe, messer, tabBreite);
        const zeile = setzeAkkorde(akkorde, ziel, messer, naechste.laeufe[naechste.laeufe.length - 1]).replace(/^\s+/, '');
        const mark = istMarkiert(naechste.laeufe);
        if (mark) markiert++;
        aus.push((mark ? '> ' : '') + zeile);
        if (z.gemischt) hinweise.push({ zeile: aus.length, text: 'Akkorde und Text standen im selben Absatz – Zuordnung prüfen.' });
        i++;
      } else {
        aus.push(akkorde.map((a) => `[${a.akkord}]`).join(' '));
      }
    } else {
      const mark = istMarkiert(z.laeufe);
      if (mark) markiert++;
      const text = z.laeufe.map((l) => l.text).join('').replace(/\t/g, ' ').trim();
      aus.push((mark ? '> ' : '') + text);
    }
  }
  while (aus.length && aus[aus.length - 1] === '') aus.pop();
  while (aus.length && aus[0] === '') aus.shift();

  return {
    titel,
    inhalt: aus.join('\n'),
    darstellung: akkordzeilen ? 'akkorde' : 'text',
    hinweise,
    akkordzeilen,
    markiert,
  };
}
