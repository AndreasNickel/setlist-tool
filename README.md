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
- `http://localhost:8000/#/songs` – Song-Bestand (Laptop)
- `http://localhost:8000/#/import` – Word-Import (Laptop)
- `http://localhost:8000/tests/` – Tests der Logik

Zum Ausprobieren gibt es auf der leeren Startseite „Beispieldaten laden“ (nur Platzhaltertexte).
Testen am Laptop mit iPad-Fenstergröße 834 × 1194 (Entwicklerwerkzeuge → Gerätesymbolleiste).

## Stand

- **Stufe 1:** Bühnenansicht (Übersicht, Songseite mit Text/Akkorden/Markierungen, Wischen,
  „gespielt“), Setlist-Editor mit Live-Vorschau, Einstellungen für Schriftgrößen.
- **Stufe 2:** Song-Bestand mit Suche und Filter, Texteingabe mit Akkorden (`[Am]`), Abschnitten
  (`Refrain:`) und Markierungen (`> `, Knopf „Markieren“ bzw. Strg+M), Umwandlung
  „Akkordzeile über Textzeile“ beim Einfügen, Vorschau der Songseite.

- **Stufe 3:** Word-Import (.docx, direkt im Browser, ohne Upload): Titel, Abschnitte,
  Akkordzeilen über Text (Position über die Zeichenbreiten der Originalschrift, auch bei
  Proportionalschrift), Textmarker/Schriftfarbe als Markierung; Prüfansicht Original | Ergebnis | Vorschau.

Offline/Export (Stufe 4) folgt.

Veröffentlicht: https://andreasnickel.github.io/setlist-tool/

Schrift: Atkinson Hyperlegible (SIL Open Font License, siehe `fonts/OFL.txt`).
