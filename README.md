# BZF Trainer

Eine kleine Lern-Website für den theoretischen Teil des **BZF II / BZF I** (Beschränkt gültiges Sprechfunkzeugnis für den Flugfunkdienst). Sie ist für die gemeinsame Prüfungsvorbereitung im Segelflugverein entstanden.

Die Website ist rein statisch: HTML, CSS und JavaScript, ohne Framework, ohne Build-Schritt und ohne Server-Logik.

## Funktionen

**Lernen (Karteikarten)**
- Alle 261 Fragen des offiziellen Katalogs.
- Die Antworten erscheinen in zufälliger Reihenfolge. Im Katalog ist die richtige Antwort immer A, so lernt man den Inhalt und nicht die Position.
- Nach dem Antworten sieht man sofort, ob es richtig war, und bekommt eine kurze, inoffizielle Erklärung.
- Reihenfolge: der Reihe nach oder zufällig.
- Auswahl: alle Fragen, noch nicht beantwortete oder zuletzt falsch beantwortete.
- Sprung zu einer bestimmten Fragennummer.
- Tastatur: `1`–`4` oder `A`–`D` wählt eine Antwort, `Enter` geht weiter.

**Prüfungssimulation**
- 100 zufällige Fragen, 60 Minuten. Bestanden ab 75 richtigen Antworten.
- Ergebnisse erst nach der Abgabe.
- Fragenübersicht zum Springen.
- Nach Ablauf der Zeit wird automatisch abgegeben.
- Auswertung mit allen falsch oder nicht beantworteten Fragen samt Erklärung.
- Eine laufende Prüfung übersteht auch ein Neuladen der Seite.

**Videos**
- Eine kleine Linksammlung zu YouTube: Sprechfunk-Simulationen für das BZF, Erklärvideos und ein Mitschnitt mit echtem Funkverkehr.
- Die Videos werden nur verlinkt, nicht eingebettet. Die Seite lädt also nichts von YouTube und setzt keine Cookies.
- Die Liste steht in `data/videos.json` und lässt sich dort leicht erweitern.

**Fortschritt**
Der Fortschritt wird nur lokal im Browser gespeichert (`localStorage`). Es gibt kein Konto, und es werden keine Daten übertragen. Jedes Gerät hat seinen eigenen Stand.

## Prüfungsformat

Die Simulation verwendet **100 Fragen, 60 Minuten, mindestens 75 richtig**. Diese Angaben stammen aus Sekundärquellen, die übereinstimmen:

- Wikipedia: [Sprechfunkzeugnis (Luftfahrt)](https://de.wikipedia.org/wiki/Sprechfunkzeugnis_(Luftfahrt))
- Moritz Weinig: [Die BZF-Prüfung](https://moritzweinig.com/blog/flugfunk/die-bzf-pruefung/)

In der [Verordnung über Flugfunkzeugnisse](https://www.gesetze-im-internet.de/flugfunkv_2008/) und auf der [Website der Bundesnetzagentur](https://www.bundesnetzagentur.de/Flugfunkzeugnisse) ist keine Fragenanzahl genannt.

Wer die Sprechfunkprüfung bei einer Luftfahrtbehörde ablegt (zusammen mit der Theorieprüfung für die Lizenz), bekommt unter Umständen ein anderes Format. Laut Wikipedia werden zum Beispiel beim Luftamt Südbayern nur 20 Fragen gestellt.

Die Werte lassen sich oben in `app.js` ändern (`PRUEFUNG`).

## Quellen

- **Fragen und Antworten:** Bundesnetzagentur, „Prüfungsfragen im Prüfungsteil ‚Kenntnisse‘ bei Prüfungen zum Erwerb des Beschränkt Gültigen Sprechfunkzeugnis II für den Flugfunkdienst (BZF II) und des Beschränkt Gültigen Sprechfunkzeugnis I für den Flugfunkdienst (BZF I)“, Stand 2024, gültig ab 01.05.2024.
  - [PDF](https://www.bundesnetzagentur.de/SharedDocs/Downloads/DE/Sachgebiete/Telekommunikation/Unternehmen_Institutionen/Frequenzen/Funkzeugnisse/Flugfunkzeugnisse/2024Pruefungsfragen_BZFII_BZFI_pdf.pdf?__blob=publicationFile&v=2)
  - [Übersichtsseite Flugfunkzeugnisse](https://www.bundesnetzagentur.de/Flugfunkzeugnisse)
  - Die Fragentexte sind unverändert übernommen; nur Zeilenumbrüche wurden zusammengeführt.
  - Verbindlich ist nur der von der Bundesnetzagentur herausgegebene Katalog in seiner aktuellen Fassung. Vor der Prüfung bitte dort prüfen, ob es eine neuere Version gibt.
- **Erklärungen** (`data/erklaerungen.json`): selbst erstellt, mit KI-Unterstützung. Sie sind **inoffiziell und ohne Gewähr**. Fehler bitte als Issue oder Pull Request melden.

## Lokal starten

Die Seite lädt die Fragen per `fetch`. Deshalb funktioniert ein Doppelklick auf `index.html` nicht; sie muss über einen Webserver geöffnet werden:

```bash
python -m http.server 8000
```

Dann im Browser http://localhost:8000 öffnen.

## Veröffentlichen

**GitHub Pages**
1. Repository auf GitHub pushen.
2. Unter *Settings → Pages* bei *Source* „Deploy from a branch“ wählen, Branch `main`, Ordner `/ (root)`, speichern.
3. Nach kurzer Zeit ist die Seite unter `https://<benutzername>.github.io/<repository>/` erreichbar.

**Vercel**
1. Auf vercel.com *Add New… → Project* wählen und das Repository importieren.
2. Framework Preset „Other“ wählen, Build Command und Output Directory leer lassen.
3. *Deploy*.

## Projektstruktur

```
index.html               Seite
style.css                Gestaltung (hell/dunkel automatisch)
app.js                   Lernmodus, Prüfungsmodus, Fortschritt
data/fragen.json         Fragen aus dem BNetzA-Katalog; die richtige Antwort steht immer an Position 0
data/erklaerungen.json   Inoffizielle Erklärungen, Schlüssel = Fragennummer
data/bilder/             Abbildungen aus dem Katalog (Kartensymbole zu Frage 117 und 118)
data/videos.json         Linksammlung für die Seite „Videos“
tools/parse_catalog.py   Erzeugt data/fragen.json aus dem PDF
```

## Fragenkatalog aktualisieren

Wenn die Bundesnetzagentur einen neuen Katalog veröffentlicht:

1. Das neue PDF herunterladen, z. B. nach `quelle/`. Der Ordner ist in `.gitignore` eingetragen.
2. Die Fragen neu erzeugen. Dafür wird `pdftotext` (Poppler oder xpdf) benötigt.
   ```bash
   python tools/parse_catalog.py quelle/<neuer-katalog>.pdf data/fragen.json
   ```
3. Warnungen des Skripts beachten und einige Fragen stichprobenartig mit dem PDF vergleichen.
4. Fragen mit Abbildung („abgebildetes Symbol“) prüfen: Die Bilder liegen in `data/bilder/` und werden in `tools/parse_catalog.py` (`BILDER`) den Fragennummern zugeordnet.
5. Wenn sich Fragen oder Nummern geändert haben, `data/erklaerungen.json` entsprechend anpassen.

## Lizenz

Code und Erklärungen stehen unter der MIT-Lizenz (siehe `LICENSE`). Die Fragentexte stammen von der Bundesnetzagentur; die Rechte daran liegen bei ihr.
