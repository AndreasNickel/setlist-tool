// Baut kleine .docx-Dateien für Tests – nur Platzhaltertexte, keine echten Songs.
//
// absaetze: [[Lauf, …], …], Lauf = { text?, br?, tab?, schrift?, pt?, fett?, marker?, farbe? }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function laufXml(l) {
  const rPr = [];
  if (l.schrift) rPr.push(`<w:rFonts w:ascii="${l.schrift}" w:hAnsi="${l.schrift}"/>`);
  if (l.fett) rPr.push('<w:b/>');
  if (l.farbe) rPr.push(`<w:color w:val="${l.farbe}"/>`);
  if (l.pt) rPr.push(`<w:sz w:val="${l.pt * 2}"/>`);
  if (l.marker) rPr.push(`<w:highlight w:val="${l.marker}"/>`);
  const inhalt = l.br ? '<w:br/>' : l.tab ? '<w:tab/>' : `<w:t xml:space="preserve">${esc(l.text || '')}</w:t>`;
  return `<w:r>${rPr.length ? `<w:rPr>${rPr.join('')}</w:rPr>` : ''}${inhalt}</w:r>`;
}

export function dokumentXml(absaetze) {
  const body = absaetze.map((a) => `<w:p>${a.map(laufXml).join('')}</w:p>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
}

export function stileXml({ schrift = 'Times New Roman', pt = 18 } = {}) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${schrift}" w:hAnsi="${schrift}"/><w:sz w:val="${pt * 2}"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/></w:style>
</w:styles>`;
}

/** Erzeugt ein ZIP (Deflate oder gespeichert) aus { name: text }. */
export async function zip(dateien, { packen = true } = {}) {
  const enc = new TextEncoder();
  const lokal = [];
  const zentral = [];
  let offset = 0;
  for (const [name, text] of Object.entries(dateien)) {
    const roh = enc.encode(text);
    const daten = packen ? await deflate(roh) : roh;
    const n = enc.encode(name);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true);
    kopf.setUint16(4, 20, true);
    kopf.setUint16(8, packen ? 8 : 0, true);
    kopf.setUint32(18, daten.length, true);
    kopf.setUint32(22, roh.length, true);
    kopf.setUint16(26, n.length, true);
    lokal.push(new Uint8Array(kopf.buffer), n, daten);

    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true);
    z.setUint16(4, 20, true);
    z.setUint16(6, 20, true);
    z.setUint16(10, packen ? 8 : 0, true);
    z.setUint32(20, daten.length, true);
    z.setUint32(24, roh.length, true);
    z.setUint16(28, n.length, true);
    z.setUint32(42, offset, true);
    zentral.push(new Uint8Array(z.buffer), n);
    offset += 30 + n.length + daten.length;
  }
  const zentralLaenge = zentral.reduce((s, t) => s + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(8, Object.keys(dateien).length, true);
  ende.setUint16(10, Object.keys(dateien).length, true);
  ende.setUint32(12, zentralLaenge, true);
  ende.setUint32(16, offset, true);
  return new Blob([...lokal, ...zentral, new Uint8Array(ende.buffer)]).arrayBuffer();
}

async function deflate(roh) {
  const strom = new Blob([roh]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

export async function baueDocx(absaetze, stil) {
  return zip({ 'word/document.xml': dokumentXml(absaetze), 'word/styles.xml': stileXml(stil) });
}
