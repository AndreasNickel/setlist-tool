// Kleine Helfer zum Aufbau von DOM-Elementen (ohne Bibliothek).

/**
 * h('div.klasse', { attr: wert, onclick: fn }, kind1, kind2, ...)
 * Kinder dürfen Strings, Knoten, Arrays oder null sein.
 */
export function h(tag, attrs, ...kinder) {
  const [name, ...klassen] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (klassen.length) el.className = klassen.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    kinder.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  haengeAn(el, kinder);
  return el;
}

function haengeAn(el, kinder) {
  for (const k of kinder) {
    if (k == null || k === false) continue;
    if (Array.isArray(k)) haengeAn(el, k);
    else el.append(k instanceof Node ? k : String(k));
  }
}

/** Inline-SVG-Symbole (Strich-Icons). */
const PFADE = {
  weiter: 'M9 5l7 7-7 7',
  zurueck: 'M15 5l-7 7 7 7',
  haken: 'M5 12l5 5 9-10',
  zahnrad:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.7 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2L3.2 9.3l2-3.4 1.9.7a7 7 0 0 1 1.7-1l.3-2h4l.3 2a7 7 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2z',
  stift: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  start: 'M4 11l8-7 8 7M6 10v10h12V10',
};

export function icon(name, groesse = 28, label = null) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', groesse);
  svg.setAttribute('height', groesse);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', PFADE[name]);
  svg.append(p);
  return svg;
}
