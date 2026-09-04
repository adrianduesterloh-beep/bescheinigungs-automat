# Mailversand einrichten

Einmal machen. Danach nie wieder anfassen, egal wie viele Kurse noch dazukommen.

**Zeit:** zwanzig Minuten Arbeit, dazu eine Wartezeit von ein paar Minuten bis
wenigen Stunden.

---

## Warum ein Versanddienst nötig ist

Das Programm läuft bei Cloudflare. Cloudflare kann kein SMTP — also genau das
Verfahren, mit dem ein normales Postfach Mails verschickt. Ein Postfach bei
united-domains, IONOS oder Google kann deshalb nicht direkt benutzt werden.

Der Versand läuft über **Resend**. Deine Adresse bleibt trotzdem deine Adresse:
Resend verschickt in deinem Namen, Antworten landen in deinem normalen
Postfach. Für den Empfänger sieht es aus wie eine ganz normale Mail von dir.

Kostenlos sind 3.000 Mails im Monat und 100 am Tag, bei bis zu drei Domains.
Für Teilnahmebescheinigungen ist das reichlich.

---

## Schritt 1 — Konto anlegen

1. **resend.com** aufrufen, oben rechts auf **Sign up**.
2. Mit deiner E-Mail-Adresse registrieren und die Bestätigungsmail anklicken.

Fertig. Keine Zahlungsdaten nötig.

---

## Schritt 2 — Deine Domain anmelden

Damit ist gemeint: die Domain, von der aus die Bescheinigungen kommen sollen.
Zum Beispiel `deine-firma.de`, wenn die Mails von
`bescheinigung@deine-firma.de` kommen sollen.

1. Links im Menü auf **Domains**.
2. Auf **Add Domain**.
3. Deine Domain eintragen — **nur den Namen**, also `deine-firma.de`, ohne
   `www` und ohne `@`.
4. Als Region **eu-west-1 (Ireland)** wählen. Dann bleiben die Daten in Europa.
5. Auf **Add**.

Jetzt zeigt Resend eine Tabelle mit drei Zeilen. Die musst du gleich abtippen.
Lass das Fenster offen.

---

## Schritt 3 — Die drei Einträge bei deinem Domainanbieter setzen

Das ist der einzige fummelige Teil. Danach ist es geschafft.

Jede Zeile in der Resend-Tabelle hat drei Angaben:

| Was Resend zeigt | Was du damit machst |
|---|---|
| **Type** (MX, TXT) | dieselbe Art bei deinem Anbieter wählen |
| **Name** / **Host** | in das Feld „Name" oder „Host" eintragen |
| **Value** / **Content** | in das Feld „Wert" oder „Ziel" eintragen |

> **Der häufigste Fehler:** Steht bei Resend im Namen `send.deine-firma.de`,
> trägst du bei deinem Anbieter oft nur `send` ein — die Domain hängt der
> Anbieter selbst an. Steht danach bei dir `send.deine-firma.de.deine-firma.de`,
> hast du zu viel eingetragen.

### Bei united-domains

1. Auf **united-domains.de** einloggen.
2. Oben auf **Portfolio**, die Domain anklicken.
3. Auf **DNS-Einstellungen** (je nach Ansicht auch „DNS verwalten").
4. Für jede der drei Zeilen auf **Eintrag hinzufügen**, Art auswählen, Name und
   Wert einsetzen, speichern.
5. Der DKIM-Eintrag hat einen sehr langen Wert. Den unbedingt per Kopieren und
   Einfügen übertragen, nicht abtippen, und danach kontrollieren, ob er
   vollständig drinsteht.

### Bei einem anderen Anbieter

Der Weg heißt fast überall ähnlich: Domain auswählen → *DNS* → *Eintrag
hinzufügen*. Findest du es nicht, such in der Hilfe deines Anbieters nach
„DNS-Eintrag hinzufügen".

> **Deine bestehenden Postfächer bleiben unberührt.** Resend legt seine
> Einträge auf einer Unteradresse ab und ersetzt nichts. Solltest du eine
> Warnung sehen, dass ein vorhandener Eintrag überschrieben wird: anhalten und
> nachfragen, nicht bestätigen.

---

## Schritt 4 — Warten, bis alles grün ist

Zurück bei Resend auf **Verify** klicken. Wenn noch nicht alles grün ist:
Kaffee holen und in zehn Minuten noch einmal klicken. Manchmal dauert es ein
paar Stunden — das ist normal und liegt nicht an dir.

Wenn eine Zeile dauerhaft rot bleibt, stimmt dort Name oder Wert nicht.
Vergleiche Zeichen für Zeichen, besonders am Anfang und am Ende.

---

## Schritt 5 — Schlüssel holen

1. Links im Menü auf **API Keys**.
2. Auf **Create API Key**.
3. Einen Namen vergeben, z. B. `Bescheinigungen`. Berechtigung
   **Sending access** genügt.
4. **Add**. Jetzt wird der Schlüssel **ein einziges Mal** angezeigt — er fängt
   mit `re_` an.
5. Sofort kopieren und im nächsten Schritt einfügen. Verlierst du ihn, machst
   du einfach einen neuen.

---

## Schritt 6 — Im Programm eintragen

Deine Programmadresse (aus Schritt 1 der `ANLEITUNG.md`, endet auf
`.workers.dev`) im Browser öffnen und mit deinem Passwort anmelden.

Beim ersten Anmelden fragt der Einrichtungs-Assistent genau das ab — dann
einfach dort eintragen. Später findest du dieselben Felder oben unter
**Mailversand**:

1. Bei *Versanddienst* **Resend (empfohlen)** wählen.
2. Den Schlüssel einfügen.
3. Bei *Deine Adresse für Störungsmeldungen* deine eigene E-Mail eintragen.
   Dorthin meldet sich das Programm, falls einmal etwas nicht klappt.
4. Unter *Absender* Name, Adresse auf der eben freigeschalteten Domain
   (z. B. `bescheinigung@deine-firma.de`) und Antwortadresse eintragen.
5. Haken **„Diese Absenderangaben für alle Kurse verwenden“** setzen, wenn
   alle Kurse so verschicken sollen.
6. **Speichern**, dann **Testmail an mich schicken**.

Kommt die Testmail an, ist alles fertig.

---

## Wenn die Testmail nicht ankommt

| Meldung oder Beobachtung | Das ist los |
|---|---|
| „Die Domain ist noch nicht verifiziert" | Bei Resend steht noch nicht alles auf grün. Schritt 4 |
| Nichts im Posteingang | Erst in den Spam schauen. Neue Absender landen dort öfter |
| „Mailversand fehlgeschlagen (401)" | Der Schlüssel stimmt nicht. Neuen erstellen |
| „Es ist kein Mailversand eingerichtet" | Speichern vergessen |

---

## Für jeden Kurs noch wichtig

Die Domain ist gemeinsam. Läuft alles unter deinem Namen, reicht der Haken
„für alle Kurse verwenden“. Betreibst du Kurse **für andere Anbieter**, gehören
Absendername und Antwortadresse zum jeweiligen Anbieter: auf der Kursseite
unter „Wie die Mail aussieht“ den Schalter *abweichende Absenderangaben*
setzen und dort eintragen.

Der Grund: Der Teilnehmer hat bei „Praxis Sonnenweg" gekauft. Steht als
Absender ein fremder Name, sieht die Mail aus wie ein Betrugsversuch und
landet im Spam. Angezeigt wird zuerst der Name — wenn der stimmt und Antworten
beim richtigen Anbieter ankommen, passt es.
