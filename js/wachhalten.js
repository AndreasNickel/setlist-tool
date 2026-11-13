// Verhindert den Ruhezustand des iPads während der Bühnenansicht (Screen Wake Lock API).
// Wo die API fehlt, bleibt nur: automatische Sperre in iOS abschalten (siehe Konzept).

let sperre = null;
let gewuenscht = false;

async function anfordern() {
  if (!gewuenscht || sperre || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sperre = await navigator.wakeLock.request('screen');
    sperre.addEventListener('release', () => (sperre = null));
  } catch {
    sperre = null; // z. B. Energiesparmodus – kein Fehler für den Nutzer
  }
}

export function wachHalten(an) {
  gewuenscht = an;
  if (an) anfordern();
  else if (sperre) {
    sperre.release().catch(() => {});
    sperre = null;
  }
}

export const wachHaltenMoeglich = () => 'wakeLock' in navigator;

document.addEventListener('visibilitychange', anfordern);
// Manche Browser erlauben die Sperre erst nach einer Berührung – dann beim nächsten Tippen erneut versuchen.
document.addEventListener('pointerdown', anfordern, { passive: true });
