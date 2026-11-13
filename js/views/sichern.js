// Sichern & Übertragen: Export/Import der Daten, Offline-Status, Installation, Updates.
// Läuft am Laptop wie am iPad (einspaltig).
import { h } from '../dom.js';
import { alleSongs, alleSetlists } from '../db.js';
import {
  erstelleExport, exportDatei, gibDateiAus, pruefeImport, fuehreImportAus, letzteAenderung, merkeAustausch, ladeAustausch,
} from '../austausch.js';
import { beobachte, fordereStandAn, pruefeUpdate, speicherDauerhaft, istInstalliert } from '../offline.js';
import { pflegeKopf } from './pflege-kopf.js';

const zeit = (iso) => {
  if (!iso) return '–';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export async function zeigeSichern(app) {
  const [songs, setlists, austausch] = await Promise.all([alleSongs(), alleSetlists(), ladeAustausch()]);
  const istIpad = navigator.maxTouchPoints > 1;

  // ---------- Exportieren ----------
  const exportMeldung = h('p.si-meldung', { role: 'status' });
  const letzterExport = h('p.si-klein', 'Letzter Export auf diesem Gerät: ', zeit(austausch.letzterExport));
  const exportieren = async (teilen) => {
    exportMeldung.textContent = '';
    try {
      const daten = await erstelleExport();
      const art = await gibDateiAus(exportDatei(daten), { teilen });
      await merkeAustausch({ letzterExport: daten.exportiert });
      letzterExport.replaceChildren('Letzter Export auf diesem Gerät: ', zeit(daten.exportiert));
      speicherDauerhaft();
      exportMeldung.textContent = art === 'geteilt' ? 'Datei übergeben.' : `Datei „${exportDatei(daten).name}“ gespeichert (Download-Ordner).`;
    } catch (e) {
      if (e?.name !== 'AbortError') exportMeldung.textContent = 'Export fehlgeschlagen: ' + (e?.message || e);
    }
  };
  const kannTeilen = (() => {
    try {
      return !!navigator.canShare?.({ files: [new File(['{}'], 'x.setlist.json', { type: 'application/json' })] });
    } catch {
      return false;
    }
  })();

  const exportBereich = h(
    'section.si-block',
    h('h2', 'Exportieren'),
    h('p', `Alle Songs (${songs.length}) und Setlists (${setlists.length}) als eine Datei speichern. Die Datei ist zugleich die Sicherung.`),
    h(
      'div.si-knoepfe',
      h('button.knopf', { type: 'button', onclick: () => exportieren(false) }, 'Exportieren'),
      kannTeilen ? h('button.knopf-klein', { type: 'button', onclick: () => exportieren(true) }, istIpad ? 'Teilen / In Dateien sichern …' : 'Teilen …') : null
    ),
    exportMeldung,
    letzterExport,
    h(
      'p.si-klein',
      'Übertragung: Datei auf dem NAS (SMB-Freigabe) oder in einer Cloud ablegen, die in der Dateien-App des iPads erscheint (OneDrive, Google Drive, Dropbox, Nextcloud) – oder per USB-Stick.'
    )
  );

  // ---------- Importieren ----------
  const dateiWahl = h('input', { type: 'file', id: 'si-datei', class: 'wi-datei', accept: '.json,application/json' });
  const importErgebnis = h('div.si-import');
  const importMeldung = h('p.si-meldung', { role: 'status' });
  dateiWahl.addEventListener('change', async () => {
    const datei = dateiWahl.files[0];
    importErgebnis.replaceChildren();
    importMeldung.textContent = '';
    if (!datei) return;
    let daten;
    try {
      daten = pruefeImport(await datei.text());
    } catch (e) {
      importMeldung.textContent = e.message;
      dateiWahl.value = '';
      return;
    }
    const lokal = await letzteAenderung();
    const neuer = lokal && daten.exportiert && lokal > daten.exportiert;
    importErgebnis.append(
      h(
        'div.si-karte',
        h('p', h('strong', datei.name)),
        h('p', `Stand: ${zeit(daten.exportiert)} · ${daten.songs.length} Songs · ${daten.setlists.length} Setlists`),
        h('p.si-warnung', 'Der Import ersetzt alle Songs und Setlists auf diesem Gerät.'),
        neuer ? h('p.si-warnung', `Achtung: Auf diesem Gerät gibt es neuere Änderungen (${zeit(lokal)}) als in der Datei. Diese gehen verloren.`) : null,
        h(
          'div.si-knoepfe',
          h(
            'button.knopf',
            {
              type: 'button',
              onclick: async (e) => {
                e.target.disabled = true;
                try {
                  await fuehreImportAus(daten, datei.name);
                  speicherDauerhaft();
                  importErgebnis.replaceChildren();
                  importMeldung.textContent = `Importiert: ${daten.songs.length} Songs, ${daten.setlists.length} Setlists.`;
                  setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 1200);
                } catch (err) {
                  e.target.disabled = false;
                  importMeldung.textContent = 'Import fehlgeschlagen, der bisherige Stand ist unverändert: ' + (err?.message || err);
                }
              },
            },
            'Importieren'
          ),
          h('button.knopf-klein', { type: 'button', onclick: () => { importErgebnis.replaceChildren(); dateiWahl.value = ''; } }, 'Abbrechen')
        )
      )
    );
  });

  const importBereich = h(
    'section.si-block',
    h('h2', 'Importieren'),
    h('p', 'Eine Exportdatei einlesen, z. B. vom NAS über die Dateien-App. Danach entspricht dieses Gerät genau dem Stand der Datei.'),
    dateiWahl,
    h('label.knopf.si-datei-knopf', { for: 'si-datei' }, 'Exportdatei wählen …'),
    importMeldung,
    importErgebnis,
    h('p.si-klein', 'Letzter Import: ', zeit(austausch.letzterImport), austausch.importDatei ? ` (${austausch.importDatei}, Stand ${zeit(austausch.importStand)})` : '')
  );

  // ---------- Offline & App ----------
  const offlineZeile = h('p');
  const standZeile = h('p.si-klein');
  const updateZeile = h('div');
  const speicherZeile = h('p.si-klein');
  const stopp = beobachte((s) => {
    offlineZeile.textContent = !s.unterstuetzt
      ? 'Dieser Browser unterstützt keinen Offline-Betrieb.'
      : s.bereit
        ? 'Offline bereit: Die App startet auch ohne Internet.'
        : s.fehler
          ? 'Offline-Betrieb nicht verfügbar: ' + s.fehler
          : 'Offline-Betrieb wird eingerichtet …';
    standZeile.textContent = s.aktiv ? `App-Stand: geladen am ${zeit(s.aktiv)}` : '';
    updateZeile.replaceChildren(
      s.update
        ? h(
            'p.si-update',
            'Eine neue Version ist geladen und wird beim nächsten Start übernommen. ',
            h('button.knopf-klein', { type: 'button', onclick: () => location.reload() }, 'Jetzt neu starten')
          )
        : s.bereit
          ? h('p.si-klein', h('button.knopf-klein', { type: 'button', onclick: () => { pruefeUpdate(); setTimeout(fordereStandAn, 4000); } }, 'Nach neuer Version suchen'))
          : null
    );
  });
  fordereStandAn();
  speicherDauerhaft().then((ok) => {
    speicherZeile.textContent =
      ok === true
        ? 'Speicher: dauerhaft – der Browser löscht die Daten nicht von sich aus.'
        : 'Speicher: nicht dauerhaft gesichert – regelmäßig exportieren; die Exportdatei ist die eigentliche Sicherung.';
  });

  const appBereich = h(
    'section.si-block',
    h('h2', 'Offline und App'),
    offlineZeile,
    standZeile,
    updateZeile,
    speicherZeile,
    istInstalliert()
      ? h('p.si-klein', 'Läuft als App vom Home-Bildschirm.')
      : h(
          'div.si-karte',
          h('p', h('strong', 'Auf dem iPad als App installieren:')),
          h('ol', h('li', 'Diese Seite in Safari öffnen.'), h('li', 'Teilen-Symbol antippen → „Zum Home-Bildschirm“.'), h('li', 'Die App vom Home-Bildschirm starten und dort die Exportdatei importieren.')),
          h('p.si-klein', 'Wichtig: Die App auf dem Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari. Daten, die in Safari importiert wurden, müssen dort noch einmal importiert werden.')
        )
  );

  app.append(h('div.si-seite', pflegeKopf('sichern'), h('div.si', h('h1', 'Sichern & Übertragen'), exportBereich, importBereich, appBereich)));
  return stopp;
}
