// Kopfleiste der Pflege-Ansichten am Laptop (Setlists · Song-Bestand · Sichern & Übertragen).
import { h } from '../dom.js';

const BEREICHE = [
  { id: 'setlists', name: 'Setlists', href: '#/editor' },
  { id: 'songs', name: 'Song-Bestand', href: '#/songs' },
  { id: 'sichern', name: 'Sichern & Übertragen', spaeter: 'kommt in Stufe 4' },
];

/** @param aktiv  'setlists' | 'songs'   @param rechts  zusätzliche Elemente vor „Einstellungen“ */
export function pflegeKopf(aktiv, ...rechts) {
  return h(
    'header.ed-kopf',
    h('span.ed-marke', 'Setlist-Tool'),
    h(
      'nav.ed-nav',
      { 'aria-label': 'Bereiche' },
      BEREICHE.map((b) =>
        b.spaeter
          ? h('span.ed-nav-spaeter', { title: b.spaeter }, b.name)
          : h('a', { href: b.href, class: b.id === aktiv ? 'aktiv' : '', 'aria-current': b.id === aktiv ? 'page' : null }, b.name)
      )
    ),
    h('span.ed-luecke'),
    rechts,
    h('a.ed-kopf-link', { href: '#/' }, 'Bühne'),
    h('a.ed-kopf-link', { href: '#/einstellungen' }, 'Einstellungen')
  );
}
