// Titelsuche: ordnet eine eingetippte Zeile einem Song aus dem Bestand zu.
// Toleriert Groß-/Kleinschreibung, Satzzeichen, Tippfehler und Teiltitel.

/** Vergleichsform eines Titels: klein, ohne Akzente, Satzzeichen und doppelte Leerzeichen. */
export function normalisiere(titel) {
  return String(titel ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Levenshtein-Abstand, mit Abbruch sobald `grenze` überschritten ist. */
export function abstand(a, b, grenze = Infinity) {
  if (Math.abs(a.length - b.length) > grenze) return grenze + 1;
  let vorher = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const jetzt = [i];
    let zeilenMin = i;
    for (let j = 1; j <= b.length; j++) {
      const kosten = a[i - 1] === b[j - 1] ? 0 : 1;
      jetzt[j] = Math.min(vorher[j] + 1, jetzt[j - 1] + 1, vorher[j - 1] + kosten);
      zeilenMin = Math.min(zeilenMin, jetzt[j]);
    }
    if (zeilenMin > grenze) return grenze + 1;
    vorher = jetzt;
  }
  return vorher[b.length];
}

/** Erlaubte Tippfehler je nach Länge: bis 4 Zeichen keiner, dann einer je 5 Zeichen (max. 3). */
function fehlerGrenze(laenge) {
  if (laenge <= 4) return 0;
  return Math.min(3, Math.max(1, Math.floor(laenge / 5)));
}

/**
 * Sucht Songs zu einer Eingabe.
 * Ergebnis: { status: 'treffer' | 'mehrdeutig' | 'unbekannt', song?, kandidaten: Song[] }
 * Reihenfolge: exakter Titel → Teiltitel → Tippfehler. Die erste Stufe mit Treffern entscheidet.
 */
export function sucheSong(eingabe, songs) {
  const n = normalisiere(eingabe);
  if (!n) return { status: 'unbekannt', kandidaten: [] };
  const liste = songs.map((s) => ({ s, n: normalisiere(s.titel) }));

  const stufen = [
    () => liste.filter((x) => x.n === n),
    () => (n.length >= 3 ? liste.filter((x) => x.n.startsWith(n) || x.n.includes(' ' + n) || (n.length >= 4 && x.n.includes(n))) : []),
    () => {
      const grenze = fehlerGrenze(n.length);
      if (!grenze) return [];
      const mitAbstand = liste
        .map((x) => ({ ...x, d: abstand(n, x.n, grenze) }))
        .filter((x) => x.d <= grenze);
      if (!mitAbstand.length) return [];
      const best = Math.min(...mitAbstand.map((x) => x.d));
      return mitAbstand.filter((x) => x.d === best);
    },
  ];

  for (const stufe of stufen) {
    const treffer = stufe();
    if (treffer.length === 1) return { status: 'treffer', song: treffer[0].s, kandidaten: [treffer[0].s] };
    if (treffer.length > 1) {
      const kandidaten = treffer.map((x) => x.s).sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
      return { status: 'mehrdeutig', kandidaten };
    }
  }
  return { status: 'unbekannt', kandidaten: [] };
}
