// Offline-Betrieb: Service Worker anmelden, nach dem Start auf neue Versionen prüfen,
// Speicher dauerhaft anfordern. Neue Versionen greifen erst beim nächsten Start (siehe sw.js).

const zuhoerer = new Set();
export const status = { unterstuetzt: 'serviceWorker' in navigator, bereit: false, update: false, fehler: '', aktiv: null, wartend: null };

function melde() {
  for (const fn of zuhoerer) fn(status);
}
export function beobachte(fn) {
  zuhoerer.add(fn);
  fn(status);
  return () => zuhoerer.delete(fn);
}

function sende(nachricht) {
  const sw = navigator.serviceWorker.controller;
  if (sw) sw.postMessage(nachricht);
}

export function fordereStandAn() {
  if (status.unterstuetzt) sende({ art: 'stand' });
}

export function pruefeUpdate() {
  if (status.unterstuetzt && navigator.onLine) sende({ art: 'pruefen' });
}

export async function starteOffline() {
  if (!status.unterstuetzt) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    const d = e.data || {};
    if (d.art === 'update-bereit') status.update = true;
    if (d.art === 'pruefung-fehlgeschlagen') status.fehler = d.text;
    if (d.art === 'stand') {
      status.aktiv = d.aktiv;
      status.wartend = d.wartend;
      status.update = !!d.wartend;
    }
    melde();
  });
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    status.bereit = true;
    melde();
  } catch (e) {
    status.fehler = String(e?.message || e);
    melde();
    return;
  }
  // Beim ersten Besuch steuert der neue Service Worker die Seite erst nach clients.claim()
  if (!navigator.serviceWorker.controller) {
    await new Promise((fertig) => navigator.serviceWorker.addEventListener('controllerchange', fertig, { once: true }));
  }
  fordereStandAn();
  // Nach dem Start in Ruhe nach einer neuen Version sehen (lädt nur in den Hintergrund-Speicher)
  setTimeout(pruefeUpdate, 3000);
}

/** Bittet den Browser, die Daten nicht bei Speichermangel zu löschen. */
export async function speicherDauerhaft() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export const istInstalliert = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
