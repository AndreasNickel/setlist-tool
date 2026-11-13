// Minimaler ZIP-Leser (für .docx), ohne Bibliothek.
// Unterstützt „gespeichert“ (0) und „Deflate“ (8) über DecompressionStream des Browsers.

/** Liest das Inhaltsverzeichnis. Ergebnis: Map Dateiname → async () => Uint8Array */
export function leseZip(puffer) {
  const daten = new Uint8Array(puffer);
  const dv = new DataView(daten.buffer, daten.byteOffset, daten.byteLength);

  // Ende des zentralen Verzeichnisses suchen (Signatur 0x06054b50), höchstens 64 KB Kommentar
  let ende = -1;
  for (let i = daten.length - 22; i >= Math.max(0, daten.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      ende = i;
      break;
    }
  }
  if (ende < 0) throw new Error('Keine gültige ZIP-/DOCX-Datei.');

  const anzahl = dv.getUint16(ende + 10, true);
  let pos = dv.getUint32(ende + 16, true);
  const dateien = new Map();
  const dekoder = new TextDecoder();

  for (let n = 0; n < anzahl; n++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) throw new Error('Beschädigtes ZIP-Verzeichnis.');
    const methode = dv.getUint16(pos + 10, true);
    const groesse = dv.getUint32(pos + 20, true);
    const nameLaenge = dv.getUint16(pos + 28, true);
    const extraLaenge = dv.getUint16(pos + 30, true);
    const kommentarLaenge = dv.getUint16(pos + 32, true);
    const lokal = dv.getUint32(pos + 42, true);
    const name = dekoder.decode(daten.subarray(pos + 46, pos + 46 + nameLaenge));
    pos += 46 + nameLaenge + extraLaenge + kommentarLaenge;

    dateien.set(name, async () => {
      if (dv.getUint32(lokal, true) !== 0x04034b50) throw new Error('Beschädigter ZIP-Eintrag: ' + name);
      const start = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true);
      const roh = daten.subarray(start, start + groesse);
      if (methode === 0) return roh;
      if (methode === 8) return entpacke(roh);
      throw new Error(`Packverfahren ${methode} wird nicht unterstützt (${name}).`);
    });
  }
  return dateien;
}

async function entpacke(roh) {
  const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

/** Bequem: Text einer Datei im Archiv oder null. */
export async function zipText(dateien, name) {
  const lade = dateien.get(name);
  return lade ? new TextDecoder().decode(await lade()) : null;
}
