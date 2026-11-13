# Setlist-Tool – Hinweise für Claude

Sprache: Antworten, Kommentare im Code und Commit-Nachrichten auf **Deutsch**.

## Worum es geht

Ein Tool für Auftritte: Auf dem **iPad (Hochformat, offline)** zeigt es eine Setlist als Übersicht,
aus der jeder Song in seiner Darstellung geöffnet wird (nur Titel · Text · Text mit Akkorden).
Gepflegt werden Song-Bestand und Setlists **am Laptop im Browser**.

- Konzeptdokument (maßgeblich): https://claude.ai/artifact/5g15awnSUWgfXSUuypqf7u
- Entwürfe der Ansichten: https://claude.ai/artifact/ELrzrVXhgCKkMWzY1FQPAf

Weicht der Code bewusst vom Konzept ab, die Abweichung beim Nutzer ansprechen, damit das Konzept nachgeführt wird.

## Feste Regeln

- **Keine Songdaten im Repository.** Das Repository ist öffentlich. Songtexte, Akkorde und echte
  Setlists bleiben auf Laptop, iPad und NAS. Tests, Beispiele und Screenshots nur mit Platzhaltertexten
  (z. B. „[Strophe 1 – Zeile 1]“). Keine Songtexte aus dem Internet holen oder einfügen.
- **Kein Server, kein Build-Zwang:** reines HTML/CSS/JavaScript, lauffähig durch Öffnen über einen
  einfachen lokalen Webserver und auf GitHub Pages. Externe Bibliotheken nur, wenn nötig, und dann
  lokal im Repository abgelegt (offline!).
- **Offline:** Die Bühnenansicht muss ohne Internet funktionieren (Service Worker, Schrift lokal).
- **Lesbarkeit:** Schriftgrößen sind Einstellungen, keine festen Werte. Kontraste hoch halten.

## Technik-Eckpunkte

- Daten im Browserspeicher (IndexedDB); Übertragung Laptop → iPad per JSON-Export/-Import
  (Dateiendung `.setlist.json`), Transport übers NAS.
- Setlist-Syntax (eine Zeile pro Eintrag): `# Set`, `Titel`, `Titel | Kurzinfo`, `! Anmerkung`.
- Songformat: ChordPro-Akkorde `[Am]`, Abschnittszeilen `Refrain:`, markierte Zeilen (gelber Textmarker).
- Farben und Schrift (Atkinson Hyperlegible) siehe Konzeptdokument, Abschnitt „Darstellung“.

## Bauplan

1. Bühnenansicht (Übersicht, Songseite) + Setlist-Editor mit Vorschau
2. Song-Bestand mit Texteingabe
3. Word-Import (.docx)
4. iPad-Betrieb: GitHub Pages, Offline, Export/Import

Jede Stufe soll für sich nutzbar sein. Testen am Laptop im Browser mit iPad-Fenstergröße (834 × 1194).
