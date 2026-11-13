// Bühne: Songseite (Text oder Text mit Akkorden).
// Text erscheint in der Wunschgröße; passt er nicht auf die Seite, wird bis zur Mindestgröße
// verkleinert, dann zweispaltig gesetzt und erst zuletzt gescrollt.
import { h, icon } from '../dom.js';
import { hole, alleSongs, gespielt as ladeGespielt, setzeGespielt } from '../db.js';
import { uebersichtZeilen } from '../setlist-modell.js';
import { parseSong, ohneAkkorde } from '../songformat.js';
import { ladeEinstellungen } from '../einstellungen.js';

export async function zeigeSongseite(app, setlistId, index) {
  const [setlist, songs, einst] = await Promise.all([hole('setlists', setlistId), alleSongs(), ladeEinstellungen()]);
  const zurUebersicht = `#/buehne/${encodeURIComponent(setlistId)}`;
  if (!setlist) {
    location.hash = '#/';
    return;
  }
  const zeilen = uebersichtZeilen(setlist.eintraege, songs);
  const zeile = zeilen.find((z) => z.index === index && z.art === 'song');
  if (!zeile) {
    location.hash = zurUebersicht;
    return;
  }
  const song = songs.find((s) => s.id === zeile.songId);
  const songZeilen = zeilen.filter((z) => z.art === 'song');
  const pos = songZeilen.indexOf(zeile);
  const vorher = songZeilen[pos - 1] || null;
  const nachher = songZeilen[pos + 1] || null;
  // Anmerkungen zwischen diesem und dem nächsten Song (z. B. Ansage, Pause)
  const bisIndex = nachher ? nachher.index : Infinity;
  const folgeNotizen = zeilen.filter((z) => z.art === 'notiz' && z.index > index && z.index < bisIndex);

  const mitAkkorden = zeile.darstellung === 'akkorde';
  const inhalt = h('div.sp-inhalt', { class: mitAkkorden ? 'mit-akkorden' : '' });
  if (zeile.darstellung === 'titel') {
    inhalt.classList.add('nur-titel');
    inhalt.append(h('p.sp-nur-titel', zeile.titel));
    if (zeile.info) inhalt.append(h('p.sp-nur-titel-info', zeile.info));
  } else {
    inhalt.append(songInhalt(song?.inhalt, mitAkkorden));
  }

  const linkZu = (z) => `${zurUebersicht}/${z.index}`;
  const seite = h(
    'div.sp',
    h(
      'a.sp-kopf',
      { href: zurUebersicht, 'aria-label': 'Zurück zur Übersicht' },
      h('span.sp-zurueck', icon('zurueck', 32)),
      h('span.sp-kopf-text', h('span.sp-titel', zeile.titel), zeile.info ? h('span.sp-info', zeile.info) : null),
      h('span.sp-position', `${zeile.nr} / ${songZeilen.length}`)
    ),
    inhalt,
    h(
      'footer.sp-fuss',
      vorher ? h('a.sp-vorher', { href: linkZu(vorher) }, '‹ ', vorher.titel) : h('span'),
      h(
        'span.sp-naechster',
        folgeNotizen.map((n) => h('span.sp-fuss-notiz', n.titel)),
        nachher ? h('a', { href: linkZu(nachher) }, h('span.sp-fuss-label', 'nächster: '), nachher.titel, ' ›') : h('span.sp-fuss-label', 'letzter Song')
      )
    )
  );
  app.append(seite);

  // ---- gespielt merken: beim Zurückkehren zur Übersicht oder Weiterwischen ----
  const markiere = async () => {
    const g = await ladeGespielt(setlistId);
    if (!g.has(index)) {
      g.add(index);
      await setzeGespielt(setlistId, g);
    }
  };
  seite.querySelector('.sp-kopf').addEventListener('click', (e) => {
    e.preventDefault();
    markiere().finally(() => (location.hash = zurUebersicht));
  });
  const gehe = (ziel, vorwaerts) => {
    if (!ziel) return;
    const weiter = () => (location.hash = linkZu(ziel));
    if (vorwaerts) markiere().finally(weiter);
    else weiter();
  };
  seite.querySelector('.sp-naechster a')?.addEventListener('click', (e) => {
    e.preventDefault();
    gehe(nachher, true);
  });

  // ---- Wischen links/rechts ----
  let start = null;
  const down = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const up = (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const schnell = Date.now() - start.t < 800;
    start = null;
    if (schnell && Math.abs(dx) > 70 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      if (dx < 0) gehe(nachher, true);
      else gehe(vorher, false);
    }
  };
  const abbrechen = () => (start = null);
  inhalt.addEventListener('pointerdown', down);
  inhalt.addEventListener('pointerup', up);
  inhalt.addEventListener('pointercancel', abbrechen);

  const taste = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') gehe(nachher, true);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') gehe(vorher, false);
    else if (e.key === 'Escape') seite.querySelector('.sp-kopf').click();
  };
  document.addEventListener('keydown', taste);

  // ---- Einpassen ----
  const groesse = mitAkkorden ? einst.akkordTextGroesse : einst.textGroesse;
  const minimum = Math.min(einst.mindestGroesse, groesse);
  const passe = () => passeEin(inhalt, groesse, minimum);
  await document.fonts?.ready;
  passe();
  window.addEventListener('resize', passe);

  return () => {
    document.removeEventListener('keydown', taste);
    window.removeEventListener('resize', passe);
  };
}

/** Baut den Songtext als DOM. */
export function songInhalt(text, mitAkkorden) {
  const wurzel = h('div.sp-text');
  for (const abschnitt of parseSong(text)) {
    const block = h('section.sp-abschnitt');
    if (abschnitt.name) block.append(h('div.sp-abschnitt-name', abschnitt.name));
    for (const z of abschnitt.zeilen) {
      const hatAkkord = mitAkkorden && z.segmente.some((s) => s.akkord);
      let el;
      if (hatAkkord) {
        el = h('div.sp-zeile.akk-zeile');
        for (const seg of z.segmente) {
          const woerter = seg.text.match(/\s*\S+\s*|\s+/g) || [''];
          woerter.forEach((wort, i) => {
            el.append(
              h(
                'span.einheit',
                h('span.akk', i === 0 ? seg.akkord : ''),
                h('span.txt', wort || ' ')
              )
            );
          });
        }
      } else {
        const t = z.segmente.map((s) => s.text).join('');
        el = h('div.sp-zeile', h('span.txt', mitAkkorden ? t : ohneAkkorde(t)));
      }
      if (z.markiert) el.classList.add('markiert');
      block.append(el);
    }
    wurzel.append(block);
  }
  return wurzel;
}

/**
 * Sucht die größte Schrift ≤ groesse, bei der alles auf die Seite passt:
 * erst einspaltig bis zur Mindestgröße, dann zweispaltig, sonst einspaltig in Wunschgröße mit Scrollen.
 */
export function passeEin(el, groesse, minimum) {
  const setze = (px, spalten) => {
    el.style.setProperty('--text-groesse', px + 'px');
    el.classList.toggle('zwei-spalten', spalten === 2);
    el.classList.remove('scrollen');
  };
  const passt = () => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;

  for (const spalten of [1, 2]) {
    for (let px = groesse; px >= minimum; px--) {
      setze(px, spalten);
      if (passt()) return { px, spalten };
    }
  }
  setze(groesse, 1);
  el.classList.add('scrollen');
  return { px: groesse, spalten: 1, scrollen: true };
}
