// Gemeinsame Helfer für Songtext-Eingabefelder (Song-Bestand, Word-Import).
import { schalteMarkierung } from '../songformat.js';

/** Ersetzt einen Textbereich so, dass Strg+Z im Browser weiter funktioniert. */
export function ersetze(feld, von, bis, text) {
  feld.focus();
  feld.setSelectionRange(von, bis);
  const ok = document.execCommand && document.execCommand('insertText', false, text);
  if (!ok || feld.value.slice(von, von + text.length) !== text) feld.setRangeText(text, von, bis, 'end');
}

/** Schaltet „> “ für die ausgewählten Zeilen um. Ergebnis: true, wenn sich etwas geändert hat. */
export function markiereAuswahl(feld) {
  const vorher = feld.value;
  const r = schalteMarkierung(vorher, feld.selectionStart, feld.selectionEnd);
  if (r.text === vorher) return false;
  const altesEnde = r.ende - (r.text.length - vorher.length);
  ersetze(feld, r.start, altesEnde, r.text.slice(r.start, r.ende));
  feld.setSelectionRange(r.start, r.ende);
  return true;
}

/** Strg+M (bzw. ⌘+M) im Feld ruft `aktion` auf. */
export function strgM(feld, aktion) {
  feld.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      aktion();
    }
  });
}
