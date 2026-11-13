// Laptop: Setlists bearbeiten. Links die Auftritte, in der Mitte der Setlist-Text
// mit Erkennung je Zeile, rechts die Live-Vorschau der Bühnen-Übersicht.
import { h, icon } from '../dom.js';
import { alleSetlists, alleSongs, hole, loesche, neueId, speichereSetlist, speichereSong } from '../db.js';
import { loeseAuf, speicherform, editorText, uebersichtZeilen, darstellungVon } from '../setlist-modell.js';
import { normalisiere } from '../titelsuche.js';
import { setlistListe } from './liste.js';
import { datumText } from './start.js';
import { ladeBeispieldaten } from '../beispieldaten.js';
import { pflegeKopf } from './pflege-kopf.js';

const DARSTELLUNG = { titel: 'nur Titel', text: 'Text', akkorde: 'Akkorde' };
const heute = () => new Date().toISOString().slice(0, 10);

export async function zeigeEditor(app, setlistId) {
  let [setlists, songs] = await Promise.all([alleSetlists(), alleSongs()]);

  if (!setlistId && setlists.length) {
    location.replace('#/editor/' + encodeURIComponent(setlists[0].id));
    return;
  }
  const setlist = setlistId ? await hole('setlists', setlistId) : null;
  if (setlistId && !setlist) {
    location.replace('#/editor');
    return;
  }

  // ---- Kopfleiste ----
  const kopf = pflegeKopf('setlists', setlist ? h('a.knopf-hell', { href: '#/buehne/' + encodeURIComponent(setlist.id) }, 'Auf der Bühne öffnen') : null);

  // ---- Linke Spalte: Auftritte ----
  const neu = async () => {
    const s = await speichereSetlist({ id: neueId(), name: 'Neue Setlist', datum: heute(), ort: '', eintraege: [], wahl: {} });
    location.hash = '#/editor/' + encodeURIComponent(s.id);
  };
  const kopieren = async () => {
    if (!setlist) return;
    await speichere();
    const s = await speichereSetlist({ ...structuredClone(aktuell()), id: neueId(), name: 'Kopie von ' + (setlist.name || 'Setlist'), datum: heute() });
    location.hash = '#/editor/' + encodeURIComponent(s.id);
  };
  const entfernen = async () => {
    if (!setlist || !confirm(`Setlist „${setlist.name}“ löschen? Die Songs im Bestand bleiben erhalten.`)) return;
    clearTimeout(timer);
    await loesche('setlists', setlist.id);
    await loesche('gespielt', setlist.id);
    location.hash = '#/editor';
  };

  const seitenleiste = h(
    'aside.ed-links',
    h('div.ed-links-kopf', h('h2', 'Auftritte'), h('button.knopf-klein', { type: 'button', onclick: neu }, '+ Neu')),
    h(
      'ul.ed-auftritte',
      setlists.map((s) => {
        const n = (s.eintraege || []).filter((e) => e.typ === 'song').length;
        return h(
          'li',
          h(
            'a.ed-auftritt',
            { href: '#/editor/' + encodeURIComponent(s.id), class: s.id === setlist?.id ? 'aktiv' : '', 'aria-current': s.id === setlist?.id ? 'page' : null },
            h('span.ed-auftritt-name', s.name || 'Setlist'),
            h('span.ed-auftritt-zusatz', [datumText(s.datum), s.ort, `${n} Songs`].filter(Boolean).join(' · '))
          )
        );
      })
    ),
    h('span.ed-luecke'),
    setlist ? h('button.knopf-klein', { type: 'button', onclick: kopieren }, 'Setlist kopieren') : null,
    setlist ? h('button.knopf-klein.gefahr', { type: 'button', onclick: entfernen }, 'Setlist löschen') : null
  );

  if (!setlist) {
    app.append(
      h(
        'div.ed',
        kopf,
        h(
          'div.ed-rumpf',
          seitenleiste,
          h(
            'section.ed-mitte.ed-leer',
            h('p', 'Noch keine Setlist vorhanden.'),
            h('button.knopf', { type: 'button', onclick: neu }, '+ Neue Setlist'),
            songs.length
              ? null
              : h(
                  'button.knopf-klein',
                  {
                    type: 'button',
                    onclick: async () => {
                      await ladeBeispieldaten();
                      location.reload();
                    },
                  },
                  'Beispieldaten laden (Platzhaltertexte)'
                )
          )
        )
      )
    );
    return;
  }

  // ---- Mitte: Felder und Text ----
  const wahl = { ...(setlist.wahl || {}) };
  const feld = (id, beschriftung, typ, wert, klasse = '') =>
    h('div.ed-feld', { class: klasse }, h('label', { for: id }, beschriftung), h('input', { id, type: typ, value: wert || '', autocomplete: 'off' }));
  const felder = h(
    'div.ed-felder',
    feld('ed-name', 'Name', 'text', setlist.name, 'breit'),
    feld('ed-datum', 'Datum', 'date', setlist.datum),
    feld('ed-ort', 'Ort', 'text', setlist.ort)
  );
  const eingabe = (id) => felder.querySelector('#' + id);

  const textfeld = h('textarea.ed-text', {
    spellcheck: false,
    wrap: 'off',
    'aria-label': 'Setlist-Text, eine Zeile pro Eintrag',
    autocapitalize: 'off',
    autocomplete: 'off',
  });
  textfeld.value = editorText(setlist, songs);
  const nummern = h('div.ed-nummern', { 'aria-hidden': 'true' });
  const hintergrund = h('div.ed-hintergrund', { 'aria-hidden': 'true' });
  const hinweise = h('div.ed-hinweise');
  const rahmen = h('div.ed-rahmen', nummern, h('div.ed-textspalte', hintergrund, textfeld), hinweise);
  const statistik = h('span.ed-statistik');
  const speicherStand = h('span.ed-speicherstand', { role: 'status' });

  const legende = h(
    'div.ed-legende',
    h('span', h('code.c-set', '# …'), ' neues Set'),
    h('span', h('code', 'Titel | Info'), ' Song mit Kurzinfo/Ansage'),
    h('span', h('code.c-notiz', '! …'), ' freie Anmerkung'),
    h('span.ed-luecke'),
    statistik,
    speicherStand
  );

  // ---- Rechts: Vorschau ----
  const vorschauListe = h('div.ue-scroll');
  const vorschauName = h('h1.ue-name');
  const vorschau = h(
    'aside.ed-rechts',
    h('h2', 'Vorschau iPad'),
    h('div.ed-ipad', h('div.ed-ipad-bild', h('div.ue', h('header.ue-kopf', vorschauName, h('span.ue-fortschritt', 'Vorschau')), vorschauListe))),
    h('p.ed-klein', 'Live – so erscheint die Übersicht auf der Bühne')
  );

  app.append(
    h('div.ed', kopf, h('div.ed-rumpf', seitenleiste, h('section.ed-mitte', felder, rahmen, legende), vorschau))
  );

  // ---- Abgleich und Anzeige ----
  let eintraege = [];
  const aktuell = () => ({
    ...setlist,
    name: eingabe('ed-name').value.trim() || 'Setlist',
    datum: eingabe('ed-datum').value,
    ort: eingabe('ed-ort').value.trim(),
    eintraege: speicherform(eintraege),
    wahl,
  });

  const aktualisiere = () => {
    eintraege = loeseAuf(textfeld.value, songs, wahl);
    const zeilenAnzahl = textfeld.value.split('\n').length;
    const proZeile = new Map(eintraege.map((e) => [e.zeile, e]));

    nummern.replaceChildren(...Array.from({ length: zeilenAnzahl }, (_, i) => h('div', String(i + 1))));
    hintergrund.replaceChildren();
    hinweise.replaceChildren();
    for (let i = 0; i < zeilenAnzahl; i++) {
      const e = proZeile.get(i);
      const [art, inhalt] = hinweisFuer(e);
      hintergrund.append(h('div', { class: 'hg-' + (e?.typ === 'song' ? e.status : e?.typ || 'leer') }));
      hinweise.append(h('div.ed-hinweis', { class: art }, inhalt));
    }
    textfeld.style.height = zeilenAnzahl * zeilenHoehe() + 2 * 12 + 16 + 'px';

    const anzahl = (f) => eintraege.filter(f).length;
    const songsN = anzahl((e) => e.typ === 'song');
    const sets = anzahl((e) => e.typ === 'set');
    const unbekannt = anzahl((e) => e.typ === 'song' && e.status === 'unbekannt');
    const mehrdeutig = anzahl((e) => e.typ === 'song' && e.status === 'mehrdeutig');
    statistik.textContent = [
      `${songsN} Songs`,
      `${sets} ${sets === 1 ? 'Set' : 'Sets'}`,
      unbekannt ? `${unbekannt} unbekannt` : null,
      mehrdeutig ? `${mehrdeutig} mehrdeutig` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    vorschauName.textContent = eingabe('ed-name').value || 'Setlist';
    vorschauListe.replaceChildren(setlistListe(uebersichtZeilen(speicherform(eintraege), songs), new Set()));
  };

  const hinweisFuer = (e) => {
    if (!e || e.typ !== 'song') return ['', ''];
    if (e.status === 'treffer') {
      const s = e.kandidaten[0];
      const gleich = normalisiere(s.titel) === normalisiere(e.eingabe);
      const link = h('a.ed-songlink', { href: '#/songs/' + encodeURIComponent(s.id), title: 'Song im Bestand bearbeiten' }, DARSTELLUNG[darstellungVon(s)]);
      return ['ok', [gleich ? '' : `→ ${s.titel} · `, link]];
    }
    if (e.status === 'mehrdeutig') {
      const auswahl = h(
        'select.ed-auswahl',
        { 'aria-label': `Song für „${e.eingabe}“ wählen` },
        h('option', { value: '' }, `mehrdeutig (${e.kandidaten.length}) – wählen …`),
        e.kandidaten.map((s) => h('option', { value: s.id }, `${s.titel} · ${DARSTELLUNG[darstellungVon(s)]}`))
      );
      auswahl.addEventListener('change', () => {
        if (!auswahl.value) return;
        wahl[normalisiere(e.eingabe)] = auswahl.value;
        geaendert();
      });
      return ['warnung', auswahl];
    }
    const anlegen = h('button.ed-mini', { type: 'button' }, 'als Song anlegen');
    anlegen.addEventListener('click', async () => {
      const song = await speichereSong({ id: neueId(), titel: e.eingabe, darstellung: 'titel', kurzinfo: '', inhalt: '' });
      songs = [...songs, song];
      geaendert();
    });
    return ['warnung', ['unbekannter Titel ', anlegen]];
  };

  // ---- Speichern (verzögert) ----
  let timer = null;
  const speichere = async () => {
    clearTimeout(timer);
    timer = null;
    const stand = aktuell();
    Object.assign(setlist, stand);
    await speichereSetlist(stand);
    speicherStand.textContent = 'gespeichert';
  };
  const geaendert = () => {
    aktualisiere();
    speicherStand.textContent = '…';
    clearTimeout(timer);
    timer = setTimeout(speichere, 400);
  };

  textfeld.addEventListener('input', geaendert);
  felder.addEventListener('input', (ev) => {
    if (ev.target.id === 'ed-name') {
      const aktiv = seitenleiste.querySelector('.ed-auftritt.aktiv .ed-auftritt-name');
      if (aktiv) aktiv.textContent = ev.target.value || 'Setlist';
    }
    geaendert();
  });

  aktualisiere();
  speicherStand.textContent = 'gespeichert';
  if (!textfeld.value) textfeld.focus();

  return () => {
    if (timer) speichere();
  };
}

let gemesseneZeilenHoehe = 0;
function zeilenHoehe() {
  if (!gemesseneZeilenHoehe) {
    const wert = getComputedStyle(document.documentElement).getPropertyValue('--ed-zeile').trim();
    gemesseneZeilenHoehe = parseFloat(wert) || 28;
  }
  return gemesseneZeilenHoehe;
}
