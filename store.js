/**
 * Speicher und Verschlüsselung.
 *
 * Alles, was der Betreiber in der Oberfläche einträgt, landet hier im
 * KV-Speicher — nichts davon steht im Code. Zugangsdaten (Ablefy-Schlüssel,
 * Mail-Token) werden vorher verschlüsselt, weil KV kein Tresor ist: wer
 * Zugriff auf das Cloudflare-Konto hat, kann den Speicher lesen.
 */

const KONTEN = 'cfg:konten';
const KURSE = 'cfg:kurse';
const MAIL = 'cfg:mail';
const EINSTELLUNGEN = 'cfg:einstellungen';
const PASSWORT = 'auth:passwort';

/* ------------------------------------------------------------------ *
 * Verschlüsselung
 * ------------------------------------------------------------------ */

const enc = new TextEncoder();
const dec = new TextDecoder();

async function aesSchluessel(env) {
  const roh = env.DATEN_SCHLUESSEL;
  if (!roh) throw new Error('DATEN_SCHLUESSEL ist nicht gesetzt.');
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(roh));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

const b64 = (bytes) => {
  let s = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

const vonB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Klartext → "v1:<base64>". Leere Werte bleiben leer. */
export async function verschluessle(env, klartext) {
  if (!klartext) return '';
  const key = await aesSchluessel(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(klartext));
  const zusammen = new Uint8Array(iv.length + ct.byteLength);
  zusammen.set(iv, 0);
  zusammen.set(new Uint8Array(ct), iv.length);
  return 'v1:' + b64(zusammen);
}

/** "v1:<base64>" → Klartext. Wirft, wenn der Schlüssel nicht mehr passt. */
export async function entschluessle(env, wert) {
  if (!wert) return '';
  if (!wert.startsWith('v1:')) return wert; // sollte nicht vorkommen
  const key = await aesSchluessel(env);
  const roh = vonB64(wert.slice(3));
  try {
    const klar = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: roh.slice(0, 12) },
      key,
      roh.slice(12)
    );
    return dec.decode(klar);
  } catch {
    throw new Error(
      'Zugangsdaten lassen sich nicht mehr entschlüsseln. Vermutlich wurde DATEN_SCHLUESSEL geändert — dann müssen Ablefy-Schlüssel und Mail-Token einmal neu eingetragen werden.'
    );
  }
}

/* ------------------------------------------------------------------ *
 * Kleine Helfer
 * ------------------------------------------------------------------ */

/** Zufälliges, gut abschreibbares Kürzel. */
export function zufall(laenge = 24) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(laenge));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

async function ladeListe(env, key) {
  const wert = await env.SPEICHER.get(key, { type: 'json' });
  return Array.isArray(wert) ? wert : [];
}

/* ------------------------------------------------------------------ *
 * Ablefy-Konten
 * ------------------------------------------------------------------ */

export const ladeKonten = (env) => ladeListe(env, KONTEN);

export async function speichereKonten(env, konten) {
  await env.SPEICHER.put(KONTEN, JSON.stringify(konten));
}

export async function ladeKonto(env, id) {
  return (await ladeKonten(env)).find((k) => k.id === id) || null;
}

/**
 * Neues Ablefy-Konto ablegen. Schlüssel und Secret werden verschlüsselt,
 * der Webhook-Pfad ist der einzige Schutz der Webhook-Adresse — Ablefy
 * signiert seine Webhooks nicht.
 */
export async function legeKontoAn(env, { name, schluessel, secret }) {
  const konten = await ladeKonten(env);
  const konto = {
    id: zufall(8),
    name: name.trim(),
    webhookPfad: zufall(32),
    schluesselEnc: await verschluessle(env, schluessel.trim()),
    secretEnc: await verschluessle(env, secret.trim()),
    webhookId: null,
    webhookUrl: null,
    angelegt: new Date().toISOString(),
  };
  konten.push(konto);
  await speichereKonten(env, konten);
  return konto;
}

/** Klartext-Zugangsdaten eines Kontos, nur für den Moment des Aufrufs. */
export async function kontoZugang(env, konto) {
  if (!konto.schluesselEnc || !konto.secretEnc) {
    throw new Error(
      `Für das Ablefy-Konto „${konto.name}“ sind keine Zugangsdaten hinterlegt. Unter „Ablefy & Kurse“ bei diesem Konto Schlüssel und Secret eintragen.`
    );
  }
  return {
    key: await entschluessle(env, konto.schluesselEnc),
    secret: await entschluessle(env, konto.secretEnc),
  };
}

/** Schlüssel und Secret eines bestehenden Kontos ersetzen. Webhook-Pfad bleibt. */
export async function ersetzeKontoZugang(env, kontoId, { schluessel, secret }) {
  const konten = await ladeKonten(env);
  const i = konten.findIndex((k) => k.id === kontoId);
  if (i < 0) throw new Error('Konto nicht gefunden.');
  konten[i] = {
    ...konten[i],
    schluesselEnc: await verschluessle(env, schluessel.trim()),
    secretEnc: await verschluessle(env, secret.trim()),
    zugangGeaendert: new Date().toISOString(),
  };
  await speichereKonten(env, konten);
  return konten[i];
}

/* ------------------------------------------------------------------ *
 * Kurse
 * ------------------------------------------------------------------ */

/** Ältere Kurse kennen nur quizId/quizName — auf die Liste umstellen. */
export function normalisiereKurs(k) {
  if (!k) return k;
  if (!Array.isArray(k.quizze)) {
    k.quizze = k.quizId ? [{ id: String(k.quizId), name: k.quizName || '' }] : [];
  }
  k.quizze = k.quizze
    .filter((q) => q && q.id !== undefined && String(q.id).trim() !== '')
    .map((q) => ({ id: String(q.id).trim(), name: String(q.name || '').slice(0, 120) }));
  delete k.quizId;
  delete k.quizName;
  return k;
}

export const ladeKurse = async (env) => (await ladeListe(env, KURSE)).map(normalisiereKurs);

export async function speichereKurse(env, kurse) {
  await env.SPEICHER.put(KURSE, JSON.stringify(kurse));
}

export async function ladeKurs(env, id) {
  return (await ladeKurse(env)).find((k) => k.id === id) || null;
}

/** Leerer Kurs mit sinnvollen Vorgaben. */
export function neuerKurs(kontoId) {
  return {
    id: zufall(8),
    kontoId,
    aktiv: false,
    // Ablefy
    produktId: '',
    produktName: '',
    // Abschlussquiz(ze). Meist eins; hat die letzte Einheit mehrere Quizze,
    // stehen alle hier, und die Bescheinigung geht erst raus, wenn alle bestanden sind.
    quizze: [],
    // ZPP / Bescheinigung
    titel: '',
    zppKursId: '',
    praeventionsprinzip: 'Förderung von Entspannung und Erholung',
    anbieterName: '',
    anbieterAdresse: '',
    ort: '',
    unterschriftName: '',
    hatUnterschrift: false,
    mindestGebuehr: 0.01,
    // Versand. Gilt der Standard-Absender aus dem Mailversand für alle Kurse,
    // bleiben diese drei Felder leer — es sei denn, eigenerAbsender ist gesetzt.
    eigenerAbsender: false,
    absenderName: '',
    absenderMail: '',
    antwortAn: '',
    betreff: 'Ihre Teilnahmebescheinigung für die Krankenkasse',
    mailText: '',
    // Sicherheit
    testmodus: true,
    testEmpfaenger: '',
    letzterProbelauf: null,
    angelegt: new Date().toISOString(),
  };
}

/**
 * Welcher Absender für einen Kurs gilt.
 *
 * Ist im Mailversand „für alle Kurse verwenden“ angehakt, gilt der dortige
 * Standard — außer der Kurs hat „eigener Absender“ gesetzt. Ohne Haken
 * zählen immer die Felder am Kurs.
 */
export function absenderFuerKurs(mail, kurs) {
  const standardGilt = Boolean(mail?.standardFuerKurse) && !kurs?.eigenerAbsender;
  if (standardGilt) {
    return {
      quelle: 'standard',
      absenderName: mail.absenderName || '',
      absenderMail: mail.absenderMail || '',
      antwortAn: mail.antwortAn || '',
    };
  }
  return {
    quelle: 'kurs',
    absenderName: kurs?.absenderName || '',
    absenderMail: kurs?.absenderMail || '',
    antwortAn: kurs?.antwortAn || '',
  };
}

/**
 * Den Kurs finden, zu dem ein eingehendes Quiz gehört.
 * Bewusst über Konto + Produkt + Quiz, nicht nur über die Produkt-ID:
 * Produkt-IDs aus verschiedenen Ablefy-Konten können denselben Wert haben.
 */
export function findeKurs(kurse, kontoId, produktId, quizId) {
  return (
    kurse.find(
      (k) =>
        k.kontoId === kontoId &&
        String(k.produktId) === String(produktId) &&
        (k.quizze || []).some((q) => String(q.id) === String(quizId))
    ) || null
  );
}

/** Lektionsnamen vergleichbar machen: Groß/klein, Leerraum, Satzzeichen egal. */
export const gleicherName = (a, b) => {
  const n = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return n(a) !== '' && n(a) === n(b);
};

/* ------------------------------------------------------------------ *
 * Unterschrift (PNG je Kurs)
 * ------------------------------------------------------------------ */

export const unterschriftKey = (kursId) => `sig:${kursId}`;

export async function speichereUnterschrift(env, kursId, bytes) {
  await env.SPEICHER.put(unterschriftKey(kursId), bytes);
}

export async function ladeUnterschrift(env, kursId) {
  return env.SPEICHER.get(unterschriftKey(kursId), { type: 'arrayBuffer' });
}

/* ------------------------------------------------------------------ *
 * Mailversand
 * ------------------------------------------------------------------ */

export const MAIL_LEER = {
  anbieter: '',
  tokenEnc: '',
  mailboxId: '',
  geprueft: null,
  // Wohin Störungsmeldungen gehen
  warnAn: '',
  // Standard-Absender: für Störungsmeldungen immer, für Kurse wenn angehakt
  absenderName: '',
  absenderMail: '',
  antwortAn: '',
  standardFuerKurse: false,
};

export async function ladeMail(env) {
  const wert = await env.SPEICHER.get(MAIL, { type: 'json' });
  return { ...MAIL_LEER, ...(wert || {}) };
}

export async function speichereMail(env, konf) {
  await env.SPEICHER.put(MAIL, JSON.stringify(konf));
}

/* ------------------------------------------------------------------ *
 * Einstellungen: Stand des Einrichtungs-Assistenten
 * ------------------------------------------------------------------ */

export const EINSTELLUNGEN_LEER = {
  assistentFertig: false,
  assistentSchritt: 0,
  assistentKurs: '', // der Kurs, der im Assistenten gerade angelegt wird
  angelegt: null,
};

export async function ladeEinstellungen(env) {
  const wert = await env.SPEICHER.get(EINSTELLUNGEN, { type: 'json' });
  return { ...EINSTELLUNGEN_LEER, ...(wert || {}) };
}

export async function speichereEinstellungen(env, teil) {
  const alt = await ladeEinstellungen(env);
  const neu = { ...alt, ...teil, angelegt: alt.angelegt || new Date().toISOString() };
  await env.SPEICHER.put(EINSTELLUNGEN, JSON.stringify(neu));
  return neu;
}

/* ------------------------------------------------------------------ *
 * Passwort
 *
 * Beim Deploy kommt das Passwort als Secret ADMIN_PASSWORT. Ändert der
 * Betreiber es in der Oberfläche, liegt ab dann ein PBKDF2-Hash hier im
 * Speicher und das Secret zählt nicht mehr. Passwort vergessen: den Eintrag
 * auth:passwort im KV-Speicher löschen, dann gilt wieder das Secret.
 * ------------------------------------------------------------------ */

const PBKDF2_RUNDEN = 100000; // Obergrenze auf Cloudflare Workers

async function pbkdf2(passwort, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(passwort), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_RUNDEN, hash: 'SHA-256' },
    key,
    256
  );
  return b64(bits);
}

export async function setzePasswort(env, passwort) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(passwort, salt);
  await env.SPEICHER.put(PASSWORT, `v1:${b64(salt)}:${hash}`);
}

export async function hatEigenesPasswort(env) {
  return Boolean(await env.SPEICHER.get(PASSWORT));
}

/**
 * Stimmt das Passwort? Zuerst gegen den Hash im Speicher, sonst gegen das
 * Secret aus dem Deploy. Vergleich in konstanter Zeit über HMAC — die Länge
 * des Passworts soll nichts verraten.
 */
export async function passwortStimmt(env, eingabe) {
  const gespeichert = await env.SPEICHER.get(PASSWORT);
  if (gespeichert && gespeichert.startsWith('v1:')) {
    const [, saltB64, hash] = gespeichert.split(':');
    const probe = await pbkdf2(String(eingabe || ''), vonB64(saltB64));
    return gleich(probe, hash);
  }
  if (!env.ADMIN_PASSWORT) return false;
  return gleich(String(eingabe || ''), env.ADMIN_PASSWORT);
}

function gleich(a, b) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * Protokoll
 *
 * Jeder Eintrag ist ein eigener Schlüssel mit den Daten in den Metadaten.
 * Damit liest sich das ganze Protokoll mit einem einzigen list()-Aufruf,
 * und gleichzeitig laufende Webhooks überschreiben sich nicht gegenseitig.
 * Metadaten fassen 1024 Zeichen — deshalb wird gekürzt.
 * ------------------------------------------------------------------ */

const NEUNEN = 9999999999999;

export async function protokolliere(env, eintrag) {
  // Absteigend sortierbarer Schlüssel: neueste Einträge stehen vorn.
  const key = `log:${String(NEUNEN - Date.now()).padStart(13, '0')}:${zufall(4)}`;
  const kurz = {
    zeit: new Date().toISOString(),
    ...eintrag,
  };
  if (kurz.grund) kurz.grund = String(kurz.grund).slice(0, 300);
  await env.SPEICHER.put(key, '', {
    expirationTtl: 60 * 60 * 24 * 90,
    metadata: kurz,
  });
}

export async function ladeProtokoll(env, anzahl = 60) {
  const liste = await env.SPEICHER.list({ prefix: 'log:', limit: anzahl });
  return liste.keys.map((k) => k.metadata).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * Lernmodus: zuletzt gesehene Quizze
 *
 * Der Webhook hört auf alles, was aus einem Ablefy-Konto kommt. Jedes
 * beantwortete Quiz wird hier notiert — auch wenn es zu keinem Kurs gehört.
 * Daraus baut die Oberfläche die Liste "Zuletzt gesehen", aus der der
 * Betreiber sein Abschlussquiz per Klick auswählt, statt IDs zu suchen.
 * ------------------------------------------------------------------ */

export async function merkeQuiz(env, kontoId, daten) {
  // Nicht jeder Webhook trägt den Lektionsnamen — einen bekannten Namen nie durch leer ersetzen.
  let quizName = String(daten.quizName || '').slice(0, 120);
  if (!quizName) {
    const alt = await env.SPEICHER.getWithMetadata(`seen:${kontoId}:${daten.quizId}`);
    quizName = alt?.metadata?.quizName || '';
  }
  await env.SPEICHER.put(`seen:${kontoId}:${daten.quizId}`, '', {
    expirationTtl: 60 * 60 * 24 * 14,
    metadata: {
      quizId: String(daten.quizId || ''),
      quizName,
      produktId: String(daten.produktId || ''),
      produktName: String(daten.produktName || '').slice(0, 120),
      pflicht: daten.pflicht === true,
      zeit: new Date().toISOString(),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Bekannte Quizze je Produkt — ohne Verfallsdatum
 *
 * „Zuletzt gesehen“ verfällt nach 14 Tagen. Diese Liste nicht: sie merkt
 * sich jede Quiz-Kennung, die je aus einem Produkt gemeldet wurde. Taucht
 * eine neue auf, ist das ein Ereignis — vielleicht wurde das Abschlussquiz
 * in Ablefy neu angelegt, und dann passt die eingestellte Kennung nicht mehr.
 * ------------------------------------------------------------------ */

const bekanntKey = (kontoId, produktId) => `bekannt:${kontoId}:${produktId}`;

export async function ladeBekannt(env, kontoId, produktId) {
  const wert = await env.SPEICHER.get(bekanntKey(kontoId, produktId), { type: 'json' });
  return Array.isArray(wert) ? wert : [];
}

/** @returns {boolean} true, wenn die Kennung neu war */
export async function merkeBekannt(env, kontoId, produktId, quiz) {
  const liste = await ladeBekannt(env, kontoId, produktId);
  if (liste.some((q) => String(q.id) === String(quiz.id))) return false;
  liste.push({
    id: String(quiz.id),
    name: String(quiz.name || '').slice(0, 120),
    pflicht: quiz.pflicht === true,
    zuerst: new Date().toISOString(),
  });
  await env.SPEICHER.put(bekanntKey(kontoId, produktId), JSON.stringify(liste.slice(-200)));
  return true;
}

/* Wann das eingestellte Abschlussquiz eines Kurses zuletzt gemeldet wurde,
   und die Warnung „neues Quiz mit gleichem Lektionsnamen“. Beides als eigene
   Schlüssel, damit der Webhook nie cfg:kurse überschreibt. */

export async function merkeQuizPuls(env, kursId) {
  await env.SPEICHER.put(`qpuls:${kursId}`, new Date().toISOString());
}
export const ladeQuizPuls = (env, kursId) => env.SPEICHER.get(`qpuls:${kursId}`);

export async function setzeQuizWarnung(env, kursId, warnung) {
  if (!warnung) return env.SPEICHER.delete(`warnung:${kursId}`);
  await env.SPEICHER.put(`warnung:${kursId}`, JSON.stringify({ ...warnung, zeit: new Date().toISOString() }));
}
export const ladeQuizWarnung = (env, kursId) => env.SPEICHER.get(`warnung:${kursId}`, { type: 'json' });

/* Bestandene Abschlussquizze je Bestellung — nur nötig, wenn ein Kurs mehr
   als ein Abschlussquiz hat. Ein Schlüssel je Quiz, damit gleichzeitige
   Webhooks sich nicht überschreiben. */

export async function merkeBestanden(env, kursId, orderToken, quizId) {
  await env.SPEICHER.put(`bestanden:${kursId}:${orderToken}:${quizId}`, new Date().toISOString(), {
    expirationTtl: 60 * 60 * 24 * 400,
  });
}
export async function ladeBestanden(env, kursId, orderToken) {
  const liste = await env.SPEICHER.list({ prefix: `bestanden:${kursId}:${orderToken}:`, limit: 100 });
  return liste.keys.map((k) => k.name.split(':').pop());
}

export async function ladeGesehen(env, kontoId) {
  const liste = await env.SPEICHER.list({ prefix: `seen:${kontoId}:`, limit: 50 });
  return liste.keys
    .map((k) => k.metadata)
    .filter(Boolean)
    .sort((a, b) => String(b.zeit).localeCompare(String(a.zeit)));
}

/* ------------------------------------------------------------------ *
 * Doppelversand-Sperre und Lebenszeichen
 * ------------------------------------------------------------------ */

export const sperreKey = (kursId, orderToken) => `sent:${kursId}:${orderToken}`;

export async function schonVerschickt(env, kursId, orderToken) {
  return Boolean(await env.SPEICHER.get(sperreKey(kursId, orderToken)));
}

export async function merkeVerschickt(env, kursId, orderToken) {
  await env.SPEICHER.put(sperreKey(kursId, orderToken), new Date().toISOString());
}

export async function loescheSperre(env, kursId, orderToken) {
  await env.SPEICHER.delete(sperreKey(kursId, orderToken));
}

export async function merkePuls(env, kontoId) {
  await env.SPEICHER.put(`puls:${kontoId}`, new Date().toISOString());
}

export async function ladePuls(env, kontoId) {
  return env.SPEICHER.get(`puls:${kontoId}`);
}

/* ------------------------------------------------------------------ *
 * Warteschlange für misslungene Versuche
 *
 * Scheitert der Versand an etwas Vorübergehendem — Mailanbieter kurz weg,
 * Ablefy antwortet nicht —, darf die Bescheinigung nicht verloren gehen.
 * Sie landet hier und wird alle 15 Minuten erneut versucht.
 * Fehlt dagegen eine Angabe, hilft kein Wiederholen: das wird gemeldet,
 * nicht in die Schleife gelegt.
 * ------------------------------------------------------------------ */

export const offenKey = (kursId, orderToken) => `offen:${kursId}:${orderToken}`;

export async function merkeOffen(env, kursId, orderToken, grund, versuche = 1) {
  await env.SPEICHER.put(offenKey(kursId, orderToken), '', {
    expirationTtl: 60 * 60 * 24 * 7,
    metadata: {
      kursId,
      orderToken,
      versuche,
      grund: String(grund || '').slice(0, 200),
      zeit: new Date().toISOString(),
    },
  });
}

export async function ladeOffen(env) {
  const liste = await env.SPEICHER.list({ prefix: 'offen:', limit: 200 });
  return liste.keys.map((k) => k.metadata).filter(Boolean);
}

export async function loescheOffen(env, kursId, orderToken) {
  await env.SPEICHER.delete(offenKey(kursId, orderToken));
}

/* ------------------------------------------------------------------ *
 * Sicherung
 *
 * Alles, was der Betreiber eingetragen hat, als eine Datei — ohne
 * Zugangsdaten. Ablefy-Schlüssel und Mail-Token sind an DATEN_SCHLUESSEL
 * gebunden und gehören nicht in eine Datei, die auf irgendeinem Rechner
 * liegt. Nach einer Wiederherstellung trägt man sie einmal neu ein.
 *
 * Mit dabei sind die Doppelversand-Sperren: sonst bekäme nach einer
 * Wiederherstellung jeder, der das Quiz noch einmal macht, eine zweite
 * Bescheinigung.
 * ------------------------------------------------------------------ */

async function alleSchluessel(env, prefix) {
  const namen = [];
  let cursor;
  do {
    const seite = await env.SPEICHER.list({ prefix, limit: 1000, cursor });
    namen.push(...seite.keys.map((k) => k.name));
    cursor = seite.list_complete ? undefined : seite.cursor;
  } while (cursor);
  return namen;
}

export async function exportiereSicherung(env, version) {
  const [konten, kurse, mail, einstellungen] = await Promise.all([
    ladeKonten(env),
    ladeKurse(env),
    ladeMail(env),
    ladeEinstellungen(env),
  ]);
  const unterschriften = {};
  for (const k of kurse) {
    if (!k.hatUnterschrift) continue;
    const bytes = await ladeUnterschrift(env, k.id);
    if (bytes) unterschriften[k.id] = b64(bytes);
  }
  const sperren = (await alleSchluessel(env, 'sent:')).map((n) => n.slice('sent:'.length));
  const bekannt = {};
  for (const name of await alleSchluessel(env, 'bekannt:')) {
    bekannt[name.slice('bekannt:'.length)] = await env.SPEICHER.get(name, { type: 'json' });
  }
  const { tokenEnc, ...mailOhneToken } = mail;
  return {
    programm: 'bescheinigungs-automat',
    format: 1,
    version,
    exportiert: new Date().toISOString(),
    hinweis:
      'Ohne Zugangsdaten. Nach dem Einspielen müssen Ablefy-Schlüssel und der Schlüssel des Mailversands neu eingetragen werden.',
    konten: konten.map(({ schluesselEnc, secretEnc, ...rest }) => rest),
    kurse,
    unterschriften,
    mail: mailOhneToken,
    einstellungen,
    sperren,
    bekannt,
  };
}

/**
 * Sicherung einspielen. Ersetzt Konten, Kurse, Unterschriften, Mail-Einstellungen
 * und Assistenten-Stand. Vorhandene Zugangsdaten bleiben erhalten, wenn ein
 * Konto mit derselben Kennung schon da ist — dann muss nichts neu eingetragen werden.
 */
export async function importiereSicherung(env, daten) {
  if (!daten || daten.programm !== 'bescheinigungs-automat' || !Array.isArray(daten.kurse)) {
    throw new Error('Das ist keine Sicherungsdatei dieses Programms.');
  }
  const alteKonten = await ladeKonten(env);
  const alteMail = await ladeMail(env);

  const konten = (daten.konten || []).map((k) => {
    const alt = alteKonten.find((a) => a.id === k.id);
    return {
      ...k,
      schluesselEnc: alt?.schluesselEnc || '',
      secretEnc: alt?.secretEnc || '',
    };
  });
  await speichereKonten(env, konten);
  await speichereKurse(env, daten.kurse.map(normalisiereKurs));
  for (const [k, liste] of Object.entries(daten.bekannt || {})) {
    if (Array.isArray(liste)) await env.SPEICHER.put(`bekannt:${k}`, JSON.stringify(liste));
  }

  for (const [kursId, png] of Object.entries(daten.unterschriften || {})) {
    await speichereUnterschrift(env, kursId, vonB64(png));
  }

  await speichereMail(env, {
    ...MAIL_LEER,
    ...(daten.mail || {}),
    tokenEnc: alteMail.tokenEnc || '',
    geprueft: alteMail.tokenEnc ? daten.mail?.geprueft || null : null,
  });
  if (daten.einstellungen) await speichereEinstellungen(env, daten.einstellungen);

  let sperren = 0;
  for (const s of daten.sperren || []) {
    const [kursId, ...rest] = String(s).split(':');
    const orderToken = rest.join(':');
    if (!kursId || !orderToken) continue;
    await merkeVerschickt(env, kursId, orderToken);
    sperren++;
  }

  return {
    konten: konten.length,
    kurse: daten.kurse.length,
    sperren,
    ohneZugang: konten.filter((k) => !k.schluesselEnc).map((k) => k.name),
    mailTokenFehlt: !alteMail.tokenEnc,
  };
}
