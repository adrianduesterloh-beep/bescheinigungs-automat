# Anleitung

So richtest du das Programm ein, das nach bestandenem Abschlussquiz automatisch
die Teilnahmebescheinigung ausfüllt und verschickt.

Du brauchst dafür keine Programmierkenntnisse und kein Terminal. Alles läuft
über eine Weboberfläche.

**Das Programm führt dich selbst.** Nach dem ersten Anmelden startet ein
Assistent, der dich Schritt für Schritt durch alles Folgende leitet — auch
durch die Teile, die außerhalb des Programms passieren (Resend, DNS, Ablefy).
Jeder Schritt wird geprüft, bevor es weitergeht. Du kannst jederzeit
unterbrechen; beim nächsten Anmelden geht es dort weiter, wo du warst.

Diese Anleitung ist das Nachschlagewerk dazu: Wenn du im Assistenten bei einem
Schritt hängst, steht er hier ausführlicher.

**Ein Begriff vorweg.** „Die Oberfläche" ist die Webseite deines Programms —
die Internetadresse, die du am Ende von Schritt 1 bekommst (endet auf
`.workers.dev`). Dort meldest du dich mit deinem Passwort an. Alles, was
diese Anleitung ab Schritt 2 beschreibt, passiert auf dieser einen Seite.

**Zeit:** knapp eine Stunde für die erste Installation, danach etwa zwanzig
Minuten je weiterem Kurs.

---

## Vorher bereitlegen

Für **jeden Kurs**, den du einrichten willst, brauchst du diese sechs Angaben.
Sie stehen im ZPP-Anbieterportal beim eingetragenen **Kurs** — nicht beim
Konzept.

| Angabe | Beispiel |
|---|---|
| Titel der Maßnahme, wortgleich | Onlinekurs – Stressbewältigung im Alltag |
| ZPP-Kurs-ID | KU-ST-… |
| Präventionsprinzip | Förderung von Entspannung und Erholung |
| Name des Anbieters | Praxis Sonnenweg, Inhaberin Maria Beispiel |
| Anschrift | Musterstraße 12, 12345 Musterstadt |
| Unterschrift | freigestelltes PNG oder der Name der zeichnungsberechtigten Person |

> **Achtung, häufigster Fehler.** Auf die Bescheinigung gehört die **Kurs-ID**,
> nicht die Konzept-ID. Ein zertifiziertes Konzept allein ist nicht
> erstattungsfähig — nur ein Kurs auf Basis des Konzepts, und erst der bekommt
> die Kennung, über die die Krankenkasse zuordnet. Auf dem Formular heißt
> dasselbe Feld übrigens „Angebots-ID". Zwei Namen, ein Wert.

Kopiere Titel und Kennung aus dem Portal, statt sie abzutippen. Die Kasse
gleicht beides ab.

---

## Schritt 1 — Das Programm installieren

Etwa zehn Minuten. Nur einmal. Du lädst nichts hoch und packst nichts aus —
die Installation ist ein Link.

Du brauchst zwei kostenlose Konten: eines bei **GitHub** (dort legt
Cloudflare deine private Kopie des Programms ab) und eines bei
**Cloudflare** (dort läuft es). Beide sieht kein Kunde jemals.

### 1a. Konten anlegen

1. **github.com** → *Sign up*. E-Mail bestätigen. Mehr musst du bei GitHub
   für die Installation nicht tun — kein Hochladen, keine Einstellungen.
   (Erst bei einem späteren Update ziehst du dort einmal Dateien hinein.)
2. **cloudflare.com** → *Sign up*. E-Mail bestätigen. Der kostenlose Tarif
   reicht; eine Kreditkarte wird nicht verlangt.

### 1b. Den Installations-Link klicken

```
https://deploy.workers.cloudflare.com/?url=https://github.com/adrianduesterloh-beep/bescheinigungs-automat
```

1. Den Link im Browser öffnen. Falls Cloudflare nach Anmeldung fragt:
   anmelden — landest du danach nicht wieder auf der Installationsseite,
   den Link noch einmal aufrufen.
2. **Connect GitHub** bzw. **Authorize** — damit darf Cloudflare die Kopie in
   deinem GitHub anlegen. Der Haken *Create private Git repository* darf
   gesetzt bleiben.
3. Die Seite „Create an app": **Project name** so lassen (Cloudflare hängt
   ein `-copy` an, das ist richtig so), **Select KV namespace** auf
   *Create new* lassen, den vorgeschlagenen Namen darunter auch.
4. Darunter stehen zwei leere Felder **`ADMIN_PASSWORT`** und
   **`DATEN_SCHLUESSEL`**. Dort deine eigenen Werte eintragen — was
   hineingehört, steht in der Tabelle unter 1c (kurz: ein Passwort deiner
   Wahl; ein langes ausgedachtes Wort, das du nie wieder änderst). Beide
   Werte sofort in den Passwortmanager. **Stehen in einem Feld schon
   Punkte, ist das ein Beispielwert, der öffentlich ist — Feld leeren und
   eigenen Wert eintippen.** Fehlen die Felder ganz, ist das kein Fehler —
   dann trägst du die Werte in 1c ein.
5. Unten rechts **Deploy** klicken. Cloudflare legt jetzt
   Kopie und Speicher an und baut das Programm — ein bis zwei Minuten.
   Fertig ist es, wenn ein grüner Haken erscheint und eine Adresse, die auf
   `.workers.dev` endet.

### 1c. Die zwei Geheimnisse eintragen

Das Programm braucht zwei Werte, die nur in deinem Cloudflare-Konto liegen
und nirgendwo sonst. Cloudflare nennt so etwas **Secret**. Solange eines
fehlt, zeigt dein Programm statt der Anmeldung eine Seite mit der Überschrift
**„Fast fertig"** und dem Namen des fehlenden Werts.

| Name (genau so schreiben) | Wozu | Was du einträgst |
|---|---|---|
| `ADMIN_PASSWORT` | Damit meldest du dich in der Oberfläche an. | Ein Passwort deiner Wahl. Merk es dir. |
| `DATEN_SCHLUESSEL` | Damit verschlüsselt das Programm deine Ablefy-Schlüssel und den Mail-Token, bevor es sie speichert. | Ein langes, ausgedachtes Wort, mindestens 30 Zeichen, z. B. `Regenschirm-Kaktus-Fahrrad-Lampe-2026-Sommer`. **Einmal setzen, nie wieder ändern** — sonst kann das Programm die gespeicherten Zugangsdaten nicht mehr lesen und du musst alle neu eintragen. |

Die Namen müssen exakt so lauten: Großbuchstaben, ein Unterstrich,
`SCHLUESSEL` mit `UE`, kein Umlaut. Ein anderer Name wird nicht erkannt.

Hat Cloudflare die beiden Werte schon in 1b abgefragt, ist dieser Schritt
erledigt — weiter mit 1d. Sonst so:

1. Bei Cloudflare links **Workers & Pages** → dein Programm anklicken
   (`bescheinigungs-automat-copy`).
2. Oben den Reiter **Settings**. Der Abschnitt **„Variables and Secrets"**
   steht **ganz oben** auf dieser Seite, direkt unter dem Reiter. Dann
   **+ Add**.

   > **Falle:** Weit unten auf derselben Seite gibt es unter **„Builds"**
   > (bei *Branch control*, *Build watch paths*, *Deploy Hooks*) noch einmal
   > eine Liste „Variables and secrets". Die ist es **nicht** — was dort
   > steht, sieht das Programm nie. Du erkennst die falsche am Text „No build
   > variables or secrets configured". Also: nicht scrollen, der richtige
   > Abschnitt ist der erste.
3. Bei **Type** auf **Secret** stellen (nicht „Text" oder „Variable" — das
   wäre im Konto für jeden im Klartext sichtbar).
   **Variable name:** `ADMIN_PASSWORT` — **Value:** dein Passwort.
4. Noch einmal **Add**, wieder Type **Secret**.
   **Variable name:** `DATEN_SCHLUESSEL` — **Value:** dein langes Wort.
5. Auf **Save** (in manchen Versionen **Deploy**) klicken.
6. **Prüfen, ob die Werte auch aktiv sind.** Reiter **Overview** → Kasten
   **Versions**: Der blaue Balken links markiert die Version, die läuft. Steht
   er auf dem obersten Eintrag „Add secret: …", ist alles gut. Steht er
   weiter unten, hat Cloudflare die Werte nur gespeichert, aber nicht
   eingeschaltet: Reiter **Deployments** → in der obersten Zeile der
   *Version History* ganz rechts auf die **drei Punkte (…)** → **Promote
   version**. Danach steht oben unter *Active deployment* die neue Nummer.

Beide Werte in einen Passwortmanager legen. Cloudflare zeigt ein Secret nach
dem Speichern nie wieder an — man kann es nur durch ein neues ersetzen. Beim
Passwort ist das egal (unten unter „Passwort vergessen" steht der Weg), beim
`DATEN_SCHLUESSEL` nicht.

### 1d. Die Oberfläche öffnen

Auf der Übersichtsseite deines Programms bei Cloudflare steht eine
Internetadresse, die etwa so aussieht:

```
https://bescheinigungs-automat-copy.dein-name.workers.dev
```

**Das ist dein Programm.** Diese Adresse im Browser öffnen, mit dem
`ADMIN_PASSWORT` anmelden — fertig. Wenn in dieser Anleitung „die Oberfläche"
steht, ist immer diese Seite gemeint. Alles Weitere passiert dort: die
Einrichtung, die Kurse, das Protokoll, die Hilfe.

Erscheint stattdessen **„Fast fertig"**: zurück zu 1c, der Name auf der
Seite sagt, welcher Wert fehlt oder noch ein Beispielwert ist. Nach dem
Eintragen die Seite neu laden.

Steht auf der Übersichtsseite oben **„No URLs enabled"** und rechts bei
*workers.dev* **Disabled**: Reiter **Settings → Domains & Routes** → bei
**workers.dev** auf **Enable**. Danach steht die Adresse dort.

> Lege dir sofort ein Lesezeichen an.
>
> **Adresse verloren?** Bei Cloudflare anmelden → links *Workers & Pages* →
> dein Programm anklicken → die Adresse steht auf der Übersichtsseite
> (endet auf `.workers.dev`).

**Was dabei entstanden ist, falls es dich interessiert:** In deinem GitHub
liegt jetzt ein privates Verzeichnis `bescheinigungs-automat-copy` — deine
eigene Kopie des Programms. Cloudflare baut das Programm daraus und baut es
automatisch neu, sobald sich dort etwas ändert. Das ist der Weg, über den
später Updates kommen (siehe „Eine neue Version einspielen"). Die Vorlage,
aus der die Kopie gemacht wurde, hat mit deinem Programm ab jetzt nichts
mehr zu tun.

## Schritt 2 — Mailversand einrichten

Etwa zwanzig Minuten, plus Wartezeit auf die DNS-Einträge.
Nur einmal nötig, egal wie viele Kurse du später anlegst.

Ein Cloudflare-Programm kann Mails nicht selbst verschicken. Es braucht einen
Versanddienst mit Schnittstelle. Empfohlen ist **Resend**: kostenlos bis 3.000
Mails im Monat und 100 am Tag, für Bescheinigungen also reichlich.

> **Diesen Schritt gibt es ausführlich und mit jedem Klick einzeln in
> `MAILVERSAND-EINRICHTEN.md`.** Wenn du bei DNS-Einträgen unsicher bist, nimm
> die Datei. Hier steht nur die Kurzfassung.

1. Auf resend.com ein Konto anlegen.
2. Dort *Domains → Add Domain* und deine Absenderdomain eintragen.
3. Resend zeigt drei Einträge. Die trägst du in die DNS-Verwaltung deiner
   Domain ein — bei den meisten Anbietern unter „DNS" oder „Nameserver".
   Warten, bis alles auf grün steht. Das dauert Minuten bis Stunden.
4. Bei Resend unter *API Keys* einen Schlüssel erstellen.
5. Deine Programmadresse im Browser öffnen und anmelden. Der Assistent fragt
   das Folgende von selbst ab; sonst oben auf **Mailversand**: Resend
   auswählen, Schlüssel einfügen, deine eigene Adresse für Störungsmeldungen
   eintragen, speichern.
6. **Testmail an mich schicken** klicken. Kommt sie an, ist dieser Schritt
   erledigt. Kommt sie nicht an, auch in den Spamordner schauen.

### Absender: einmal eintragen, für alle Kurse

Unter **Mailversand → Absender** trägst du Absendername, Absenderadresse und
Antwortadresse ein und setzt den Haken **„Diese Absenderangaben für alle Kurse
verwenden“**. Dann brauchst du bei keinem Kurs mehr etwas einzutragen.

### Wenn du für mehrere Anbieter arbeitest

Du kannst alle Kurse über **eine** verifizierte Domain verschicken. Ein
einzelner Kurs kann trotzdem abweichen: auf der Kursseite unter „Wie die Mail
aussieht“ den Schalter **„Für diesen Kurs abweichende Absenderangaben“**
setzen und eigenen Namen und eigene Antwortadresse eintragen.

Der Grund: Der Teilnehmer hat bei „Praxis Sonnenweg" gekauft. Kommt die
Bescheinigung von einer wildfremden Adresse, sieht das aus wie ein
Betrugsversuch, landet im Spam und Rückfragen laufen bei dir statt beim
Anbieter auf. Angezeigt wird beim Empfänger zuerst der Name. Wenn der stimmt
und Antworten beim Anbieter ankommen, ist das Wesentliche gerettet.

---

## Schritt 3 — Ablefy-Konto verbinden

Etwa fünf Minuten. Einmal je Ablefy-Konto, egal wie viele Kurse darin liegen.

1. Auf **myablefy.com** anmelden.
2. *Einstellungen → Integrationen → ablefy API → API-Schlüssel erstellen.*
   Es entstehen zwei Werte: Schlüssel und Secret.
3. In der Oberfläche auf **Ablefy & Kurse**, unten einen Namen vergeben
   (nur für dich, z. B. den Firmennamen), beide Werte einfügen, **Verbinden**.

Das Programm probiert den Schlüssel sofort aus und **legt den Webhook bei
Ablefy selbst an**. Du musst dort nichts eintragen, nichts kopieren, nichts
suchen. Stimmt etwas nicht, sagt es dir sofort.

---

## Schritt 4 — Kurs anlegen

Etwa zehn Minuten je Kurs.

Auf **Kurs in diesem Konto anlegen** klicken. Die Kursseite hat fünf
Abschnitte, jeder zeigt, ob er vollständig ist.

### 1. Produkt und Abschlussquiz bei Ablefy

Das Produkt aus der Liste wählen — die kommt direkt aus deinem Ablefy-Konto.

Dann das **Abschlussquiz**: das Quiz der letzten Einheit. Sobald ein
Teilnehmer es besteht, geht die Bescheinigung raus. Welches Quiz das ist, kann
Ablefy über die Schnittstelle nicht mitteilen — deshalb zeigst du es dem
Programm einmal:

1. Öffne deinen eigenen Teilnehmer-Zugang zum Kurs. Hast du keinen: einen
   Testkauf mit 100-Prozent-Gutschein machen.
2. **Ist die letzte Einheit wegen Drip-In gesperrt:** in Ablefy unter
   *Kunden → Kurs-Zugänge* beim Kurs auf die drei Punkte, deinen Testzugang
   anhaken, **Vollzugriff gewähren**. Danach sind für diesen Zugang alle
   Einheiten sofort offen. (Das lässt sich für diesen Zugang nicht rückgängig
   machen — für einen Testzugang ist das egal.)
3. Die **letzte Einheit** öffnen und das Quiz einmal beantworten. Bestehen
   ist nicht nötig.
4. In der Oberfläche auf *Liste aktualisieren*. Das Quiz erscheint mit dem
   Namen seiner Lektion. Auf **Als Abschlussquiz markieren** klicken und die
   Rückfrage bestätigen.

Hat die letzte Einheit **mehrere Quizze**, alle markieren. Die Bescheinigung
geht dann erst raus, wenn ein Teilnehmer jedes davon bestanden hat.

Erscheint nichts: Ablefy meldet nur Quizze, die *nach* dem Verbinden des
Kontos beantwortet wurden. Das Quiz noch einmal beantworten.

**Wächter.** Wird ein Quiz in Ablefy später gelöscht und neu angelegt, bekommt
es eine neue Kennung — und das Programm würde es nicht mehr erkennen. Deshalb
merkt es sich jedes Quiz, das je gemeldet wurde. Taucht ein neues mit demselben
Lektionsnamen wie dein Abschlussquiz auf, zeigt die Übersicht einen Hinweis
und du bekommst eine Mail. Mit einem Klick übernimmst du das neue Quiz.

### 2. Angaben aus dem ZPP-Bescheid

Die sechs Angaben von oben eintragen. Der **Mindestbetrag** verhindert
Bescheinigungen über 0 Euro aus Testzugängen und Voll-Gutscheinen — eine
Bescheinigung über 0 Euro hilft bei keiner Kasse.

### 3. Unterschrift

Am besten ein freigestelltes PNG: Unterschrift auf weißes Papier,
abfotografieren, Hintergrund entfernen, hochladen. Ohne Bild wird der Name als
digitale Signatur eingesetzt. Die Person muss zeichnungsberechtigt sein.

### 4. Wie die Mail aussieht

Betreff und Text. Im Text kannst du `{vorname}`, `{nachname}`, `{kurs}` und
`{anbieter}` verwenden, `**so**` macht fett.

Der Absender kommt aus dem Mailversand, wenn dort der Haken „für alle Kurse“
gesetzt ist. Soll dieser Kurs unter einem anderen Namen verschicken, den
Schalter „abweichende Absenderangaben“ setzen und eigene Werte eintragen.

### 5. Probelauf und Freigabe

Siehe nächster Schritt.

---

## Schritt 5 — Probelauf

Etwa fünfzehn Minuten. **Diesen Schritt nicht überspringen.**

Das Programm prüft nicht, ob deine Angaben stimmen. Es druckt, was dasteht.
Der Probelauf ist die einzige Kontrolle.

1. Im Kurs eine Bestellung durchspielen — am einfachsten mit einem
   100-Prozent-Gutschein — und das Abschlussquiz bestehen.
2. In Ablefy die **Bestellnummer** dieser Bestellung heraussuchen.
3. In der Oberfläche unten *Bescheinigung ansehen* mit dieser Nummer.
4. Das fertige PDF erscheint direkt auf der Seite. Verschickt wird nichts.

Jetzt vergleichst du **Zeichen für Zeichen** gegen den ZPP-Kurseintrag:

- [ ] Titel der Maßnahme wortgleich
- [ ] Kurs-ID stimmt
- [ ] Präventionsprinzip stimmt
- [ ] Anbietername und Anschrift stimmen
- [ ] Name der teilnehmenden Person richtig geschrieben
- [ ] Gebühr stimmt
- [ ] Unterschrift sitzt im Feld

Ein Tippfehler in der Kurs-ID fällt sonst erst auf, wenn die erste Kasse
ablehnt — und dann sind dreißig Bescheinigungen draußen.

---

## Schritt 6 — Freigeben

Unten auf der Kursseite:

- **Kurs freigeben** anhaken. Ohne Freigabe löst ein bestandenes Quiz nichts
  aus.
- **Testmodus** zunächst angehakt lassen und eine Testadresse eintragen. Dann
  gehen alle Bescheinigungen dorthin statt an die Teilnehmer, mit „[TEST]“ im
  Betreff, beliebig oft wiederholbar.
- Wenn im Testmodus alles gepasst hat: Testmodus abhaken. Ab jetzt ist es echt.

Speichern nicht vergessen.

---

## Was danach zu tun ist

Nichts. Es läuft.

**Wenn etwas vorübergehend stört** — der Mailversand ist kurz nicht erreichbar,
Ablefy antwortet gerade nicht —, geht keine Bescheinigung verloren. Der Vorgang
kommt in eine Warteschlange und wird alle 15 Minuten von allein erneut
versucht, gut zwei Stunden lang. Auf der Startseite siehst du dann oben, was
wartet. Klappt es auch nach zwei Stunden nicht, bekommst du eine Mail — dann
steckt ein echtes Problem dahinter und nicht nur eine Störung.

Drei Dinge solltest du trotzdem kennen:

**Die Übersicht.** Dort steht bei jedem Ablefy-Konto, wann sich Ablefy zuletzt
gemeldet hat. Steht da ein alter Zeitpunkt, obwohl Leute im Kurs arbeiten,
kommt nichts mehr an — dann bei dem Konto auf *Webhook bei Ablefy neu
eintragen*.

**Störungsmeldungen.** Ging eine Bescheinigung endgültig nicht raus, bekommst
du eine Mail mit dem Grund im Klartext. Ist der Grund behoben, holst du sie auf
der Kursseite unter *Bescheinigung nachholen* mit der Bestellnummer nach.

**Die Warteschlange.** Steht oben auf der Startseite ein Band mit wartenden
Bescheinigungen, musst du nichts tun — es wird von allein wiederholt. Wer nicht
warten will, klickt dort auf *Jetzt sofort noch einmal versuchen*.

---

## Einstellungen

**Passwort ändern.** Unter *Einstellungen*: bisheriges Passwort, neues
zweimal. Ab dann gilt das neue; das aus der Installation nicht mehr.

**Passwort vergessen.** Im Cloudflare-Konto unter *Storage & Databases → KV*
den Speicher des Programms öffnen und den Eintrag `auth:passwort` löschen.
Danach gilt wieder das Passwort aus der Installation (`ADMIN_PASSWORT`).

**Sicherung.** Einmal im Monat und vor jedem Update: *Einstellungen →
Sicherung herunterladen*. Die Datei enthält Konten, Kurse, Unterschriften,
Mail-Einstellungen und die Liste, wer schon eine Bescheinigung bekommen hat.
**Keine Zugangsdaten** — nach dem Einspielen trägst du Ablefy-Schlüssel und
den Schlüssel des Versanddienstes einmal neu ein. Das Programm zeigt dir
genau, wo.

**Weiteren Kurs geführt anlegen.** Wer den Assistenten mochte: *Einstellungen
→ Weiteren Kurs geführt anlegen* startet ihn ab Schritt 4 für einen neuen Kurs.

---

## Ein Ablefy-Konto wieder trennen

Etwa wenn die Zusammenarbeit mit einem Anbieter endet.

1. Erst alle Kurse dieses Kontos löschen: Kursseite öffnen → ganz unten
   *Kurs löschen*. Solange noch ein Kurs am Konto hängt, lässt sich das Konto
   nicht entfernen — das Programm sagt es dir.
2. Dann unter *Ablefy & Kurse* das Konto aufklappen → unten **Konto
   entfernen**.

Dabei löscht das Programm auch die Rückmeldung (den Webhook), die es beim
Verbinden in diesem Ablefy-Konto angelegt hat. Bestätigt Ablefy das nicht,
sagt dir die Oberfläche, wo du in Ablefy nachsehen musst: *Einstellungen →
Integrationen → Webhooks*, Eintrag „Teilnahmebescheinigung (Kontoname)"
löschen. Sonst schickt Ablefy weiter Meldungen an eine Adresse, die niemand
mehr annimmt — nicht schlimm, aber unsauber.

Was bleibt: das Protokoll und die Liste, wer schon eine Bescheinigung bekommen
hat. Der Ablefy-Schlüssel selbst bleibt in Ablefy gültig — wenn niemand ihn
mehr braucht, dort unter *Integrationen → ablefy API* löschen.

---

## Eine neue Version einspielen

Das Programm läuft aus deiner eigenen Kopie bei GitHub
(`bescheinigungs-automat-copy`). Cloudflare baut es bei jeder Änderung dort
neu. Ein Update ist deshalb ein Datei-Upload, etwa fünf Minuten:

1. Vorher: *Einstellungen → Sicherung herunterladen*.
2. Das Update-ZIP entpacken. Darin liegen nur einzelne Dateien, keine
   Ordner.
3. Auf github.com dein Verzeichnis `bescheinigungs-automat-copy` öffnen →
   **Add file → Upload files**.
4. **Alle** Dateien aus dem entpackten Ordner markieren und ins
   Browserfenster ziehen. Gleichnamige Dateien werden ersetzt; die Datei
   `wrangler.toml` in deinem Verzeichnis bleibt unangetastet, weil sie im
   Update-ZIP absichtlich nicht enthalten ist.
5. Unten **Commit changes**. Ein, zwei Minuten später läuft die neue Fassung.
6. In der Oberfläche unten auf der Seite nachsehen: die Versionsnummer muss
   die neue sein. Was sich geändert hat, steht in `CHANGELOG.md`.

Deine Einstellungen, Zugangsdaten und das Protokoll bleiben dabei erhalten —
sie liegen im Speicher, nicht im Code.

> **Wenn der Build danach rot ist** und in der Meldung „wrangler.toml wurde
> durch die Fassung aus dem Update-Paket ersetzt" steht: Es wurde doch eine
> `wrangler.toml` mit hochgeladen. Die Meldung selbst enthält die vier
> Schritte, mit denen du das in zwei Minuten behebst.

---

## Wenn etwas nicht klappt

| Das siehst du | Das ist los |
|---|---|
| „Ablefy weist den Schlüssel ab" | Schlüssel und Secret vertauscht oder unvollständig kopiert |
| Kein Quiz in der Liste | Das Konto war beim Quiz noch nicht verbunden. Quiz noch einmal machen |
| „Die Domain ist noch nicht verifiziert" | Bei Resend steht die Absenderdomain noch nicht auf grün |
| „nur 0,00 € gezahlt" | Gutschein-Testkauf. Im Testmodus wird trotzdem gebaut, echt nicht |
| „an der Bestellung steht kein Name" | Die Bestellung hat keinen Käufernamen — bei Ablefy nachtragen |
| Ablefy meldet sich seit Tagen nicht | Webhook bei Ablefy neu eintragen lassen |
| Testmail kommt nicht an | Erst Spamordner. Dann bei Resend nachsehen, ob die Domain grün ist |
| „Zugangsdaten fehlen" bei einem Konto | Nach einer Wiederherstellung. Unter *Ablefy & Kurse* → Schlüssel ersetzen |
| „Dieses Abschlussquiz ist schon … zugeordnet" | Zwei Kurse zeigen auf dasselbe Quiz. Einen löschen oder anderes Quiz wählen |

Kommst du nicht weiter: ein Bildschirmfoto von der Meldung genügt meistens,
sie sind absichtlich im Klartext geschrieben.

---

## Was das Programm bewusst nicht tut

- Es prüft **nicht**, ob dein ZPP-Zertifikat noch gültig ist. Das liegt bei dir.
- Es verwaltet keine Prämien, keine Erstattungen, keine SEPA-Dateien.
- Es liest keine Zusatzfelder aus dem Checkout. Der Name kommt vom Käufer.
- Es rät nie. Fehlt eine Angabe, wird nichts verschickt und du bekommst eine
  Meldung. Eine falsche Bescheinigung wäre schlimmer als eine späte.
