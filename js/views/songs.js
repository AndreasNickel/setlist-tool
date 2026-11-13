// Laptop: Song-Bestand. Links Suche, Filter und Liste, in der Mitte die Eingabe,
// rechts die Vorschau der Songseite im iPad-Format.
import { h } from '../dom.js';
import { alleSetlists, alleSongs, hole, loesche, neueId, speichereSetlist, speichereSong } from '../db.js';
import { darstellungVon } from '../setlist-modell.js';
import { normalisiere } from '../titelsuche.js';
import { schalteMarkierung } from '../songformat.js';
import { wandleAkkordzeilen } from '../akkordzeilen.js';
import { ladeEinstellungen } from '../einstellungen.js';
import { songInhalt, passeEin } from './songseite.js';
import { pflegeKopf } from './pflege-kopf.js';

const DARSTELLUNG = { titel: 'nur Titel', text: 'Text', akkorde: 'Akkorde' };
const FILTER_SCHLUESSEL = 'songs:filter';

export async function zeigeSongs(app, songId) {
  let [songs, setlists] = await Promise.all([alleSongs(), alleSetlists()]);
  songs.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));

  if (!songId && songs.length) {
    location.replace('#/songs/' + encodeURIComponent(songs[0].id));
    return;
  }
  const song = songId ? await hole('songs', songId) : null;
  if (songId && !song) {
    location.replace('#/songs');
    return;
  }

  const neu = async () => {
    const s = await speichereSong({ id: neueId(), titel: 'Neuer Song', darstellung: 'text', kurzinfo: '', inhalt: '' });
    sessionStorage.setItem('songs:neu', s.id);
    location.hash = '#/songs/' + encodeURIComponent(s.id);
  };

  // ---- Linke Spalte: Suche, Filter, Liste ----
  let filter = { text: '', darstellung: '' };
  try {
    filter = { ...filter, ...JSON.parse(sessionStorage.getItem(FILTER_SCHLUESSEL) || '{}') };
  } catch {}
  const suche = h('input.so-suche', { type: 'search', placeholder: 'Titel suchen …', 'aria-label': 'Titel suchen', value: filter.text });
  const filterWahl = h(
    'select.so-filter',
    { 'aria-label': 'Nach Darstellung filtern' },
    h('option', { value: '' }, 'alle Darstellungen'),
    Object.entries(DARSTELLUNG).map(([k, v]) => h('option', { value: k }, v))
  );
  filterWahl.value = filter.darstellung;
  const liste = h('ul.so-liste');
  const anzahl = h('span.so-anzahl');

  const zeichneListe = () => {
    const n = normalisiere(filter.text);
    const sichtbar = songs.filter(
      (s) => (!n || normalisiere(s.titel).includes(n)) && (!filter.darstellung || darstellungVon(s) === filter.darstellung)
    );
    liste.replaceChildren(
      ...sichtbar.map((s) =>
        h(
          'li',
          h(
            'a.so-eintrag',
            { href: '#/songs/' + encodeURIComponent(s.id), class: s.id === song?.id ? 'aktiv' : '', 'aria-current': s.id === song?.id ? 'page' : null },
            h('span.so-eintrag-titel', s.titel || 'Ohne Titel'),
            h('span.so-eintrag-zusatz', [DARSTELLUNG[darstellungVon(s)], s.kurzinfo].filter(Boolean).join(' · '))
          )
        )
      )
    );
    anzahl.textContent = sichtbar.length === songs.length ? `${songs.length} Songs` : `${sichtbar.length} von ${songs.length} Songs`;
  };
  const filterGeaendert = () => {
    filter = { text: suche.value, darstellung: filterWahl.value };
    try {
      sessionStorage.setItem(FILTER_SCHLUESSEL, JSON.stringify(filter));
    } catch {}
    zeichneListe();
  };
  suche.addEventListener('input', filterGeaendert);
  filterWahl.addEventListener('change', filterGeaendert);

  const seitenleiste = h(
    'aside.ed-links.so-links',
    h('div.ed-links-kopf', h('h2', 'Song-Bestand'), h('button.knopf-klein', { type: 'button', onclick: neu }, '+ Neuer Song')),
    suche,
    filterWahl,
    anzahl,
    liste
  );
  zeichneListe();

  if (!song) {
    app.append(
      h(
        'div.ed',
        pflegeKopf('songs'),
        h(
          'div.ed-rumpf',
          seitenleiste,
          h('section.ed-mitte.ed-leer', h('p', 'Noch keine Songs im Bestand.'), h('button.knopf', { type: 'button', onclick: neu }, '+ Neuer Song'))
        )
      )
    );
    return;
  }

  // ---- Mitte: Felder und Text ----
  const titel = h('input', { id: 'so-titel', type: 'text', value: song.titel, autocomplete: 'off' });
  const kurzinfo = h('input', { id: 'so-kurzinfo', type: 'text', value: song.kurzinfo || '', autocomplete: 'off', placeholder: 'z. B. Capo 2, Einzähler langsam' });
  const titelHinweis = h('span.so-feldhinweis', { role: 'status' });
  const darstellung = h(
    'fieldset.so-darstellung',
    h('legend', 'Darstellung'),
    Object.entries(DARSTELLUNG).map(([k, v]) =>
      h('label', h('input', { type: 'radio', name: 'so-darstellung', value: k, checked: (song.darstellung || 'text') === k }), h('span', v))
    )
  );
  const wert = () => darstellung.querySelector('input:checked')?.value || 'text';

  const textfeld = h('textarea.so-text', { spellcheck: false, 'aria-label': 'Songtext', autocapitalize: 'off', autocomplete: 'off' });
  textfeld.value = song.inhalt || '';
  const meldung = h('span.so-meldung', { role: 'status' });
  const darstellungHinweis = h('p.so-darstellung-hinweis');

  const markieren = () => {
    const vorher = textfeld.value;
    const r = schalteMarkierung(vorher, textfeld.selectionStart, textfeld.selectionEnd);
    if (r.text === vorher) return;
    const altesEnde = r.ende - (r.text.length - vorher.length);
    ersetze(textfeld, r.start, altesEnde, r.text.slice(r.start, r.ende));
    textfeld.setSelectionRange(r.start, r.ende);
    geaendert();
  };
  const umwandeln = () => {
    const r = wandleAkkordzeilen(textfeld.value);
    if (!r.anzahl) return zeigeMeldung('Keine Akkordzeilen gefunden.');
    ersetze(textfeld, 0, textfeld.value.length, r.text);
    geaendert();
    zeigeMeldung(`${r.anzahl} Akkordzeile${r.anzahl === 1 ? '' : 'n'} umgewandelt.`);
  };
  let meldungTimer = null;
  const zeigeMeldung = (text) => {
    meldung.textContent = text;
    clearTimeout(meldungTimer);
    meldungTimer = setTimeout(() => (meldung.textContent = ''), 5000);
  };

  textfeld.addEventListener('paste', (e) => {
    const eingefuegt = e.clipboardData?.getData('text/plain');
    if (!eingefuegt) return;
    const r = wandleAkkordzeilen(eingefuegt);
    if (!r.anzahl) return;
    e.preventDefault();
    ersetze(textfeld, textfeld.selectionStart, textfeld.selectionEnd, r.text);
    geaendert();
    zeigeMeldung(`Beim Einfügen ${r.anzahl} Akkordzeile${r.anzahl === 1 ? '' : 'n'} in ChordPro umgewandelt.`);
  });
  textfeld.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      markieren();
    }
  });

  const werkzeuge = h(
    'div.so-werkzeuge',
    h('button.knopf-klein', { type: 'button', onclick: markieren, title: 'Ausgewählte Zeilen markieren bzw. Markierung entfernen (Strg+M)' }, h('span.so-marker', 'Markieren')),
    h('button.knopf-klein', { type: 'button', onclick: umwandeln, title: 'Zeilen mit Akkorden über dem Text in ChordPro umwandeln' }, 'Akkordzeilen umwandeln'),
    h('span.ed-luecke'),
    meldung
  );

  const legende = h(
    'div.ed-legende',
    h('span', h('code.c-set', '[Am]'), ' Akkord vor der Silbe'),
    h('span', h('code', 'Refrain:'), ' Abschnittsname'),
    h('span', h('code.c-notiz', '> '), ' markierte Zeile'),
    h('span', 'Leerzeile = neuer Abschnitt')
  );

  // Verwendung in Setlists
  const verwendung = () => setlists.filter((sl) => (sl.eintraege || []).some((e) => e.songId === song.id));
  const verwendet = verwendung();
  const verwendungsZeile = h(
    'p.so-verwendung',
    verwendet.length
      ? ['Verwendet in: ', verwendet.map((sl, i) => [i ? ', ' : '', h('a', { href: '#/editor/' + encodeURIComponent(sl.id) }, sl.name || 'Setlist')])]
      : 'In keiner Setlist verwendet.'
  );

  const entfernen = async () => {
    const text = verwendet.length
      ? `Song „${song.titel}“ löschen? Er steht in ${verwendet.length} Setlist${verwendet.length === 1 ? '' : 's'}; dort bleibt nur der Titel stehen.`
      : `Song „${song.titel}“ löschen?`;
    if (!confirm(text)) return;
    clearTimeout(timer);
    timer = null;
    for (const sl of verwendet) {
      sl.eintraege = sl.eintraege.map((e) => (e.songId === song.id ? { ...e, songId: null, eingabe: song.titel } : e));
      for (const [k, v] of Object.entries(sl.wahl || {})) if (v === song.id) delete sl.wahl[k];
      await speichereSetlist(sl);
    }
    await loesche('songs', song.id);
    location.hash = '#/songs';
  };

  const mitte = h(
    'section.ed-mitte.so-mitte',
    h(
      'div.ed-felder',
      h('div.ed-feld.breit', h('label', { for: 'so-titel' }, 'Titel'), titel, titelHinweis),
      h('div.ed-feld.so-kurzinfo', h('label', { for: 'so-kurzinfo' }, 'Standard-Kurzinfo'), kurzinfo),
      darstellung
    ),
    darstellungHinweis,
    werkzeuge,
    textfeld,
    legende,
    h(
      'div.so-fuss',
      verwendungsZeile,
      h('span.ed-luecke'),
      h('span.ed-speicherstand', { role: 'status' }),
      h('button.knopf-klein.gefahr', { type: 'button', onclick: entfernen }, 'Song löschen')
    )
  );
  const speicherStand = mitte.querySelector('.ed-speicherstand');

  // ---- Rechts: Vorschau der Songseite ----
  const einst = await ladeEinstellungen();
  const vTitel = h('span.sp-titel');
  const vInfo = h('span.sp-info');
  const vInhalt = h('div.sp-inhalt');
  const vorschau = h(
    'aside.ed-rechts',
    h('h2', 'Vorschau iPad'),
    h(
      'div.ed-ipad',
      h(
        'div.ed-ipad-bild',
        h('div.sp', h('div.sp-kopf', h('span.sp-kopf-text', vTitel, vInfo), h('span.sp-position', '1 / 1')), vInhalt, h('footer.sp-fuss', h('span'), h('span.sp-fuss-label', 'Vorschau')))
      )
    ),
    h('p.ed-klein.so-passung')
  );
  const passung = vorschau.querySelector('.so-passung');

  const zeichneVorschau = () => {
    const d = darstellungVon({ inhalt: textfeld.value, darstellung: wert() });
    vTitel.textContent = titel.value || 'Ohne Titel';
    vInfo.textContent = kurzinfo.value;
    vInfo.hidden = !kurzinfo.value;
    vInhalt.className = 'sp-inhalt' + (d === 'akkorde' ? ' mit-akkorden' : '');
    if (d === 'titel') {
      vInhalt.classList.add('nur-titel');
      vInhalt.replaceChildren(h('p.sp-nur-titel', titel.value || 'Ohne Titel'));
      vInhalt.style.removeProperty('--text-groesse');
      passung.textContent = 'In der Übersicht nicht zu öffnen; erscheint nur beim Wischen als Titelseite.';
      return;
    }
    vInhalt.replaceChildren(songInhalt(textfeld.value, d === 'akkorde'));
    const groesse = d === 'akkorde' ? einst.akkordTextGroesse : einst.textGroesse;
    const r = passeEin(vInhalt, groesse, Math.min(einst.mindestGroesse, groesse));
    passung.textContent = r.scrollen
      ? `Passt nicht auf eine Seite – wird auf der Bühne gescrollt (${r.px} px).`
      : `Passt auf eine Seite: ${r.px} px${r.px < groesse ? ` (verkleinert von ${groesse} px)` : ''}${r.spalten === 2 ? ', zweispaltig' : ''}.`;
  };

  const zeigeHinweise = () => {
    const d = wert();
    darstellungHinweis.textContent =
      d === 'titel'
        ? textfeld.value.trim()
          ? 'Darstellung „nur Titel“: Der Text bleibt gespeichert, wird aber auf der Bühne nicht angezeigt.'
          : ''
        : !textfeld.value.trim()
          ? 'Ohne Text erscheint der Song auf der Bühne als „nur Titel“.'
          : d === 'text' && /\[[^\]\n]*\]/.test(textfeld.value)
            ? 'Darstellung „Text“: Akkorde bleiben gespeichert, werden aber auf der Bühne ausgeblendet.'
            : '';
    const n = normalisiere(titel.value);
    const doppelt = n && songs.some((s) => s.id !== song.id && normalisiere(s.titel) === n);
    titelHinweis.textContent = doppelt ? 'Diesen Titel gibt es schon im Bestand.' : '';
  };

  app.append(h('div.ed', pflegeKopf('songs'), h('div.ed-rumpf', seitenleiste, mitte, vorschau)));

  // ---- Speichern (verzögert) ----
  let timer = null;
  let vorschauTimer = null;
  const speichere = async () => {
    clearTimeout(timer);
    timer = null;
    Object.assign(song, { titel: titel.value.trim() || 'Ohne Titel', kurzinfo: kurzinfo.value.trim(), darstellung: wert(), inhalt: textfeld.value });
    await speichereSong(song);
    const i = songs.findIndex((s) => s.id === song.id);
    if (i >= 0) songs[i] = { ...song };
    songs.sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
    zeichneListe();
    speicherStand.textContent = 'gespeichert';
  };
  const geaendert = () => {
    zeigeHinweise();
    clearTimeout(vorschauTimer);
    vorschauTimer = setTimeout(zeichneVorschau, 120);
    speicherStand.textContent = '…';
    clearTimeout(timer);
    timer = setTimeout(speichere, 400);
  };
  for (const el of [titel, kurzinfo, textfeld]) el.addEventListener('input', geaendert);
  darstellung.addEventListener('change', geaendert);

  zeigeHinweise();
  speicherStand.textContent = 'gespeichert';
  await document.fonts?.ready;
  zeichneVorschau();
  if (sessionStorage.getItem('songs:neu') === song.id) {
    sessionStorage.removeItem('songs:neu');
    titel.focus();
    titel.select();
  }
  liste.querySelector('.aktiv')?.scrollIntoView({ block: 'nearest' });

  return () => {
    if (timer) speichere();
  };
}

/** Ersetzt einen Textbereich so, dass Strg+Z im Browser weiter funktioniert. */
function ersetze(feld, von, bis, text) {
  feld.focus();
  feld.setSelectionRange(von, bis);
  const ok = document.execCommand && document.execCommand('insertText', false, text);
  if (!ok || feld.value.slice(von, von + text.length) !== text) feld.setRangeText(text, von, bis, 'end');
}
