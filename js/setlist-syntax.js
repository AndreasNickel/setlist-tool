// Setlist-Syntax: eine Zeile pro Eintrag.
//   # Set 1            → neues Set
//   Titel              → Song aus dem Bestand
//   Titel | Kurzinfo   → Song mit Kurzinfo bzw. Ansage
//   ! Anmerkung        → freie Anmerkung
//   (leere Zeile)      → wird ignoriert

/**
 * Zerlegt den Setlist-Text in Zeilen-Einträge (noch ohne Abgleich mit dem Bestand).
 * Jeder Eintrag kennt seine Zeilennummer (0-basiert), damit der Editor ihn zuordnen kann.
 */
export function parseSetlistText(text) {
  const eintraege = [];
  const zeilen = String(text ?? '').split(/\r?\n/);
  zeilen.forEach((roh, zeile) => {
    const z = roh.trim();
    if (!z) return;
    if (z.startsWith('#')) {
      eintraege.push({ typ: 'set', titel: z.replace(/^#+/, '').trim(), zeile });
    } else if (z.startsWith('!')) {
      eintraege.push({ typ: 'notiz', text: z.slice(1).trim(), zeile });
    } else {
      const trenner = z.indexOf('|');
      const eingabe = (trenner >= 0 ? z.slice(0, trenner) : z).trim();
      const info = trenner >= 0 ? z.slice(trenner + 1).trim() : '';
      if (!eingabe) return; // „| nur Info“ ohne Titel ist kein Song
      eintraege.push({ typ: 'song', eingabe, info, zeile });
    }
  });
  return eintraege;
}

/**
 * Erzeugt aus gespeicherten Einträgen wieder den Text für den Editor.
 * `titelFuer(eintrag)` liefert den Titel, der für einen Song geschrieben werden soll.
 */
export function entriesToText(eintraege, titelFuer = (e) => e.eingabe) {
  const out = [];
  eintraege.forEach((e, i) => {
    if (e.typ === 'set') {
      if (i > 0) out.push('');
      out.push('# ' + e.titel);
    } else if (e.typ === 'notiz') {
      out.push('! ' + e.text);
    } else if (e.typ === 'song') {
      const titel = titelFuer(e);
      out.push(e.info ? `${titel} | ${e.info}` : titel);
    }
  });
  return out.join('\n');
}
