// Datenhaltung im Browserspeicher (IndexedDB).
//   songs:         { id, titel, darstellung: 'titel'|'text'|'akkorde', kurzinfo, inhalt, geaendert }
//   setlists:      { id, name, datum, ort, eintraege: [...], wahl: { normTitel: songId }, geaendert }
//   einstellungen: Schlüssel/Wert, gerätebezogen
//   gespielt:      { setlistId, ids: [Eintragsnummern] } – nur Auftrittszustand, kein Teil der Setlist

const DB_NAME = 'setlist-tool';
const DB_VERSION = 1;

let dbPromise = null;

function oeffne() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('setlists')) db.createObjectStore('setlists', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('einstellungen')) db.createObjectStore('einstellungen');
      if (!db.objectStoreNames.contains('gespielt')) db.createObjectStore('gespielt', { keyPath: 'setlistId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function anfrage(store, modus, fn) {
  return oeffne().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, modus);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const alle = (store) => anfrage(store, 'readonly', (s) => s.getAll());
export const hole = (store, key) => anfrage(store, 'readonly', (s) => s.get(key));
export const speichere = (store, wert, key) => anfrage(store, 'readwrite', (s) => (key === undefined ? s.put(wert) : s.put(wert, key)));
export const loesche = (store, key) => anfrage(store, 'readwrite', (s) => s.delete(key));

export function neueId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---- bequeme Zugriffe ----

export const alleSongs = () => alle('songs');
export const alleSetlists = async () =>
  (await alle('setlists')).sort((a, b) => String(b.datum || '').localeCompare(String(a.datum || '')) || a.name.localeCompare(b.name));

export async function speichereSong(song) {
  song.geaendert = new Date().toISOString();
  await speichere('songs', song);
  return song;
}

export async function speichereSetlist(setlist) {
  setlist.geaendert = new Date().toISOString();
  await speichere('setlists', setlist);
  return setlist;
}

/** Ersetzt Songs und Setlists vollständig – in EINER Transaktion, also ganz oder gar nicht. */
export async function ersetzeAlles(songs, setlists) {
  const db = await oeffne();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['songs', 'setlists'], 'readwrite');
    const s = tx.objectStore('songs');
    const l = tx.objectStore('setlists');
    s.clear();
    l.clear();
    for (const song of songs) s.put(song);
    for (const setlist of setlists) l.put(setlist);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Import abgebrochen'));
  });
}

export async function gespielt(setlistId) {
  const eintrag = await hole('gespielt', setlistId);
  return new Set(eintrag?.ids ?? []);
}

export async function setzeGespielt(setlistId, ids) {
  await speichere('gespielt', { setlistId, ids: [...ids] });
}
