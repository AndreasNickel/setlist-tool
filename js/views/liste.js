// Die Setlist-Übersicht als Liste – gemeinsam genutzt von Bühne und Editor-Vorschau.
import { h, icon } from '../dom.js';

const KENNZEICHEN = { text: 'Text', akkorde: 'Akkorde' };

/**
 * @param zeilen    Ergebnis von uebersichtZeilen()
 * @param gespielt  Set der gespielten Eintragsnummern
 * @param optionen  { hrefFuer(zeile) → Link der Songseite, onTitelTippen(zeile) }
 */
export function setlistListe(zeilen, gespielt, optionen = {}) {
  const liste = h('ol.sl-liste', { role: 'list' });
  for (const z of zeilen) {
    if (z.art === 'set') {
      liste.append(h('li.sl-set', h('h2', z.titel || 'Set')));
      continue;
    }
    if (z.art === 'notiz') {
      liste.append(h('li.sl-notiz', z.titel));
      continue;
    }
    const istGespielt = gespielt.has(z.index);
    const inhalt = [
      h('span.sl-nr', String(z.nr)),
      h('span.sl-text', h('span.sl-titel', z.titel), z.info ? h('span.sl-info', z.info) : null),
    ];
    let zeile;
    if (z.darstellung !== 'titel') {
      zeile = h(
        'a.sl-song.sl-link',
        { href: optionen.hrefFuer ? optionen.hrefFuer(z) : null, 'data-index': z.index },
        inhalt,
        h('span.sl-kennzeichen', KENNZEICHEN[z.darstellung]),
        istGespielt ? icon('haken', 28, 'gespielt') : icon('weiter', 30)
      );
    } else if (optionen.onTitelTippen) {
      zeile = h(
        'button.sl-song',
        { type: 'button', 'data-index': z.index, 'aria-pressed': String(istGespielt), onclick: () => optionen.onTitelTippen(z) },
        inhalt,
        istGespielt ? icon('haken', 28, 'gespielt') : h('span.sl-platz')
      );
    } else {
      zeile = h('div.sl-song', { 'data-index': z.index }, inhalt, istGespielt ? icon('haken', 28, 'gespielt') : h('span.sl-platz'));
    }
    if (istGespielt) zeile.classList.add('gespielt');
    liste.append(h('li', zeile));
  }
  return liste;
}
