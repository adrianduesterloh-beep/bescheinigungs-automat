# Technik

Für den Fall, dass jemand mit Programmierkenntnissen nachsehen oder etwas
ändern soll. Für die normale Bedienung reicht `ANLEITUNG.md`.

Ein Cloudflare Worker. Keine Datenbank, kein Server, keine laufenden Kosten in
üblicher Größenordnung.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.js` | Router: Oberfläche, `/api/…`, Webhook, `/health` |
| `store.js` | KV-Speicher, Verschlüsselung, Datenmodell |
| `admin.js` | alles, was die Oberfläche aufruft, plus Anmeldung |
| `webhook.js` | Webhook auswerten, Bescheinigung bauen und verschicken |
| `ablefy.js` | offizielle Ablefy-API |
| `felder.js` | Webhook-Payload entpacken |
| `mail.js` | Resend und Hostinger, Standardtext der Mail |
| `zertifikat.js` | GKV-Formular ausfüllen |
| `version.js` | Versionsnummer — bei jeder Änderung hochzählen |
| `admin.html` | die gesamte Oberfläche, eine Datei — inklusive Assistent, Einstellungen, Hilfe |
| `formular.pdf` | leeres GKV-Muster, Kapitel 7 |
| `wrangler.toml` | Cloudflare-Konfiguration. Die KV-Kennung darin trägt Cloudflare bei der Installation ein — deshalb liegt die Datei nie im Update-ZIP |
| `pruefe-vor-deploy.mjs` | läuft als `predeploy`: bricht den Cloudflare-Build mit klarer Meldung ab, wenn `wrangler.toml` noch den Platzhalter enthält |

Alle Programmdateien liegen bewusst **ohne Unterordner** im Wurzelverzeichnis:
So kann ein Update per Drag-and-drop in die GitHub-Weboberfläche nicht an
verschobenen Ordnern scheitern.

Es gibt **keine** Konfigurationsdatei mit Kursdaten. Alles steht im KV-Speicher
und wird über die Oberfläche gepflegt. Von außen kommen nur zwei Werte, beide
als Cloudflare-Secret: `ADMIN_PASSWORT` und `DATEN_SCHLUESSEL`.

## Datenmodell im KV

```
cfg:konten            Ablefy-Konten, Zugangsdaten verschlüsselt (AES-GCM)
cfg:kurse             Kurse
cfg:mail              Versanddienst, Token verschlüsselt, Standard-Absender
cfg:einstellungen     Stand des Einrichtungs-Assistenten
auth:passwort         PBKDF2-Hash, wenn das Passwort in der Oberfläche geändert wurde
sig:<kursId>          Unterschrift als PNG
sent:<kursId>:<order> Doppelversand-Sperre
log:<zeit>:<zufall>   Protokoll, Inhalt in den Metadaten, 90 Tage
seen:<konto>:<quiz>   zuletzt gemeldete Quizze (Auswahlliste), 14 Tage
bekannt:<konto>:<produkt>  alle je gemeldeten Quiz-Kennungen, ohne Verfall (Wächter)
qpuls:<kursId>        wann das Abschlussquiz zuletzt gemeldet wurde
warnung:<kursId>      offener Wächter-Hinweis (neues Quiz mit gleichem Lektionsnamen)
bestanden:<kurs>:<order>:<quiz>  bestandene Abschlussquizze je Bestellung (nur bei mehreren), 400 Tage
offen:<kurs>:<order>  Warteschlange für Wiederholungen, 7 Tage
puls:<konto>          letzter Webhook-Empfang
```

Protokoll und Quiz-Auswahlliste liegen in KV-**Metadaten**, nicht im Wert. Dadurch
liest sich beides mit einem einzigen `list()`-Aufruf, und gleichzeitig
eintreffende Webhooks überschreiben sich nicht gegenseitig. Metadaten fassen
1024 Zeichen, deshalb wird beim Schreiben gekürzt.

## Ablauf

1. Ablefy schickt bei jedem beantworteten Quiz ein `quiz.answered` an
   `/w/<kontoId>/<geheimer Pfad>`.
2. Der Eintrag landet immer unter `seen:` — daraus baut die Oberfläche die
   Liste, aus der das Abschlussquiz ausgewählt wird.
3. Passt `product_id` **und** `quiz_id` zu einem freigegebenen Kurs und
   ist `points_gained >= points_to_pass`, wird ausgestellt. Hat der Kurs
   mehrere Abschlussquizze (`quizze[]`), erst wenn für diese Bestellung alle
   unter `bestanden:` liegen.
3a. **Wächter:** Jede Quiz-Kennung, die ein Produkt zum ersten Mal meldet,
   landet unter `bekannt:`. Trägt sie denselben Lektionsnamen wie ein
   markiertes Abschlussquiz (`gleicherName()` in `store.js`), wird
   `warnung:<kursId>` gesetzt, protokolliert („prüfen“) und der Betreiber
   per Mail informiert. Die Oberfläche bietet Übernehmen/Ignorieren.
4. Bestellung über `GET /orders/<order_token>` holen: Name aus `payer`, Gebühr
   aus `order_amount_gross`, Beginn aus `access_activated_at`.
5. PDF bauen, Mail verschicken, protokollieren.

## Zuverlässigkeit

Der Versand kann aus zwei Gründen scheitern, und die werden verschieden
behandelt.

**Vorübergehend** — Mailanbieter kurz weg, Ablefy antwortet nicht, Netzfehler.
Dann wird die Doppelversand-Sperre wieder gelöst, der Vorgang landet unter
`offen:` und ein Cron-Auslöser versucht es alle 15 Minuten erneut, bis zu
achtmal. Erst danach wird aufgegeben und gemeldet.

**Endgültig** — eine Angabe fehlt, kein Name an der Bestellung, Betrag unter
dem Mindestwert. Wiederholen hilft nicht, also wird sofort gemeldet und nichts
in die Schleife gelegt.

Die Sperre `sent:` wird **vor** dem Versand gesetzt und bei einem Fehlschlag
wieder entfernt. Damit ist ein Doppelversand ausgeschlossen und ein verlorener
Versand trotzdem wiederholbar. Ein doppeltes `quiz.answered` von Ablefy läuft
gegen dieselbe Sperre.

Der Webhook antwortet sofort mit 200 und arbeitet danach weiter — ein langsamer
Endpunkt würde sonst Wiederholungen bei Ablefy auslösen.

## Passwort und Sicherung

**Passwort.** Solange `auth:passwort` nicht existiert, gilt das Secret
`ADMIN_PASSWORT`. Ändert der Betreiber das Passwort in der Oberfläche, liegt
ab dann ein PBKDF2-Hash (SHA-256, 100.000 Runden, eigenes Salt) unter
`auth:passwort`, und das Secret zählt nicht mehr. Zurücksetzen: den Eintrag
im KV löschen. Der Hash hängt **nicht** an `DATEN_SCHLUESSEL`.

**Absender.** `absenderFuerKurs(mail, kurs)` in `store.js` entscheidet: gilt
`cfg:mail.standardFuerKurse` und hat der Kurs nicht `eigenerAbsender`, kommt
der Absender aus `cfg:mail`, sonst aus dem Kurs. Beide Stellen — Versand und
Vollständigkeitsprüfung — laufen durch dieselbe Funktion.

**Sicherung.** `GET /api/sicherung/export` liefert Konten (ohne Zugangsdaten,
aber mit Webhook-Pfad), Kurse, Unterschriften, Mail-Einstellungen (ohne
Token), Assistenten-Stand und alle `sent:`-Sperren als JSON.
`POST /api/sicherung/import` ersetzt all das; vorhandene Zugangsdaten bleiben,
wenn die Konto-Kennung übereinstimmt. Konten ohne Zugang sind in der
Oberfläche rot markiert, bis Schlüssel und Secret neu eingetragen sind.

## Eigene Änderungen am Code

Das Programm wurde über einen Deploy-to-Cloudflare-Link installiert. Dabei hat
Cloudflare den Code aus dem öffentlichen Vorlagen-Repository des Herausgebers
in ein eigenes (privates) GitHub-Repository `…-copy` im Konto des Betreibers
kopiert, einen KV-Namespace angelegt, dessen Kennung in `wrangler.toml`
eingetragen und das Repository über Workers Builds mit dem Worker verbunden: **Jeder Commit in diesem Repository
löst automatisch einen neuen Build und Deploy aus.** Secrets und KV-Speicher
bleiben dabei erhalten.

Wer etwas ändern will, ändert also die Dateien im Repository — direkt in der
GitHub-Weboberfläche oder per `git push`. Vorher `version.js` hochzählen
und `CHANGELOG.md` ergänzen: Die Oberfläche zeigt die Versionsnummer im Fuß,
so sieht man, ob die Änderung angekommen ist. Vor dem Push
`npx wrangler deploy --dry-run` — das baut, ohne zu deployen.

Ein Update, das als neues ZIP kommt, spielt man genauso ein: Inhalt ins
Repository hochladen (steht für Nicht-Techniker in `ANLEITUNG.md` unter
„Eine neue Version einspielen“). Das Update-ZIP enthält absichtlich keine
`wrangler.toml`; wird sie doch überschrieben, bricht `predeploy` mit
Anleitung zur Reparatur ab. Die Kopie ist kein Fork des Vorlagen-Repositorys —
ein „Sync fork“ gibt es nicht. Wer es git-seitig sauber haben will, kann die
Vorlage als `upstream` eintragen und mergen.

## Lokal ausprobieren

```bash
npm install
npx wrangler dev --local --persist-to /tmp/wstate \
  --var ADMIN_PASSWORT:test --var DATEN_SCHLUESSEL:langes-testwort
```

⚠️ **`--persist-to` ist Pflicht, wenn der Projektordner von einem
Cloud-Speicher synchronisiert wird.** Sonst stirbt die Laufzeitumgebung mit
`SQLite failed … disk I/O error (SQLITE_IOERR_DELETE)`. Das sieht aus, als
wäre das Programm kaputt, ist aber nur der Ablageort.

Bauen ohne zu deployen: `npx wrangler deploy --dry-run`.
Live mitlesen: `npx wrangler tail`.

**Ohne echte Konten testen:** `werkzeuge/test-nachbau.mjs` ist ein Nachbau
von Ablefy-API und Resend (`node werkzeuge/test-nachbau.mjs`, lauscht auf
Port 8788). Dazu in `.dev.vars`:

```
ADMIN_PASSWORT="test-passwort-1234"
DATEN_SCHLUESSEL="ein-langes-zufallswort-fuer-den-test"
TEST_ABLEFY_BASIS="http://127.0.0.1:8788/api"
TEST_RESEND_BASIS="http://127.0.0.1:8788/emails"
```

Ablefy-Schlüssel `test-key` / `test-secret`, Resend-Schlüssel `re_test`,
Bestellnummern `ord_ok` (129 €) und `ord_null` (0 €). Verschickte Mails
stehen unter `http://127.0.0.1:8788/_mails`. Die beiden `TEST_`-Variablen im
Betrieb **nicht** setzen.

## Was beim Ändern zu beachten ist

- **`DATEN_SCHLUESSEL` niemals nachträglich ändern.** Alle gespeicherten
  Ablefy-Schlüssel und Mail-Token wären dann unlesbar.
- **`quiz_passed` aus dem Webhook nicht auswerten.** Das Feld stand in Tests
  auf `false`, obwohl die volle Punktzahl erreicht war. Ausgewertet wird
  `points_gained >= points_to_pass`.
- **Ablefy signiert Webhooks nicht.** Der einzige Schutz ist der geheime Pfad.
  Deshalb ist er 32 Zeichen lang und je Konto anders.
- **Routing über Konto-Pfad und dann `product_id` + `quiz_id`.** Produkt-IDs
  aus verschiedenen Ablefy-Konten können denselben Wert haben.
- **Ablefy hat keine Endpunkte für Kurse, Lektionen oder Quizze.** Deshalb
  wird das Abschlussquiz aus den gemeldeten Quizzen per Klick markiert. Ein
  Abruf der Kursstruktur ginge nur über die interne Cabinet-API, und die
  braucht eine Browser-Sitzung, die regelmäßig abläuft.
- **Kurse haben `quizze[]`**, nicht eine einzelne Kennung. Bei mehreren wird
  je Bestellung unter `bestanden:` gezählt. Der Wächter (`bekannt:` +
  `gleicherName()` in `store.js`) meldet neue Kennungen mit gleichem
  Lektionsnamen — Ablefy vergibt beim Neuanlegen eines Quiz eine neue ID.
- Wird ein Ablefy-Konto entfernt und neu angelegt, ändert sich die
  Webhook-Adresse. Der neue Webhook wird automatisch gesetzt, der alte bleibt
  bei Ablefy stehen und läuft ins Leere.

## Fehlersuche

| Symptom | Ansatz |
|---|---|
| Oberfläche zeigt „Fast fertig" | eines der beiden Secrets fehlt |
| Anmeldung nach kurzer Zeit weg | Sitzung gilt 12 Stunden |
| „Zugangsdaten lassen sich nicht mehr entschlüsseln" | `DATEN_SCHLUESSEL` wurde geändert |
| Webhook kommt an, nichts passiert | Produkt- oder Quiz-Kennung passen nicht, oder Kurs ist nicht freigegeben |
| Alles richtig, trotzdem nichts | `npx wrangler tail` mitlaufen lassen und das Quiz noch einmal machen |
| Passwort weg | `auth:passwort` im KV löschen → `ADMIN_PASSWORT` gilt wieder |
| Konto „Zugangsdaten fehlen" | Nach Import einer Sicherung. Schlüssel ersetzen |

`GET /health` antwortet ohne Anmeldung und eignet sich zur Überwachung.
