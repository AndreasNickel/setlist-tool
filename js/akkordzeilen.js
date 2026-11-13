// Umwandlung „Akkordzeile über Textzeile“ → ChordPro.
//
//   Am         F        C            [Am]Erste Zeile des [F]Textes, [C]noch mehr
//   Erste Zeile des Textes, noch mehr   →
//
// Als Akkord gilt ein Wort der Form Grundton (A–H, mit # oder b), optional Zusatz
// (m, maj, min, dim, aug, sus, add, Zahlen, +, °, Klammern) und Bass (/E).
// Eine Zeile ist eine Akkordzeile, wenn sie nur aus solchen Wörtern besteht.

const AKKORD_WORT = /^[A-H](?:#|b)?(?:maj|min|dim|aug|sus|add|m|M|[#b]\d|\+|°|ø|\d|\(|\)|-)*(?:\/[A-H](?:#|b)?)?$/;

export const istAkkord = (wort) => AKKORD_WORT.test(wort);

/** Tabulatoren in Leerzeichen umwandeln (Tabstopps alle 8 Zeichen), damit Spalten stimmen. */
function ohneTabs(zeile) {
  let aus = '';
  for (const z of zeile) {
    if (z === '\t') aus += ' '.repeat(8 - (aus.length % 8));
    else aus += z;
  }
  return aus;
}

/** Akkorde einer Zeile mit ihrer Spalte – oder null, wenn es keine Akkordzeile ist. */
export function akkordeDerZeile(zeile) {
  const z = ohneTabs(zeile).replace(/\s+$/, '');
  if (!z.trim()) return null;
  const akkorde = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(z))) {
    if (!istAkkord(m[0])) return null;
    akkorde.push({ akkord: m[0], spalte: m.index });
  }
  return akkorde;
}

/** Setzt Akkorde an ihren Spalten in die Textzeile ein. */
export function verbinde(akkorde, textzeile) {
  let text = ohneTabs(textzeile).replace(/\s+$/, '');
  const letzte = akkorde[akkorde.length - 1].spalte;
  if (text.length < letzte) text = text.padEnd(letzte, ' ');
  for (let i = akkorde.length - 1; i >= 0; i--) {
    const { akkord, spalte } = akkorde[i];
    text = text.slice(0, spalte) + `[${akkord}]` + text.slice(spalte);
  }
  return text;
}

/** Reine Akkordzeile (ohne Text darunter) als ChordPro: [Am]  [F] */
function nurAkkorde(akkorde) {
  return akkorde.map((a, i) => {
    const naechste = akkorde[i + 1];
    const abstand = naechste ? Math.max(1, naechste.spalte - a.spalte - a.akkord.length) : 0;
    return `[${a.akkord}]` + ' '.repeat(abstand);
  }).join('');
}

/**
 * Wandelt einen ganzen Text um. Ergebnis: { text, anzahl } (anzahl = umgewandelte Akkordzeilen).
 * Zeilen, die schon ChordPro sind, bleiben unverändert.
 */
export function wandleAkkordzeilen(eingabe) {
  const zeilen = String(eingabe ?? '').split(/\r?\n/);
  const aus = [];
  let anzahl = 0;
  for (let i = 0; i < zeilen.length; i++) {
    const akkorde = akkordeDerZeile(zeilen[i]);
    if (!akkorde) {
      aus.push(zeilen[i]);
      continue;
    }
    anzahl++;
    const naechste = zeilen[i + 1];
    const textDarunter = naechste !== undefined && naechste.trim() && !akkordeDerZeile(naechste) && !/^\s*[^\[\]>:][^\[\]:]{0,39}:\s*$/.test(naechste);
    if (textDarunter) {
      // Markierung der Textzeile bleibt vorn erhalten
      const markiert = /^\s*>\s?/.exec(naechste);
      if (markiert) aus.push('> ' + verbinde(akkorde.map((a) => ({ ...a, spalte: Math.max(0, a.spalte - markiert[0].length) })), naechste.slice(markiert[0].length)));
      else aus.push(verbinde(akkorde, naechste));
      i++;
    } else {
      aus.push(nurAkkorde(akkorde));
    }
  }
  return { text: aus.join('\n'), anzahl };
}
