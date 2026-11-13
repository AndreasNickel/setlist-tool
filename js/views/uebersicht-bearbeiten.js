// Bühne: Bearbeitungsmodus der Übersicht – kurzfristige Änderungen am iPad.
// Einträge ziehen oder mit ▲/▼ verschieben, mit ✕ entfernen (Rückgängig), Songs aus dem Bestand einfügen.
// Erst „Fertig“ speichert; „Abbrechen“ verwirft. Alle Tippflächen mindestens 44 px.
import { h, icon } from '../dom.js';
import { speichereSetlist, setzeGespielt } from '../db.js';
import { uebersichtZeilen, darstellungVon } from '../setlist-modell.js';
import { arbeitsliste, verschiebe, fuegeSongEin, eintraegeAus, gespieltNeu, istGeaendert, sucheImBestand } from '../setlist-bearbeiten.js';

const DARSTELLUNG = { titel: 'nur Titel', text: 'Text', akkorde: 'Akkorde' };

/**
 * @param ziel      Element, in das der Bearbeitungsmodus gezeichnet wird
 * @param optionen  { setlist, songs, gespielt: Set, fertig(gespeichert: boolean) }
 */
export function zeigeBearbeitung(ziel, { setlist, songs, gespielt, fertig }) {
  let arbeit = arbeitsliste(setlist.eintraege);
  let gewaehlt = null; // Schlüssel des Eintrags, hinter dem eingefügt wird (null = am Ende)
  const entfernt = []; // Stapel für „Rückgängig“: { eintrag, pos }
  let hervorheben = null;

  const liste = h('ol.ub-liste', { role: 'list' });
  const scroll = h('div.ue-scroll.ub-scroll', liste);
  const meldung = h('div.ub-meldung', { role: 'status', hidden: true });
  const suchfeld = h('input.ub-suche', {
    type: 'search',
    placeholder: 'Song aus dem Bestand suchen …',
    'aria-label': 'Song aus dem Bestand suchen und einfügen',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: false,
  });
  const treffer = h('div.ub-treffer');
  const zielText = h('span.ub-ziel-text');
  const ansEnde = h('button.ub-knopf-text', { type: 'button', onclick: () => waehle(null) }, 'ans Ende');
  const position = h('p.ub-ziel', zielText, ansEnde);

  // ---------- Zeichnen ----------
  const zeichne = () => {
    const zeilen = uebersichtZeilen(eintraegeAus(arbeit), songs);
    if (gewaehlt && !arbeit.some((x) => x.schluessel === gewaehlt)) gewaehlt = null;
    liste.replaceChildren(
      ...arbeit.map((x, i) => {
        const z = zeilen[i];
        const inhalt =
          z.art === 'set'
            ? h('span.ub-set', z.titel || 'Set')
            : z.art === 'notiz'
              ? h('span.ub-notiz', z.titel)
              : [h('span.ub-nr', String(z.nr)), h('span.ub-text', h('span.ub-titel', z.titel), z.info ? h('span.ub-info', z.info) : null)];
        const name = z.art === 'song' ? `${z.nr}. ${z.titel}` : z.titel || 'Set';
        const knopf = (klasse, symbol, label, aktion, aus = false) =>
          h('button.ub-knopf', { type: 'button', class: klasse, 'aria-label': `${label}: ${name}`, disabled: aus, onclick: aktion }, icon(symbol, 26));
        return h(
          'li.ub-zeile',
          {
            class: [`ub-${z.art}-zeile`, x.schluessel === gewaehlt ? 'gewaehlt' : '', x.schluessel === hervorheben ? 'bewegt' : ''].join(' '),
            'data-schluessel': x.schluessel,
          },
          h('button.ub-griff', { type: 'button', 'aria-label': `Ziehen zum Verschieben: ${name}`, onpointerdown: (e) => starteZiehen(e, x.schluessel) }, icon('griff', 26)),
          h(
            'button.ub-inhalt',
            { type: 'button', 'aria-pressed': String(x.schluessel === gewaehlt), title: 'Antippen: neue Songs hier dahinter einfügen', onclick: () => waehle(x.schluessel === gewaehlt ? null : x.schluessel) },
            inhalt
          ),
          knopf('ub-hoch', 'hoch', 'Nach oben', () => bewege(i, i - 1, 'ub-hoch'), i === 0),
          knopf('ub-runter', 'runter', 'Nach unten', () => bewege(i, i + 1, 'ub-runter'), i === arbeit.length - 1),
          knopf('ub-weg', 'kreuz', 'Entfernen', () => entferne(i))
        );
      })
    );
    if (!arbeit.length) liste.append(h('li.leer', 'Die Setlist ist leer. Songs über die Suche oben einfügen.'));
    const idx = arbeit.findIndex((x) => x.schluessel === gewaehlt);
    zielText.textContent = idx < 0 ? 'Neue Songs kommen ans Ende.' : `Neue Songs kommen hinter: ${zeilenName(zeilen[idx])}`;
    ansEnde.hidden = idx < 0;
    hervorheben = null;
  };
  const zeilenName = (z) => (z.art === 'song' ? `${z.nr}. ${z.titel}` : z.titel || 'Set');

  const fokussiere = (schluessel, klasse) => {
    const zeile = liste.querySelector(`[data-schluessel="${schluessel}"]`);
    if (!zeile) return;
    const knopf = zeile.querySelector('.' + klasse);
    (knopf && !knopf.disabled ? knopf : zeile.querySelector('.ub-inhalt')).focus({ preventScroll: true });
    zeile.scrollIntoView({ block: 'nearest' });
  };

  // ---------- Aktionen ----------
  const bewege = (von, nach, klasse) => {
    const schluessel = arbeit[von].schluessel;
    arbeit = verschiebe(arbeit, von, nach);
    hervorheben = schluessel;
    zeichne();
    fokussiere(schluessel, klasse);
  };

  const waehle = (schluessel) => {
    gewaehlt = schluessel;
    zeichne();
  };

  const zeigeMeldung = () => {
    if (!entfernt.length) {
      meldung.hidden = true;
      return;
    }
    const letzter = entfernt[entfernt.length - 1].eintrag.e;
    const name = letzter.typ === 'song' ? letzter.eingabe : letzter.typ === 'set' ? letzter.titel : letzter.text;
    meldung.hidden = false;
    meldung.replaceChildren(
      h('span.ub-meldung-text', `„${name}“ entfernt`, entfernt.length > 1 ? ` (${entfernt.length} Einträge)` : ''),
      h('button.ub-rueckgaengig', { type: 'button', onclick: rueckgaengig }, 'Rückgängig')
    );
  };

  const entferne = (i) => {
    entfernt.push({ eintrag: arbeit[i], pos: i });
    arbeit = arbeit.filter((_, j) => j !== i);
    zeichne();
    zeigeMeldung();
    const naechster = arbeit[Math.min(i, arbeit.length - 1)];
    if (naechster) fokussiere(naechster.schluessel, 'ub-weg');
  };

  function rueckgaengig() {
    const { eintrag, pos } = entfernt.pop();
    arbeit = [...arbeit.slice(0, pos), eintrag, ...arbeit.slice(pos)];
    hervorheben = eintrag.schluessel;
    zeichne();
    zeigeMeldung();
    fokussiere(eintrag.schluessel, 'ub-weg');
  }

  const fuegeEin = (song) => {
    const nach = arbeit.findIndex((x) => x.schluessel === gewaehlt);
    const ergebnis = fuegeSongEin(arbeit, song, gewaehlt ? nach : null);
    arbeit = ergebnis.liste;
    const neu = arbeit[ergebnis.pos].schluessel;
    gewaehlt = neu; // weitere Songs kommen dahinter – in Einfügereihenfolge
    hervorheben = neu;
    suchfeld.value = '';
    treffer.replaceChildren();
    zeichne();
    liste.querySelector(`[data-schluessel="${neu}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  // Steht der Song schon in der Setlist? → seine Nummer (sonst 0)
  const schonDrin = (songId) => {
    const z = uebersichtZeilen(eintraegeAus(arbeit), songs).find((x) => x.art === 'song' && x.songId === songId);
    return z ? z.nr : 0;
  };

  suchfeld.addEventListener('input', () => {
    const gefunden = sucheImBestand(suchfeld.value, songs);
    treffer.replaceChildren(
      ...gefunden.map((s) =>
        h(
          'button.ub-treffer-knopf',
          { type: 'button', onclick: () => fuegeEin(s) },
          icon('plus', 22),
          h('span.ub-treffer-titel', s.titel),
          schonDrin(s.id) ? h('span.ub-treffer-schon', `schon Nr. ${schonDrin(s.id)}`) : null,
          h('span.ub-treffer-art', DARSTELLUNG[darstellungVon(s)])
        )
      )
    );
    if (suchfeld.value.trim() && !gefunden.length) treffer.append(h('p.ub-kein-treffer', 'Kein Song im Bestand gefunden.'));
  });

  // ---------- Ziehen (Maus, Finger, Stift) ----------
  let zug = null;
  function starteZiehen(e, schluessel) {
    if (e.button > 0 || zug) return;
    e.preventDefault();
    const zeile = liste.querySelector(`[data-schluessel="${schluessel}"]`);
    zug = { zeile, schluessel, y: e.clientY, id: e.pointerId, lauf: 0 };
    zeile.classList.add('ziehen');
    document.body.classList.add('ub-zieht');
    window.addEventListener('pointermove', ziehe);
    window.addEventListener('pointerup', beendeZiehen);
    window.addEventListener('pointercancel', beendeZiehen);
    zug.lauf = requestAnimationFrame(rolle);
  }
  function ordne() {
    const { zeile, y } = zug;
    for (;;) {
      const vor = zeile.previousElementSibling;
      if (vor && y < mitte(vor)) {
        liste.insertBefore(zeile, vor);
        continue;
      }
      const nach = zeile.nextElementSibling;
      if (nach && y > mitte(nach)) {
        liste.insertBefore(nach, zeile);
        continue;
      }
      break;
    }
  }
  const mitte = (el) => {
    const r = el.getBoundingClientRect();
    return r.top + r.height / 2;
  };
  function ziehe(e) {
    if (!zug || e.pointerId !== zug.id) return;
    e.preventDefault();
    zug.y = e.clientY;
    ordne();
  }
  // Am Rand des Listenbereichs automatisch weiterrollen
  function rolle() {
    if (!zug) return;
    const r = scroll.getBoundingClientRect();
    const rand = 80;
    let schritt = 0;
    if (zug.y < r.top + rand) schritt = -Math.ceil((r.top + rand - zug.y) / 6);
    else if (zug.y > r.bottom - rand) schritt = Math.ceil((zug.y - (r.bottom - rand)) / 6);
    if (schritt) {
      scroll.scrollTop += schritt;
      ordne();
    }
    zug.lauf = requestAnimationFrame(rolle);
  }
  function beendeZiehen(e) {
    if (!zug || e.pointerId !== zug.id) return;
    cancelAnimationFrame(zug.lauf);
    window.removeEventListener('pointermove', ziehe);
    window.removeEventListener('pointerup', beendeZiehen);
    window.removeEventListener('pointercancel', beendeZiehen);
    document.body.classList.remove('ub-zieht');
    const reihenfolge = [...liste.querySelectorAll('.ub-zeile')].map((el) => el.dataset.schluessel);
    const proSchluessel = new Map(arbeit.map((x) => [x.schluessel, x]));
    arbeit = reihenfolge.map((s) => proSchluessel.get(s));
    hervorheben = zug.schluessel;
    zug = null;
    zeichne();
  }

  // ---------- Fertig / Abbrechen ----------
  const fertigKnopf = h('button.knopf.ub-fertig', { type: 'button' }, 'Fertig');
  fertigKnopf.addEventListener('click', async () => {
    if (!istGeaendert(arbeit, setlist.eintraege)) return fertig(false);
    fertigKnopf.disabled = true;
    try {
      await speichereSetlist({ ...setlist, eintraege: eintraegeAus(arbeit) });
      await setzeGespielt(setlist.id, gespieltNeu(arbeit, gespielt));
      fertig(true);
    } catch (err) {
      fertigKnopf.disabled = false;
      alert('Speichern fehlgeschlagen: ' + (err?.message || err));
    }
  });
  const abbrechen = () => {
    if (istGeaendert(arbeit, setlist.eintraege) && !confirm('Änderungen an der Reihenfolge verwerfen?')) return;
    fertig(false);
  };

  ziel.replaceChildren(
    h(
      'div.ue.ub',
      h(
        'header.ue-kopf.ub-kopf',
        h('button.knopf-klein', { type: 'button', onclick: abbrechen }, 'Abbrechen'),
        h('div.ub-kopf-text', h('h1.ue-name', 'Reihenfolge ändern'), h('span.ub-kopf-name', setlist.name || 'Setlist')),
        fertigKnopf
      ),
      h('div.ub-einfuegen', suchfeld, treffer, position),
      scroll,
      meldung
    )
  );
  zeichne();
}
