// Druckansicht einer Setlist für Mitmusiker (Drucken oder „Als PDF speichern“).
// Nur Titel, Kurzinfos, Sets und Anmerkungen – keine Songtexte, Akkorde, Markierungen oder „gespielt“.
import { h } from '../dom.js';
import { hole, alleSongs } from '../db.js';
import { uebersichtZeilen } from '../setlist-modell.js';

/** „2026-11-20“ → „Freitag, 20. November 2026“ (ungültige Werte unverändert). */
export function druckDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Zerlegt die Zeilen in Sets; Einträge vor der ersten Set-Überschrift bilden ein Set ohne Überschrift. */
export function druckSets(zeilen) {
  const sets = [];
  let aktuell = null;
  for (const z of zeilen) {
    if (z.art === 'set') {
      aktuell = { titel: z.titel || 'Set', zeilen: [] };
      sets.push(aktuell);
      continue;
    }
    if (!aktuell) {
      aktuell = { titel: '', zeilen: [] };
      sets.push(aktuell);
    }
    aktuell.zeilen.push(z);
  }
  return sets.filter((s) => s.titel || s.zeilen.length);
}

export async function zeigeDruck(app, setlistId) {
  const [setlist, songs] = await Promise.all([hole('setlists', setlistId), alleSongs()]);
  if (!setlist) {
    app.append(h('p.fehler', 'Diese Setlist gibt es auf diesem Gerät nicht. ', h('a', { href: '#/editor' }, 'Zum Editor')));
    return;
  }
  const sets = druckSets(uebersichtZeilen(setlist.eintraege, songs));
  const zurueck = '#/editor/' + encodeURIComponent(setlist.id);
  const datumOrt = [druckDatum(setlist.datum), (setlist.ort || '').trim()].filter(Boolean).join(' · ');

  const blatt = h(
    'article.dr-blatt',
    h('header.dr-kopf', h('h1', setlist.name || 'Setlist'), datumOrt ? h('p.dr-datum', datumOrt) : null),
    sets.length
      ? sets.map((s) =>
          h(
            'section.dr-set',
            s.titel ? h('h2', s.titel) : null,
            h(
              'ol.dr-liste',
              s.zeilen.map((z) =>
                z.art === 'notiz'
                  ? h('li.dr-notiz', z.titel)
                  : h('li.dr-song', h('span.dr-nr', z.nr + '.'), h('span.dr-titel', z.titel), z.info ? h('span.dr-info', z.info) : null)
              )
            )
          )
        )
      : h('p.dr-leer', 'Diese Setlist ist noch leer.')
  );

  app.append(
    h(
      'div.dr',
      h(
        'div.dr-leiste',
        h('a', { href: zurueck }, '‹ Zurück zum Editor'),
        h('button.knopf', { type: 'button', onclick: () => window.print() }, 'Drucken / PDF'),
        h('span.dr-tipp', 'Im Druckdialog als Ziel „Als PDF speichern“ wählen – am iPad über „Teilen“ in der Dateien-App sichern.')
      ),
      blatt
    )
  );

  // Druckdialog öffnen, sobald die Schrift geladen ist (sonst druckt der Browser mit Ersatzschrift).
  let abgebrochen = false;
  document.fonts.ready.then(() => requestAnimationFrame(() => setTimeout(() => !abgebrochen && window.print(), 100)));
  return () => {
    abgebrochen = true;
  };
}
