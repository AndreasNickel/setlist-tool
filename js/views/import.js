// Laptop: Word-Import. Eine .docx-Datei = ein Song. Nach dem Einlesen stehen Original,
// Ergebnis (bearbeitbar) und Vorschau nebeneinander; danach wird der Song übernommen.
import { h } from '../dom.js';
import { alleSongs, neueId, speichereSong } from '../db.js';
import { normalisiere } from '../titelsuche.js';
import { leseDocx } from '../docx.js';
import { wandleWordDokument } from '../word-import.js';
import { pflegeKopf } from './pflege-kopf.js';
import { songVorschau } from './song-vorschau.js';
import { markiereAuswahl, strgM } from './text-werkzeuge.js';

const DARSTELLUNG = { titel: 'nur Titel', text: 'Text', akkorde: 'Akkorde' };
const MARKER_FARBEN = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
};

// Warteschlange bleibt erhalten, solange die Seite offen ist (auch beim Wechsel zwischen Ansichten)
let warteschlange = [];
let erledigt = [];

export async function zeigeImport(app) {
  const songs = await alleSongs();
  const rumpf = h('div.ed-rumpf.wi');
  app.append(h('div.ed', pflegeKopf('songs'), rumpf));

  const offen = warteschlange.find((e) => !e.fertig);
  if (offen) await zeigePruefung(rumpf, offen, songs);
  else zeigeAuswahl(rumpf);
}

/** Ansicht neu aufbauen, ohne die Seite neu zu laden (die Warteschlange bleibt erhalten). */
const neuZeichnen = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// ---------- Dateiauswahl ----------
function zeigeAuswahl(rumpf) {
  const eingabe = h('input', { type: 'file', accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document', multiple: true, id: 'wi-datei', class: 'wi-datei' });
  const fehler = h('p.wi-fehler', { role: 'alert' });
  const lade = async (dateien) => {
    fehler.textContent = '';
    const liste = [...dateien].filter((d) => /\.docx$/i.test(d.name));
    const abgelehnt = [...dateien].filter((d) => !/\.docx$/i.test(d.name));
    if (abgelehnt.length) fehler.textContent = `Nur .docx-Dateien werden gelesen (übersprungen: ${abgelehnt.map((d) => d.name).join(', ')}). Ältere .doc-Dateien in Word als .docx speichern.`;
    if (!liste.length) return;
    warteschlange = [];
    erledigt = [];
    for (const datei of liste) {
      const eintrag = { name: datei.name, fertig: false };
      try {
        eintrag.dokument = await leseDocx(await datei.arrayBuffer());
        eintrag.ergebnis = wandleWordDokument(eintrag.dokument);
      } catch (e) {
        eintrag.fehler = e.message || String(e);
      }
      warteschlange.push(eintrag);
    }
    neuZeichnen();
  };
  eingabe.addEventListener('change', () => lade(eingabe.files));

  const zone = h(
    'label.wi-zone',
    { for: 'wi-datei' },
    h('strong', 'Word-Dateien (.docx) hierher ziehen'),
    h('span', 'oder klicken, um Dateien auszuwählen – eine Datei pro Song, mehrere auf einmal möglich')
  );
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('ueber');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('ueber'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('ueber');
    lade(e.dataTransfer.files);
  });

  rumpf.append(
    h(
      'section.ed-mitte.wi-start',
      h('h1.wi-titel', 'Word-Import'),
      h('p', 'Die Dateien werden nur hier im Browser gelesen und nirgendwohin hochgeladen.'),
      eingabe,
      zone,
      fehler,
      erledigt.length ? h('div.wi-erledigt', h('h2', 'Zuletzt übernommen'), h('ul', erledigt.map((e) => h('li', h('a', { href: '#/songs/' + encodeURIComponent(e.id) }, e.titel))))) : null,
      h(
        'details.wi-regeln',
        h('summary', 'Regeln für neue Word-Dokumente (damit der Import fehlerfrei arbeitet)'),
        h(
          'ol',
          h('li', 'Erste Zeile ist der Titel.'),
          h('li', 'Akkordzeile als eigener Absatz direkt über der Textzeile; Akkorde und Text nie im selben Absatz.'),
          h('li', 'Zeilen mit Akkorden und die zugehörigen Textzeilen in Courier New (gleich breite Zeichen).'),
          h('li', 'Eine Leerzeile zwischen Abschnitten.'),
          h('li', 'Optional eine Zeile „Refrain:“ oder „Strophe 2:“ als Abschnittsname.'),
          h('li', 'Markierungen: ganze Zeile mit dem gelben Textmarker.')
        ),
        h('p', 'Vorhandene Dokumente in anderer Schrift (z. B. Times New Roman) werden ebenfalls gelesen; die Akkordpositionen werden dann über die Zeichenbreiten bestimmt und sollten geprüft werden.')
      )
    )
  );
}

// ---------- Prüfansicht ----------
async function zeigePruefung(rumpf, eintrag, songs) {
  const nr = warteschlange.indexOf(eintrag) + 1;
  const weiter = () => {
    eintrag.fertig = true;
    if (!warteschlange.some((e) => !e.fertig)) warteschlange = [];
    neuZeichnen();
  };
  const kopf = (...rechts) =>
    h('div.wi-leiste', h('span.wi-datei-name', `Datei ${nr} von ${warteschlange.length}: `, h('strong', eintrag.name)), h('span.ed-luecke'), rechts);

  if (eintrag.fehler) {
    rumpf.append(
      h(
        'section.ed-mitte',
        kopf(h('button.knopf-klein', { type: 'button', onclick: weiter }, 'Weiter')),
        h('p.wi-fehler', 'Diese Datei konnte nicht gelesen werden: ', eintrag.fehler)
      )
    );
    return;
  }

  const e = eintrag.ergebnis;
  const titel = h('input', { id: 'wi-titel', type: 'text', value: e.titel, autocomplete: 'off' });
  const kurzinfo = h('input', { id: 'wi-kurzinfo', type: 'text', value: '', autocomplete: 'off', placeholder: 'z. B. Capo 2' });
  const darstellung = h(
    'fieldset.so-darstellung',
    h('legend', 'Darstellung'),
    Object.entries(DARSTELLUNG).map(([k, v]) => h('label', h('input', { type: 'radio', name: 'wi-darstellung', value: k, checked: e.darstellung === k }), h('span', v)))
  );
  const wert = () => darstellung.querySelector('input:checked')?.value || 'text';
  const textfeld = h('textarea.so-text', { spellcheck: false, 'aria-label': 'Ergebnis des Imports' });
  textfeld.value = e.inhalt;

  // Gibt es den Titel schon?
  const konflikt = h('div.wi-konflikt');
  const vorhandener = () => songs.find((s) => normalisiere(s.titel) === normalisiere(titel.value));
  const zeigeKonflikt = () => {
    const v = vorhandener();
    if (!v) return konflikt.replaceChildren();
    if (konflikt.dataset.songId === v.id) return;
    konflikt.dataset.songId = v.id;
    konflikt.replaceChildren(
      h('span', `„${v.titel}“ gibt es schon im Bestand: `),
      h('label', h('input', { type: 'radio', name: 'wi-ziel', value: 'neu', checked: true }), ' als neuen Song anlegen'),
      h('label', h('input', { type: 'radio', name: 'wi-ziel', value: 'ersetzen' }), ' vorhandenen Song ersetzen (Text und Darstellung)')
    );
  };

  const hinweise = h(
    'ul.wi-hinweise',
    e.hinweise.map((hw) =>
      h(
        'li',
        h('button.ed-mini', { type: 'button', onclick: () => waehleZeile(textfeld, hw.zeile) }, `Zeile ${hw.zeile}`),
        ' ',
        hw.text
      )
    )
  );
  const zusammenfassung = [
    e.akkordzeilen ? `${e.akkordzeilen} Akkordzeile${e.akkordzeilen === 1 ? '' : 'n'} umgewandelt` : 'keine Akkorde gefunden',
    e.markiert ? `${e.markiert} markierte Zeile${e.markiert === 1 ? '' : 'n'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const markieren = () => {
    if (markiereAuswahl(textfeld)) geaendert();
  };
  strgM(textfeld, markieren);

  const uebernehmen = async () => {
    const ziel = konflikt.querySelector('input[name=wi-ziel]:checked')?.value;
    const v = vorhandener();
    let song;
    if (v && ziel === 'ersetzen') {
      song = { ...v, darstellung: wert(), inhalt: textfeld.value };
      if (kurzinfo.value.trim()) song.kurzinfo = kurzinfo.value.trim();
    } else {
      song = { id: neueId(), titel: titel.value.trim() || 'Ohne Titel', darstellung: wert(), kurzinfo: kurzinfo.value.trim(), inhalt: textfeld.value };
    }
    await speichereSong(song);
    erledigt.push({ id: song.id, titel: song.titel });
    weiter();
  };

  const mitte = h(
    'section.ed-mitte.wi-mitte',
    kopf(
      h('button.knopf-klein', { type: 'button', onclick: weiter }, 'Überspringen'),
      h('button.knopf.wi-uebernehmen', { type: 'button', onclick: uebernehmen }, 'Als Song übernehmen')
    ),
    h(
      'div.ed-felder',
      h('div.ed-feld.breit', h('label', { for: 'wi-titel' }, 'Titel'), titel),
      h('div.ed-feld.so-kurzinfo', h('label', { for: 'wi-kurzinfo' }, 'Standard-Kurzinfo'), kurzinfo),
      darstellung
    ),
    konflikt,
    h(
      'div.so-werkzeuge',
      h('button.knopf-klein', { type: 'button', onclick: markieren, title: 'Ausgewählte Zeilen markieren bzw. Markierung entfernen (Strg+M)' }, h('span.so-marker', 'Markieren')),
      h('span.ed-luecke'),
      h('span.wi-zusammenfassung', zusammenfassung)
    ),
    textfeld,
    e.hinweise.length ? hinweise : null
  );

  const { element: vorschau, zeichne } = await songVorschau();
  rumpf.append(h('section.wi-original', h('h2', 'Original'), originalAnsicht(eintrag.dokument)), mitte, vorschau);

  let timer = null;
  const geaendert = () => {
    zeigeKonflikt();
    clearTimeout(timer);
    timer = setTimeout(() => zeichne({ titel: titel.value, kurzinfo: kurzinfo.value, darstellung: wert(), inhalt: textfeld.value }), 120);
  };
  for (const el of [titel, kurzinfo, textfeld]) el.addEventListener('input', geaendert);
  darstellung.addEventListener('change', geaendert);

  zeigeKonflikt();
  await document.fonts?.ready;
  zeichne({ titel: titel.value, kurzinfo: '', darstellung: wert(), inhalt: textfeld.value });
}

/** Zeigt das Word-Dokument annähernd wie im Original (Schrift, Größe, Textmarker, Farbe). */
function originalAnsicht(dokument) {
  const tabPx = (dokument.tabPt || 36) * (4 / 3);
  return h(
    'div.wi-seite',
    { style: { tabSize: tabPx + 'px' } },
    dokument.absaetze.map((a) =>
      h(
        'div.wi-absatz',
        a.zeilen.map((z) =>
          h(
            'div.wi-zeile',
            z.length
              ? z.map((l) =>
                  h(
                    'span',
                    {
                      style: {
                        fontFamily: `"${l.schrift}", serif`,
                        fontSize: (l.pt || 11) + 'pt',
                        fontWeight: l.fett ? '700' : '400',
                        fontStyle: l.kursiv ? 'italic' : 'normal',
                        background: l.marker ? MARKER_FARBEN[l.marker] || l.marker : '',
                        color: l.farbe || '',
                      },
                    },
                    l.text
                  )
                )
              : ' '
          )
        )
      )
    )
  );
}

function waehleZeile(feld, nr) {
  const zeilen = feld.value.split('\n');
  const start = zeilen.slice(0, nr - 1).reduce((s, z) => s + z.length + 1, 0);
  feld.focus();
  feld.setSelectionRange(start, start + (zeilen[nr - 1] || '').length);
}
