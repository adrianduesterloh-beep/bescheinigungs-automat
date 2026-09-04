# Änderungen

Die laufende Version steht in der Oberfläche unten auf jeder Seite und unter
„Einstellungen“. Wie eine neue Version eingespielt wird, steht in
`ANLEITUNG.md` unter „Eine neue Version einspielen“.

## 1.2.0 — 2026-09-04

**Installation ist jetzt ein Link.** Kein ZIP, kein Entpacken, kein
Hochladen: Der Installations-Link zeigt auf das öffentliche
Vorlagen-Verzeichnis; Cloudflare legt daraus die eigene Kopie im GitHub des
Betreibers an, richtet den Speicher ein und baut das Programm. Schritt 1 der
Anleitung ist entsprechend kürzer und beschreibt genau, was auf dem Bildschirm
zu sehen ist.

**Keine Unterordner mehr.** Alle Programmdateien liegen im
Wurzelverzeichnis. Ein Update ist damit „alle Dateien markieren und ins
Browserfenster ziehen“ — nichts kann mehr an einem falsch hochgeladenen
Ordner scheitern. Das Update-ZIP enthält absichtlich keine `wrangler.toml`
(darin steht die Speicher-Kennung, die Cloudflare bei der Installation
eingetragen hat). Wird sie doch überschrieben, bricht der Build mit einer
Meldung ab, die den Reparaturweg in vier Schritten nennt — statt eines
Cloudflare-Fehlercodes.

**Beispielwerte werden abgewiesen.** Der Installationsdialog von Cloudflare
fragt die zwei Secrets jetzt ab (Felder leer). Wer trotzdem einen der
Beispielwerte aus der Vorlage stehen lässt, bekommt „Fast fertig“ mit dem
Hinweis, dass der Wert öffentlich ist und ersetzt werden muss. Die Adresse
`….workers.dev` wird nach der Installation von selbst eingeschaltet
(`workers_dev = true`); falls nicht, steht der Klickweg in der Anleitung.

**Konto entfernen räumt bei Ablefy mit auf.** Beim Entfernen eines
Ablefy-Kontos löscht das Programm jetzt auch den Webhook, den es dort angelegt
hat, und sagt, wenn Ablefy das nicht bestätigt. Vorher blieb der Webhook
stehen und meldete ins Leere. Dazu die Anleitung „Ein Ablefy-Konto wieder
trennen“ (Anleitung und Hilfe).

**Die zwei Secrets besser erklärt.** Die Seite „Fast fertig“ (erscheint,
solange `ADMIN_PASSWORT` oder `DATEN_SCHLUESSEL` fehlt) nennt jetzt beide
Werte, wofür sie sind, was hineingehört und den genauen Klickweg im
Cloudflare-Konto. Dieselbe Tabelle steht in der Anleitung (Schritt 1) und
unter „Hilfe“.

**Kursname in der Übersicht.** Solange der ZPP-Titel noch nicht eingetragen
ist, zeigt die Übersicht den Ablefy-Produktnamen als Überschrift und darunter
„ZPP-Titel fehlt noch“ — statt „Kurs ohne Titel“ über einem sichtbaren Namen.
Gleiches im Protokoll und in Hinweisen.

## 1.1.0 — 2026-09-03

**Geführte Einrichtung.** Beim ersten Anmelden führt ein Assistent in acht
Schritten von null bis zur ersten Bescheinigung — inklusive der Schritte
außerhalb des Programms (Resend-Konto, DNS-Einträge, Ablefy-Schlüssel, Quiz
lernen). Jeder Schritt wird gegen den echten Zustand geprüft: Testmail
angekommen, Konto verbunden, Quiz gesehen, Probelauf gelungen. Unterbrechen
ist jederzeit möglich; das Programm macht beim nächsten Anmelden dort weiter.
Über „Einstellungen“ lässt sich der Assistent für weitere Kurse erneut
starten.

**Ein Absender für alle Kurse.** Unter „Mailversand“ gibt es jetzt
Absendername, Absenderadresse und Antwortadresse mit dem Haken „für alle
Kurse verwenden“. Ein einzelner Kurs kann davon abweichen (Schalter auf der
Kursseite) — wichtig, wenn Kurse für verschiedene Anbieter laufen.

**Einstellungen.** Passwort in der Oberfläche ändern. Sicherung aller
Einstellungen als Datei herunterladen und wieder einspielen — ohne
Zugangsdaten, aber mit der Liste, wer schon eine Bescheinigung bekommen hat.

**Ablefy-Konten.** Umbenennen und Schlüssel ersetzen, ohne das Konto zu
löschen. Konten ohne Zugangsdaten (nach einer Wiederherstellung) werden
deutlich markiert.

**Hilfe in der Oberfläche.** Funktionsweise, Fehlertabelle, Update-Weg,
Passwort vergessen — alles unter „Hilfe“, ohne eine Datei öffnen zu müssen.

**Abschlussquiz sicherer erkennen.** Ein Wächter merkt sich jedes Quiz, das
ein Kurs je gemeldet hat. Taucht ein neues mit demselben Lektionsnamen wie das
Abschlussquiz auf — so sieht es aus, wenn ein Quiz in Ablefy neu angelegt
wurde —, zeigt die Übersicht einen Hinweis mit „Übernehmen“, und der Betreiber
bekommt eine Mail. Vorher hätte das Programm ab diesem Moment still keine
Bescheinigungen mehr verschickt. Außerdem: mehrere Abschlussquizze je Kurs
(Bescheinigung erst, wenn alle bestanden sind), Rückfrage beim Markieren,
Anzeige „Pflicht zum Fortfahren“ aus Ablefy, Anzeige, wann das Abschlussquiz
zuletzt gemeldet wurde, und die Anleitung, wie man Drip-In im eigenen
Testzugang umgeht (Ablefy: Kunden → Kurs-Zugänge → Vollzugriff gewähren).

**Schutz vor Doppelzuordnung.** Zwei Kurse können nicht mehr auf dasselbe
Abschlussquiz zeigen.

**Texte der Oberfläche überarbeitet.** Kürzer, konkreter, mit dem Ort, wo man
etwas findet, und dem, was ein Klick auslöst. „Scharf schalten“ heißt jetzt
„Freigeben“, „Webhook“ heißt „Rückmeldung von Ablefy“. Seitenwechsel laden den
aktuellen Stand nach.

**Kleineres.** Versionsnummer unter `/health`, im Fuß jeder Seite und im
User-Agent. Mail-Adressen werden beim Speichern geprüft. Probelauf-Vorschau
bleibt beim Neuzeichnen der Seite stehen. Bei Hostinger als Versanddienst
ist keine Absenderadresse mehr Pflicht (der Absender ist dort immer das
Postfach).

## 1.0.0 — 2026-09-02

Erste Fassung. Beliebig viele Ablefy-Konten und Kurse, Webhook wird selbst
angelegt, Abschlussquiz wird gelernt, Probelauf, Testmodus, Warteschlange mit
Wiederholung, Störungsmeldungen, Doppelversand-Sperre.
