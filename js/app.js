// Einstieg und Navigation (Hash-Routen, damit es auf GitHub Pages ohne Server-Regeln läuft).
//   #/                     Start: Setlists wählen
//   #/buehne/<id>          Übersicht einer Setlist (Bühne)
//   #/buehne/<id>/<nr>     Songseite (nr = Eintragsnummer in der Setlist)
//   #/editor[/<id>]        Setlist-Editor (Laptop)
//   #/songs[/<id>]         Song-Bestand (Laptop)
//   #/import               Word-Import (Laptop)
//   #/einstellungen        Schriftgrößen usw.
import { ladeEinstellungen } from './einstellungen.js';
import { zeigeStart } from './views/start.js';
import { zeigeUebersicht } from './views/uebersicht.js';
import { zeigeSongseite } from './views/songseite.js';
import { zeigeEditor } from './views/editor.js';
import { zeigeSongs } from './views/songs.js';
import { zeigeImport } from './views/import.js';
import { zeigeEinstellungen } from './views/einstellungen.js';
import { wachHalten } from './wachhalten.js';

const app = document.getElementById('app');
let aufraeumen = null;

async function navigiere() {
  const teile = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (typeof aufraeumen === 'function') aufraeumen();
  aufraeumen = null;
  app.replaceChildren();
  document.body.className = '';

  const [bereich, a, b] = teile;
  try {
    if (bereich === 'buehne' && a && b !== undefined) {
      document.body.className = 'buehne';
      wachHalten(true);
      aufraeumen = await zeigeSongseite(app, a, Number(b));
    } else if (bereich === 'buehne' && a) {
      document.body.className = 'buehne';
      wachHalten(true);
      aufraeumen = await zeigeUebersicht(app, a);
    } else if (bereich === 'editor') {
      document.body.className = 'pflege';
      wachHalten(false);
      aufraeumen = await zeigeEditor(app, a);
    } else if (bereich === 'songs') {
      document.body.className = 'pflege';
      wachHalten(false);
      aufraeumen = await zeigeSongs(app, a);
    } else if (bereich === 'import') {
      document.body.className = 'pflege';
      wachHalten(false);
      aufraeumen = await zeigeImport(app);
    } else if (bereich === 'einstellungen') {
      document.body.className = 'buehne';
      wachHalten(false);
      aufraeumen = await zeigeEinstellungen(app);
    } else {
      document.body.className = 'buehne';
      wachHalten(false);
      aufraeumen = await zeigeStart(app);
    }
  } catch (err) {
    console.error(err);
    app.replaceChildren();
    const p = document.createElement('p');
    p.className = 'fehler';
    p.textContent = 'Fehler: ' + (err?.message || err);
    app.append(p);
  }
}

await ladeEinstellungen();
window.addEventListener('hashchange', navigiere);
navigiere();
