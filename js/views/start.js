// Start: Setlist für den Auftritt wählen.
import { h, icon } from '../dom.js';
import { alleSetlists, alleSongs } from '../db.js';
import { ladeBeispieldaten } from '../beispieldaten.js';

export async function zeigeStart(app) {
  const [setlists, songs] = await Promise.all([alleSetlists(), alleSongs()]);

  const liste = setlists.length
    ? h(
        'ul.start-liste',
        setlists.map((s) => {
          const anzahl = (s.eintraege || []).filter((e) => e.typ === 'song').length;
          const zusatz = [datumText(s.datum), s.ort, `${anzahl} Songs`].filter(Boolean).join(' · ');
          return h(
            'li',
            h('a.start-setlist', { href: `#/buehne/${encodeURIComponent(s.id)}` }, h('span.start-name', s.name || 'Setlist'), h('span.start-zusatz', zusatz), icon('weiter', 30))
          );
        })
      )
    : h(
        'div.start-leer',
        h('p', 'Auf diesem Gerät gibt es noch keine Setlist.'),
        h('p', 'Setlists werden am Laptop im Editor angelegt.'),
        songs.length
          ? null
          : h(
              'button.knopf',
              {
                type: 'button',
                onclick: async () => {
                  await ladeBeispieldaten();
                  location.reload();
                },
              },
              'Beispieldaten laden (Platzhaltertexte)'
            )
      );

  app.append(
    h(
      'div.start',
      h('header.start-kopf', h('h1', 'Setlist wählen'), h('a.knopf-icon', { href: '#/einstellungen', 'aria-label': 'Einstellungen' }, icon('zahnrad', 28))),
      liste,
      h('footer.start-fuss', h('a', { href: '#/editor' }, icon('stift', 20), ' Setlists bearbeiten (Laptop)'))
    )
  );
}

export function datumText(iso) {
  if (!iso) return '';
  const [j, m, t] = String(iso).split('-');
  return t ? `${Number(t)}.${Number(m)}.${j}` : iso;
}
