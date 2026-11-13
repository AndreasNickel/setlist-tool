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
