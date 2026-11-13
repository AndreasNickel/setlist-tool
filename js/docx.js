// Liest eine .docx-Datei in eine einfache Struktur:
//   { absaetze: [{ zeilen: [[Lauf, …], …] }], tabPt }
//   Lauf = { text, schrift, pt, fett, kursiv, marker, farbe }
// Eine Zeile entsteht pro manuellem Zeilenumbruch (Umschalt+Enter) innerhalb eines Absatzes.
import { leseZip, zipText } from './zip.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const kinder = (el, name) => (el ? [...el.children].filter((k) => k.namespaceURI === W && (!name || k.localName === name)) : []);
const kind = (el, name) => kinder(el, name)[0] || null;
const attr = (el, name) => (el ? el.getAttributeNS(W, name) ?? el.getAttribute('w:' + name) : null);
const xml = (text) => new DOMParser().parseFromString(text, 'application/xml');

/** Schalter wie <w:b/>, <w:b w:val="0"/> */
function schalter(rPr, name) {
  const el = kind(rPr, name);
  if (!el) return undefined;
  const v = attr(el, 'val');
  return !(v === '0' || v === 'false' || v === 'off');
}

/** Liest die für uns wichtigen Zeichen-Eigenschaften (nur gesetzte Werte). */
function zeichenEigenschaften(rPr, themen) {
  if (!rPr) return {};
  const e = {};
  const f = kind(rPr, 'rFonts');
  if (f) {
    const schrift = attr(f, 'ascii') || attr(f, 'hAnsi');
    const thema = attr(f, 'asciiTheme') || attr(f, 'hAnsiTheme');
    if (schrift) e.schrift = schrift;
    else if (thema) e.schrift = thema.startsWith('major') ? themen.major : themen.minor;
  }
  const sz = kind(rPr, 'sz');
  if (sz && attr(sz, 'val')) e.pt = Number(attr(sz, 'val')) / 2;
  const b = schalter(rPr, 'b');
  if (b !== undefined) e.fett = b;
  const i = schalter(rPr, 'i');
  if (i !== undefined) e.kursiv = i;
  const hl = kind(rPr, 'highlight');
  if (hl) {
    const v = attr(hl, 'val');
    e.marker = v && v !== 'none' ? v : '';
  }
  const shd = kind(rPr, 'shd');
  if (shd && !e.marker) {
    const fill = (attr(shd, 'fill') || '').toLowerCase();
    if (fill && fill !== 'auto' && fill !== 'ffffff') e.marker = '#' + fill;
  }
  const c = kind(rPr, 'color');
  if (c) {
    const v = (attr(c, 'val') || '').toLowerCase();
    e.farbe = v && v !== 'auto' && v !== '000000' ? '#' + v : '';
  }
  return e;
}

function leseFormatvorlagen(doc, themen) {
  const vorlagen = new Map();
  let standardAbsatz = null;
  let basis = { schrift: themen.minor || 'Times New Roman', pt: 10, fett: false, kursiv: false, marker: '', farbe: '' };
  if (!doc) return { vorlagen, standardAbsatz, basis };
  const root = doc.documentElement;
  const defaults = kind(kind(kind(root, 'docDefaults'), 'rPrDefault'), 'rPr');
  basis = { ...basis, ...zeichenEigenschaften(defaults, themen) };
  for (const s of kinder(root, 'style')) {
    const id = attr(s, 'styleId');
    vorlagen.set(id, {
      basiertAuf: attr(kind(s, 'basedOn'), 'val'),
      rPr: zeichenEigenschaften(kind(s, 'rPr'), themen),
    });
    if (attr(s, 'type') === 'paragraph' && attr(s, 'default') === '1') standardAbsatz = id;
  }
  return { vorlagen, standardAbsatz, basis };
}

/** Eigenschaften einer Formatvorlage samt Vererbung (basedOn). */
function vorlageEigenschaften(vorlagen, id, tiefe = 0) {
  const v = id && vorlagen.get(id);
  if (!v || tiefe > 10) return {};
  return { ...vorlageEigenschaften(vorlagen, v.basiertAuf, tiefe + 1), ...v.rPr };
}

export async function leseDocx(puffer) {
  let dateien;
  try {
    dateien = leseZip(puffer);
  } catch {
    throw new Error('Die Datei ist kein Word-Dokument im .docx-Format. Ältere .doc-Dateien bitte in Word als .docx speichern.');
  }
  const dokumentText = await zipText(dateien, 'word/document.xml');
  if (!dokumentText) throw new Error('In der Datei fehlt word/document.xml – ist es wirklich ein Word-Dokument?');

  const themen = { minor: 'Calibri', major: 'Calibri Light' };
  const themaText = await zipText(dateien, 'word/theme/theme1.xml');
  if (themaText) {
    const t = xml(themaText);
    const schrift = (art) => t.getElementsByTagNameNS(A, art)[0]?.getElementsByTagNameNS(A, 'latin')[0]?.getAttribute('typeface');
    themen.minor = schrift('minorFont') || themen.minor;
    themen.major = schrift('majorFont') || themen.major;
  }
  const stilText = await zipText(dateien, 'word/styles.xml');
  const { vorlagen, standardAbsatz, basis } = leseFormatvorlagen(stilText ? xml(stilText) : null, themen);

  let tabPt = 36; // Word-Standard: 1,25 cm
  const einstText = await zipText(dateien, 'word/settings.xml');
  if (einstText) {
    const tab = xml(einstText).getElementsByTagNameNS(W, 'defaultTabStop')[0];
    if (tab && attr(tab, 'val')) tabPt = Number(attr(tab, 'val')) / 20;
  }

  const doc = xml(dokumentText);
  const koerper = doc.getElementsByTagNameNS(W, 'body')[0];
  const absaetze = [];
  for (const p of koerper.getElementsByTagNameNS(W, 'p')) {
    const pPr = kind(p, 'pPr');
    const absatzStil = attr(kind(pPr, 'pStyle'), 'val') || standardAbsatz;
    const absatzBasis = { ...basis, ...vorlageEigenschaften(vorlagen, absatzStil) };
    const zeilen = [[]];
    const lauf = (r) => {
      const rPr = kind(r, 'rPr');
      const eig = { ...absatzBasis, ...vorlageEigenschaften(vorlagen, attr(kind(rPr, 'rStyle'), 'val')), ...zeichenEigenschaften(rPr, themen) };
      const neu = (text) => {
        const aktuell = zeilen[zeilen.length - 1];
        const letzter = aktuell[aktuell.length - 1];
        if (letzter && letzter.eig === eig) letzter.text += text;
        else aktuell.push({ text, eig });
      };
      for (const k of r.children) {
        if (k.namespaceURI !== W) continue;
        if (k.localName === 't') neu(k.textContent);
        else if (k.localName === 'tab') neu('\t');
        else if (k.localName === 'noBreakHyphen') neu('-');
        else if (k.localName === 'br' || k.localName === 'cr') zeilen.push([]);
      }
    };
    const gehe = (el) => {
      for (const k of el.children) {
        if (k.namespaceURI !== W) continue;
        if (k.localName === 'r') lauf(k);
        else if (k.localName === 'del' || k.localName === 'pPr' || k.localName === 'p') continue;
        else gehe(k); // hyperlink, ins, smartTag, sdt …
      }
    };
    gehe(p);
    absaetze.push({
      zeilen: zeilen.map((z) =>
        z.map(({ text, eig }) => ({
          text,
          schrift: eig.schrift,
          pt: eig.pt,
          fett: !!eig.fett,
          kursiv: !!eig.kursiv,
          marker: eig.marker || '',
          farbe: eig.farbe || '',
        }))
      ),
    });
  }
  return { absaetze, tabPt };
}
