// Bühne: Übersicht der Setlist (Startseite beim Auftritt).
import { h, icon } from '../dom.js';
import { hole, alleSongs, gespielt as ladeGespielt, setzeGespielt } from '../db.js';
import { uebersichtZeilen } from '../setlist-modell.js';
import { setlistListe } from './liste.js';
import { zeigeBearbeitung } from './uebersicht-bearbeiten.js';
import { exportiereJetzt } from '../austausch.js';

const scrollSchluessel = (id) => 'scroll:' + id;
const geaendertSchluessel = (id) => 'geaendert:' + id;

function sitzung(schluessel, wert) {
  try {
    if (wert === undefined) return sessionStorage.getItem(schluessel);
    if (wert === null) sessionStorage.removeItem(schluessel);
    else sessionStorage.setItem(schluessel, wert);
  } catch {}
  return null;
}

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

  // ---- Kurzfristige Änderungen (Bearbeitungsmodus) ----
  const bearbeiten = () => {
    sitzung(scrollSchluessel(setlistId), String(bereich.scrollTop));
    zeigeBearbeitung(app, {
      setlist,
      songs,
      gespielt,
      fertig: (gespeichert) => {
        if (gespeichert) sitzung(geaendertSchluessel(setlistId), '1');
        window.dispatchEvent(new HashChangeEvent('hashchange')); // Übersicht neu aufbauen
      },
    });
  };

  // Nach einer Änderung am iPad: Hinweis, den Stand für den Laptop zu exportieren
  function exportHinweis() {
    if (!sitzung(geaendertSchluessel(setlistId))) return null;
    const text = h('span.ue-hinweis-text', 'Änderung gespeichert. Damit sie auf den Laptop kommt, den Stand exportieren.');
    const knopf = h('button.knopf-klein.ue-hinweis-knopf', { type: 'button' }, 'Exportieren');
    const hinweis = h(
      'div.ue-hinweis',
      { role: 'status' },
      text,
      knopf,
      h('button.knopf-icon', { type: 'button', 'aria-label': 'Hinweis schließen', onclick: () => { sitzung(geaendertSchluessel(setlistId), null); hinweis.remove(); } }, icon('kreuz', 22))
    );
    knopf.addEventListener('click', async () => {
      knopf.disabled = true;
      try {
        const meldung = await exportiereJetzt();
        if (meldung) {
          text.textContent = meldung + ' Auf dem NAS ablegen und am Laptop importieren.';
          sitzung(geaendertSchluessel(setlistId), null);
        }
      } catch (e) {
        text.textContent = 'Export fehlgeschlagen: ' + (e?.message || e);
      }
      knopf.disabled = false;
    });
    return hinweis;
  }

  app.append(
    h(
      'div.ue',
      h(
        'header.ue-kopf',
        h('a.knopf-icon', { href: '#/', 'aria-label': 'Setlist wechseln' }, icon('start', 26)),
        h('h1.ue-name', setlist.name || 'Setlist'),
        fortschritt,
        h('button.knopf-klein', { type: 'button', onclick: bearbeiten }, 'Reihenfolge ändern'),
        h('button.knopf-klein', { type: 'button', onclick: zuruecksetzen }, 'Zurücksetzen')
      ),
      exportHinweis(),
      bereich
    )
  );
  zeichne();

  // Scrollposition merken und beim Zurückkommen von der Songseite wiederherstellen
  const gemerkt = Number(sitzung(scrollSchluessel(setlistId)) || 0);
  requestAnimationFrame(() => (bereich.scrollTop = gemerkt));
  return () => {
    if (bereich.isConnected) sitzung(scrollSchluessel(setlistId), String(bereich.scrollTop));
  };
}
