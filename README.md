[![Zu Cloudflare installieren](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/adrianduesterloh-beep/bescheinigungs-automat)

# Fang hier an

Dieses Programm füllt nach bestandenem Abschlussquiz automatisch die
GKV-Teilnahmebescheinigung aus und verschickt sie an die teilnehmende Person.
Für Erwachsenenkurse, die bei Ablefy laufen.

Du brauchst keine Programmierkenntnisse und kein Terminal. Nach der Einrichtung
läuft alles über eine Weboberfläche.

## Was zu tun ist

| | Schritt | Dauer |
|---|---|---|
| 1 | Programm installieren — ein Link, zwei kostenlose Konten (GitHub, Cloudflare) | 10 Min |
| 2 | Mailversand einrichten | 20 Min + Wartezeit auf DNS |
| 3 | Ablefy-Konto verbinden | 5 Min |
| 4 | Kurs anlegen | 10 Min je Kurs |
| 5 | Probelauf | 15 Min |
| 6 | Freigeben | 2 Min |

**Nach Schritt 1 hast du eine Internetadresse** (endet auf `.workers.dev`).
Das ist dein Programm — im Browser öffnen, mit deinem Passwort anmelden,
Lesezeichen setzen. Beim ersten Anmelden startet ein Assistent, der dich
durch die Schritte 2 bis 6 führt und jeden prüft, bevor es weitergeht. `ANLEITUNG.md` ist das Nachschlagewerk dazu — dort
steht jeder Schritt ausführlich, falls du im Assistenten irgendwo hängst.

**Also: `ANLEITUNG.md` öffnen, Schritt 1 machen, anmelden, dem Assistenten
folgen.** Du musst nichts herunterladen und nichts hochladen — die
Installation ist ein Link, der in der Anleitung steht.

## Was du bereitlegen solltest

Für jeden Kurs die Angaben aus dem ZPP-Anbieterportal, und zwar vom
eingetragenen **Kurs**, nicht vom Konzept: Titel der Maßnahme im exakten
Wortlaut, Kurs-ID, Präventionsprinzip, Anbietername, Anschrift. Dazu eine
Unterschrift als freigestelltes PNG.

## Was das Programm kann

- beliebig viele Ablefy-Konten, je Konto beliebig viele Kurse
- je Kurs eigene Kurs-ID, eigener Titel, eigene Anbieterangaben, eigene
  Unterschrift, eigene Absender- und Antwortadresse
- die Rückmeldung bei Ablefy (den Webhook) richtet es beim Verbinden selbst ein
- das Abschlussquiz zeigst du ihm einmal, statt Kennungen zu suchen — und ein Wächter meldet sich, wenn es in Ablefy neu angelegt wurde
- Testmodus und Probelauf, bevor etwas an echte Teilnehmer geht
- wiederholt von allein, was an einer vorübergehenden Störung gescheitert ist
- meldet sich bei dir, wenn eine Bescheinigung endgültig nicht rausgeht
- ein Absender für alle Kurse, einzelne Kurse können abweichen
- Passwort ändern, Sicherung herunterladen und einspielen, Hilfe direkt in
  der Oberfläche

## Was es bewusst nicht tut

Es prüft nicht, ob dein ZPP-Zertifikat noch gültig ist. Es verwaltet keine
Erstattungen und keine Prämien. Es rät nie: fehlt eine Angabe, wird nichts
verschickt und du bekommst eine Meldung im Klartext. Eine falsche
Bescheinigung wäre schlimmer als eine späte.

## Was hier liegt

| Datei | Wofür |
|---|---|
| `ANLEITUNG.md` | die Schritt-für-Schritt-Anleitung. Dein Hauptdokument |
| `MAILVERSAND-EINRICHTEN.md` | der Mailversand ganz ausführlich, Klick für Klick |
| `TECHNIK.md` | für den Fall, dass mal jemand technisch nachsehen muss |
| `CHANGELOG.md` | was sich von Version zu Version geändert hat |
| `beispiel/` | eine echte Beispiel-Bescheinigung als PDF |
| die Dateien `.js`, `admin.html`, `formular.pdf`, `wrangler.toml`, `package.json` | das Programm selbst. Musst du nie anfassen |
| `werkzeuge/` | nur für Techniker: Testumgebung ohne echte Konten |
