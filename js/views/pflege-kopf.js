// Kopfleiste der Pflege-Ansichten am Laptop (Setlists · Song-Bestand · Sichern & Übertragen).
import { h } from '../dom.js';
import { erstelleExport, exportDatei, gibDateiAus, merkeAustausch } from '../austausch.js';

const BEREICHE = [
  { id: 'setlists', name: 'Setlists', href: '#/editor' },
  { id: 'songs', name: 'Song-Bestand', href: '#/songs' },
  { id: 'sichern', name: 'Sichern & Übertragen', href: '#/sichern' },
];

/** @param aktiv  'setlists' | 'songs' | 'sichern'   @param rechts  zusätzliche Elemente */
export function pflegeKopf(aktiv, ...rechts) {
  const exportKnopf = h('button.knopf-hell', { type: 'button', title: 'Alle Songs und Setlists als Datei speichern' }, 'Für iPad exportieren');
  exportKnopf.addEventListener('click', async () => {
    exportKnopf.disabled = true;
    try {
      const daten = await erstelleExport();
      await gibDateiAus(exportDatei(daten));
      await merkeAustausch({ letzterExport: daten.exportiert });
      exportKnopf.textContent = 'Exportiert ✓';
    } catch (e) {
      exportKnopf.textContent = 'Export fehlgeschlagen';
      console.error(e);
    }
    setTimeout(() => {
      exportKnopf.textContent = 'Für iPad exportieren';
      exportKnopf.disabled = false;
    }, 2500);
  });

  return h(
    'header.ed-kopf',
    h('span.ed-marke', 'Setlist-Tool'),
    h(
      'nav.ed-nav',
      { 'aria-label': 'Bereiche' },
      BEREICHE.map((b) => h('a', { href: b.href, class: b.id === aktiv ? 'aktiv' : '', 'aria-current': b.id === aktiv ? 'page' : null }, b.name))
    ),
    h('span.ed-luecke'),
    rechts,
    exportKnopf,
    h('a.ed-kopf-link', { href: '#/' }, 'Bühne'),
    h('a.ed-kopf-link', { href: '#/einstellungen' }, 'Einstellungen')
  );
}
