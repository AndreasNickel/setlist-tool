# Setlist-Tool

Setlist- und Songtext-Anzeige für Auftritte – auf dem iPad, offline.

- **Bühne (iPad, Hochformat):** Übersicht der Setlist mit Sets, Ansagen und „gespielt“-Markierung;
  ein Tippen öffnet den Song als Text oder mit Akkorden, in großer, gut lesbarer Schrift.
- **Pflege (Laptop):** Song-Bestand und Setlists im Browser; Setlists werden als einfache Textliste geschrieben.
- **Übertragung:** Export als Datei, Import auf dem iPad (z. B. über ein NAS).

Das Repository enthält nur das Tool. Songtexte und Setlists bleiben lokal beim Nutzer.

## Starten

Kein Build nötig. Im Projektordner einen einfachen Webserver starten, z. B.

```
python -m http.server 8000
```

und im Browser öffnen:

- `http://localhost:8000/` – Bühne (Setlist wählen, Übersicht, Songseiten)
- `http://localhost:8000/#/editor` – Setlists bearbeiten (Laptop)
- `http://localhost:8000/tests/` – Tests der Logik

Zum Ausprobieren gibt es auf der leeren Startseite „Beispieldaten laden“ (nur Platzhaltertexte).
Testen am Laptop mit iPad-Fenstergröße 834 × 1194 (Entwicklerwerkzeuge → Gerätesymbolleiste).

## Stand

Stufe 1: Bühnenansicht (Übersicht, Songseite mit Text/Akkorden/Markierungen, Wischen,
„gespielt“), Setlist-Editor mit Live-Vorschau, Einstellungen für Schriftgrößen.
Song-Bestand (Stufe 2), Word-Import (Stufe 3) und Offline/Export (Stufe 4) folgen.

Schrift: Atkinson Hyperlegible (SIL Open Font License, siehe `fonts/OFL.txt`).
