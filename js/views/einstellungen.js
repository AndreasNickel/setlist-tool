// Einstellungen (gerätebezogen): Schriftgrößen und Anzeige.
import { h, icon } from '../dom.js';
import { ladeEinstellungen, speichereEinstellungen, STANDARD, GRENZEN } from '../einstellungen.js';
import { songInhalt } from './songseite.js';
import { wachHaltenMoeglich } from '../wachhalten.js';

const BEISPIEL_TEXT = 'Refrain:\n> ‹Markierte Zeile›\n‹Zeile mit normalem Text›';
const BEISPIEL_AKKORDE = '[Am]‹Zeile mit [F]Akkorden über der [C]Silbe›';

export async function zeigeEinstellungen(app) {
  const werte = { ...(await ladeEinstellungen()) };
  const zurueck = '#/';

  const vorschau = h('div.es-vorschau');
  const zeichneVorschau = () => {
    vorschau.replaceChildren(
      h('div.es-probe-titel', { style: { fontSize: werte.titelGroesse + 'px' } }, 'Titel in der Übersicht'),
      h('div.es-probe-info', { style: { fontSize: Math.round(werte.titelGroesse * 0.62) + 'px' } }, 'Kurzinfo / Anmerkung'),
      probe(BEISPIEL_TEXT, false, werte.textGroesse),
      probe(BEISPIEL_AKKORDE, true, werte.akkordTextGroesse)
    );
  };

  const regler = (schluessel, beschriftung) => {
    const [min, max] = GRENZEN[schluessel];
    const ausgabe = h('output.es-wert', werte[schluessel] + ' px');
    const id = 'es-' + schluessel;
    const eingabe = h('input', { id, type: 'range', min, max, step: 1, value: String(werte[schluessel]) });
    eingabe.addEventListener('input', () => {
      werte[schluessel] = Number(eingabe.value);
      ausgabe.textContent = werte[schluessel] + ' px';
      zeichneVorschau();
      speichereEinstellungen(werte);
    });
    return h('div.es-zeile', h('label', { for: id }, beschriftung), eingabe, ausgabe);
  };

  const kennzeichen = h('input', { id: 'es-kennzeichen', type: 'checkbox', checked: werte.kennzeichen });
  kennzeichen.addEventListener('change', () => {
    werte.kennzeichen = kennzeichen.checked;
    speichereEinstellungen(werte);
  });

  app.append(
    h(
      'div.es',
      h('header.es-kopf', h('a.knopf-icon', { href: zurueck, 'aria-label': 'Zurück' }, icon('zurueck', 28)), h('h1', 'Einstellungen'), h('span.es-hinweis', 'gilt nur für dieses Gerät')),
      h(
        'div.es-felder',
        regler('titelGroesse', 'Titel in der Übersicht'),
        regler('textGroesse', 'Songtext'),
        regler('akkordTextGroesse', 'Songtext mit Akkorden'),
        regler('mindestGroesse', 'Mindestgröße beim Verkleinern'),
        h('div.es-zeile', h('label', { for: 'es-kennzeichen' }, 'Kennzeichen „Text“/„Akkorde“ in der Übersicht'), kennzeichen),
        h(
          'button.knopf-klein',
          {
            type: 'button',
            onclick: async () => {
              await speichereEinstellungen({ ...STANDARD });
              location.reload();
            },
          },
          'Auf Startwerte zurücksetzen'
        )
      ),
      vorschau,
      h(
        'p.es-hinweis',
        wachHaltenMoeglich()
          ? 'Bildschirmsperre: Die Bühnenansicht hält das Display wach.'
          : 'Bildschirmsperre: Dieser Browser kann das Display nicht wach halten – bitte die automatische Sperre in iOS abschalten.'
      )
    )
  );
  zeichneVorschau();
}

function probe(text, mitAkkorden, px) {
  const el = h('div.sp-inhalt.es-probe', { class: mitAkkorden ? 'mit-akkorden' : '' }, songInhalt(text, mitAkkorden));
  el.style.setProperty('--text-groesse', px + 'px');
  return el;
}

