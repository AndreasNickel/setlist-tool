// Verkleinerte Vorschau der Songseite im iPad-Format (Song-Bestand und Word-Import).
import { h } from '../dom.js';
import { darstellungVon } from '../setlist-modell.js';
import { ladeEinstellungen } from '../einstellungen.js';
import { songInhalt, passeEin } from './songseite.js';

/** Ergebnis: { element, zeichne({ titel, kurzinfo, darstellung, inhalt }) } – zeichne erst nach dem Einhängen aufrufen. */
export async function songVorschau(ueberschrift = 'Vorschau iPad') {
  const einst = await ladeEinstellungen();
  const vTitel = h('span.sp-titel');
  const vInfo = h('span.sp-info');
  const vInhalt = h('div.sp-inhalt');
  const passung = h('p.ed-klein.so-passung');
  const element = h(
    'aside.ed-rechts',
    h('h2', ueberschrift),
    h(
      'div.ed-ipad',
      h(
        'div.ed-ipad-bild',
        h(
          'div.sp',
          h('div.sp-kopf', h('span.sp-kopf-text', vTitel, vInfo), h('span.sp-position', '1 / 1')),
          vInhalt,
          h('footer.sp-fuss', h('span'), h('span.sp-fuss-label', 'Vorschau'))
        )
      )
    ),
    passung
  );

  const zeichne = (song) => {
    const d = darstellungVon(song);
    const titel = song.titel || 'Ohne Titel';
    vTitel.textContent = titel;
    vInfo.textContent = song.kurzinfo || '';
    vInfo.hidden = !song.kurzinfo;
    vInhalt.className = 'sp-inhalt' + (d === 'akkorde' ? ' mit-akkorden' : '');
    if (d === 'titel') {
      vInhalt.classList.add('nur-titel');
      vInhalt.replaceChildren(h('p.sp-nur-titel', titel));
      vInhalt.style.removeProperty('--text-groesse');
      passung.textContent = 'In der Übersicht nicht zu öffnen; erscheint nur beim Wischen als Titelseite.';
      return;
    }
    vInhalt.replaceChildren(songInhalt(song.inhalt, d === 'akkorde'));
    const groesse = d === 'akkorde' ? einst.akkordTextGroesse : einst.textGroesse;
    const r = passeEin(vInhalt, groesse, Math.min(einst.mindestGroesse, groesse));
    passung.textContent = r.scrollen
      ? `Passt nicht auf eine Seite – wird auf der Bühne gescrollt (${r.px} px).`
      : `Passt auf eine Seite: ${r.px} px${r.px < groesse ? ` (verkleinert von ${groesse} px)` : ''}${r.spalten === 2 ? ', zweispaltig' : ''}.`;
  };

  return { element, zeichne };
}
