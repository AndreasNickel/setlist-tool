// Songformat (Klartext):
//   [Am]Text         → Akkord (ChordPro) direkt vor der Silbe
//   Refrain:         → Abschnittsname (eigene Zeile, endet mit Doppelpunkt)
//   > Zeile          → markierte Zeile (gelber Textmarker)
//   (leere Zeile)    → Abschnittsgrenze

const ABSCHNITT = /^([^\[\]>:][^\[\]:]{0,39}):\s*$/;
const AKKORD = /\[([^\]\n]*)\]/g;

/** Zerlegt eine Zeile in Segmente { akkord, text }; Text vor dem ersten Akkord hat akkord ''. */
export function zerlegeZeile(zeile) {
  const segmente = [];
  let rest = 0;
  let akkord = '';
  let m;
  AKKORD.lastIndex = 0;
  while ((m = AKKORD.exec(zeile))) {
    const text = zeile.slice(rest, m.index);
    if (text || akkord) segmente.push({ akkord, text });
    akkord = m[1].trim();
    rest = m.index + m[0].length;
  }
  const text = zeile.slice(rest);
  if (text || akkord || !segmente.length) segmente.push({ akkord, text });
  return segmente;
}

/** Entfernt alle Akkorde aus einer Zeile. */
export function ohneAkkorde(zeile) {
  return zeile.replace(AKKORD, '').replace(/ {2,}/g, ' ');
}

/** Hat der Inhalt überhaupt Akkorde? */
export function hatAkkorde(inhalt) {
  AKKORD.lastIndex = 0;
  return AKKORD.test(String(inhalt ?? ''));
}

/**
 * Schaltet die Markierung („> “ am Zeilenanfang) für alle Zeilen der Auswahl um.
 * Sind alle betroffenen Zeilen markiert, wird die Markierung entfernt, sonst gesetzt.
 * Leerzeilen und Abschnittsnamen bleiben unberührt.
 * Ergebnis: { text, start, ende } – die neue Auswahl umfasst die ganzen Zeilen.
 */
export function schalteMarkierung(text, start, ende) {
  const vorStart = text.lastIndexOf('\n', start - 1) + 1;
  let bisEnde = text.indexOf('\n', ende > start && text[ende - 1] === '\n' ? ende - 1 : ende);
  if (bisEnde < 0) bisEnde = text.length;
  const zeilen = text.slice(vorStart, bisEnde).split('\n');
  const betroffen = (z) => z.trim() && !ABSCHNITT.test(z.trim());
  const relevante = zeilen.filter(betroffen);
  if (!relevante.length) return { text, start, ende };
  const alleMarkiert = relevante.every((z) => /^\s*>/.test(z));
  const neu = zeilen.map((z) => {
    if (!betroffen(z)) return z;
    if (alleMarkiert) return z.replace(/^(\s*)>\s?/, '$1');
    return /^\s*>/.test(z) ? z : '> ' + z;
  });
  const block = neu.join('\n');
  return { text: text.slice(0, vorStart) + block + text.slice(bisEnde), start: vorStart, ende: vorStart + block.length };
}

/**
 * Zerlegt den Songinhalt in Abschnitte:
 * [{ name: 'Refrain' | '', zeilen: [{ markiert, segmente: [{ akkord, text }] }] }]
 */
export function parseSong(inhalt) {
  const abschnitte = [];
  let aktuell = null;
  const neu = (name = '') => {
    aktuell = { name, zeilen: [] };
    abschnitte.push(aktuell);
  };

  for (const roh of String(inhalt ?? '').split(/\r?\n/)) {
    const zeile = roh.replace(/\s+$/, '');
    if (!zeile.trim()) {
      aktuell = null; // Leerzeile beendet den Abschnitt
      continue;
    }
    const abschnitt = zeile.trim().match(ABSCHNITT);
    if (abschnitt) {
      neu(abschnitt[1].trim());
      continue;
    }
    if (!aktuell) neu();
    let text = zeile;
    let markiert = false;
    if (/^\s*>/.test(text)) {
      markiert = true;
      text = text.replace(/^\s*>\s?/, '');
    }
    aktuell.zeilen.push({ markiert, segmente: zerlegeZeile(text) });
  }
  // Abschnitte, die nur aus einem Namen bestehen, bleiben erhalten (z. B. „Solo:“)
  return abschnitte;
}
