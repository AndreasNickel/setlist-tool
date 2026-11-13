// Bühne: Übersicht der Setlist (Startseite beim Auftritt).
import { h, icon } from '../dom.js';
import { hole, alleSongs, gespielt as ladeGespielt, setzeGespielt } from '../db.js';
import { uebersichtZeilen } from '../setlist-modell.js';
import { setlistListe } from './liste.js';

const scrollSchluessel = (id) => 'scroll:' + id;

export async function zeigeUebersicht(app, setlistId) {
  const [setlist, songs] = await Promise.all([hole('setlists', setlistId), alleSongs()]);
  if (!setlist) {
    app.append(h('p.fehler', 'Diese Setlist gibt es auf diesem Gerät nicht. ', h('a', { href: '#/' }, 'Zur Auswahl')));
    return;
  }
  const zeilen = uebersichtZeilen(setlist.eintraege, songs);
  const gespielt = await ladeGespielt(setlistId);
  const anzahlSongs = zeilen.filter((z) => z.art === 'song').length;

  const fortschritt = h('span.ue-fortschritt');
  const zeigeFortschritt = () => {
    const n = zeilen.filter((z) => z.art === 'song' && gespielt.has(z.index)).length;
    fortschritt.textContent = `${n} von ${anzahlSongs} gespielt`;
  };

  const bereich = h('div.ue-scroll');
  const zeichne = () => {
    const teile = [
      setlistListe(zeilen, gespielt, {
        hrefFuer: (z) => `#/buehne/${encodeURIComponent(setlistId)}/${z.index}`,
        onTitelTippen: async (z) => {
          if (gespielt.has(z.index)) gespielt.delete(z.index);
          else gespielt.add(z.index);
          await setzeGespielt(setlistId, gespielt);
          zeichne();
        },
      }),
    ];
    if (!zeilen.length) teile.push(h('p.leer', 'Diese Setlist ist noch leer.'));
    bereich.replaceChildren(...teile);
    zeigeFortschritt();
  };

  const zuruecksetzen = async () => {
    if (!gespielt.size) return;
    if (!confirm('Alle „gespielt“-Markierungen dieser Setlist zurücksetzen?')) return;
    gespielt.clear();
    await setzeGespielt(setlistId, gespielt);
    zeichne();
  };

  app.append(
    h(
      'div.ue',
      h(
        'header.ue-kopf',
        h('a.knopf-icon', { href: '#/', 'aria-label': 'Setlist wechseln' }, icon('start', 26)),
        h('h1.ue-name', setlist.name || 'Setlist'),
        fortschritt,
        h('button.knopf-klein', { type: 'button', onclick: zuruecksetzen }, 'Zurücksetzen')
      ),
      bereich
    )
  );
  zeichne();

  // Scrollposition merken und beim Zurückkommen von der Songseite wiederherstellen
  const gemerkt = Number(sessionStorage.getItem(scrollSchluessel(setlistId)) || 0);
  requestAnimationFrame(() => (bereich.scrollTop = gemerkt));
  return () => sessionStorage.setItem(scrollSchluessel(setlistId), String(bereich.scrollTop));
}
