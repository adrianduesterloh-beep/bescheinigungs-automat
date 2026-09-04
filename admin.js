/**
 * Die Schnittstelle hinter der Bedienoberfläche.
 *
 * Alles, was der Betreiber klickt, landet hier. Angemeldet wird mit dem
 * Passwort aus dem Deploy — oder dem, das er später in der Oberfläche
 * gesetzt hat. Die Sitzung hängt danach an einem signierten Cookie und gilt
 * zwölf Stunden.
 */

import {
  ladeKonten,
  ladeKonto,
  speichereKonten,
  legeKontoAn,
  kontoZugang,
  ersetzeKontoZugang,
  ladeKurse,
  ladeKurs,
  speichereKurse,
  neuerKurs,
  absenderFuerKurs,
  ladeMail,
  speichereMail,
  ladeEinstellungen,
  speichereEinstellungen,
  passwortStimmt,
  setzePasswort,
  hatEigenesPasswort,
  verschluessle,
  entschluessle,
  speichereUnterschrift,
  ladeProtokoll,
  ladeGesehen,
  ladePuls,
  ladeOffen,
  loescheSperre,
  exportiereSicherung,
  importiereSicherung,
  ladeBekannt,
  normalisiereKurs,
  ladeQuizPuls,
  ladeQuizWarnung,
  setzeQuizWarnung,
} from './store.js';
import { ladeProdukte, legeWebhookAn, ladeWebhooks, loescheWebhook } from './ablefy.js';
import { sendeMail, STANDARDTEXT, baueText } from './mail.js';
import { stelleAus, wiederhole } from './webhook.js';
import { VERSION } from './version.js';

/** Große Binärdaten in Base64 — stückweise, sonst sprengt der Aufruf den Stack. */
function pdfNachBase64(bytes) {
  const a = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < a.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

const json = (daten, status = 200, kopf = {}) =>
  new Response(JSON.stringify(daten), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...kopf },
  });

const fehler = (nachricht, status = 400) => json({ fehler: nachricht }, status);

const istMail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

/* ------------------------------------------------------------------ *
 * Anmeldung
 * ------------------------------------------------------------------ */

const enc = new TextEncoder();

async function signiere(env, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(env.DATEN_SCHLUESSEL || 'ohne-schluessel'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function baueCookie(env) {
  const bis = String(Date.now() + 12 * 60 * 60 * 1000);
  return `${bis}.${await signiere(env, bis)}`;
}

async function cookieGueltig(env, wert) {
  if (!wert) return false;
  const [bis, sig] = String(wert).split('.');
  if (!bis || !sig) return false;
  if (Number(bis) < Date.now()) return false;
  return sig === (await signiere(env, bis));
}

export async function istAngemeldet(env, request) {
  const roh = request.headers.get('Cookie') || '';
  const treffer = roh.match(/(?:^|;\s*)sitzung=([^;]+)/);
  return cookieGueltig(env, treffer?.[1]);
}

async function anmelden(env, request) {
  const { passwort } = await request.json().catch(() => ({}));
  const sperre = await env.SPEICHER.get('login:sperre');
  if (sperre && Number(sperre) > Date.now()) {
    return fehler('Zu viele Fehlversuche. Bitte in zehn Minuten noch einmal versuchen.', 429);
  }
  if (!env.ADMIN_PASSWORT && !(await hatEigenesPasswort(env))) {
    return fehler('Es ist kein Passwort hinterlegt. ADMIN_PASSWORT im Cloudflare-Konto setzen.', 500);
  }
  if (!(await passwortStimmt(env, passwort))) {
    const zaehler = Number((await env.SPEICHER.get('login:fehler')) || 0) + 1;
    await env.SPEICHER.put('login:fehler', String(zaehler), { expirationTtl: 600 });
    if (zaehler >= 8) {
      await env.SPEICHER.put('login:sperre', String(Date.now() + 600000), { expirationTtl: 900 });
    }
    return fehler('Passwort stimmt nicht.', 401);
  }
  await env.SPEICHER.delete('login:fehler');
  return json(
    { ok: true },
    200,
    {
      'Set-Cookie': `sitzung=${await baueCookie(env)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`,
    }
  );
}

/* ------------------------------------------------------------------ *
 * Router der Oberfläche
 * ------------------------------------------------------------------ */

export async function adminApi(env, request, url) {
  const pfad = url.pathname.replace(/^\/api\//, '');

  if (pfad === 'login') return anmelden(env, request);
  if (pfad === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': 'sitzung=; Path=/; Max-Age=0' });
  }

  if (!(await istAngemeldet(env, request))) return fehler('nicht angemeldet', 401);
  const koerper = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

  try {
    switch (pfad) {
      case 'uebersicht':
        return json(await uebersicht(env, url));

      case 'wiederholen': {
        const anzahl = await wiederhole(env);
        return json({ ok: true, anzahl });
      }

      /* ---- Einstellungen ---- */
      case 'einstellungen/assistent': {
        const teil = {};
        if (typeof koerper.fertig === 'boolean') teil.assistentFertig = koerper.fertig;
        if (Number.isInteger(koerper.schritt)) teil.assistentSchritt = koerper.schritt;
        if (typeof koerper.kursId === 'string') teil.assistentKurs = koerper.kursId;
        const e = await speichereEinstellungen(env, teil);
        return json({ ok: true, einstellungen: e });
      }

      case 'einstellungen/passwort': {
        const alt = String(koerper.altes || '');
        const neu = String(koerper.neues || '');
        if (!(await passwortStimmt(env, alt))) return fehler('Das bisherige Passwort stimmt nicht.', 401);
        if (neu.length < 10) return fehler('Das neue Passwort braucht mindestens zehn Zeichen.');
        if (neu === alt) return fehler('Das neue Passwort ist dasselbe wie das alte.');
        await setzePasswort(env, neu);
        return json({ ok: true });
      }

      case 'sicherung/export': {
        const daten = await exportiereSicherung(env, VERSION);
        const name = `bescheinigungs-automat-sicherung-${daten.exportiert.slice(0, 10)}.json`;
        return json(daten, 200, { 'Content-Disposition': `attachment; filename="${name}"` });
      }

      case 'sicherung/import': {
        const ergebnis = await importiereSicherung(env, koerper.sicherung);
        return json({ ok: true, ...ergebnis });
      }

      /* ---- Mailversand ---- */
      case 'mail/speichern': {
        const alt = await ladeMail(env);
        const wert = (feld) => (koerper[feld] !== undefined ? String(koerper[feld]).trim() : alt[feld] ?? '');
        for (const f of ['warnAn', 'absenderMail', 'antwortAn']) {
          if (wert(f) && !istMail(wert(f))) return fehler(`„${wert(f)}“ sieht nicht nach einer E-Mail-Adresse aus.`);
        }
        const neu = {
          ...alt,
          anbieter: koerper.anbieter !== undefined ? koerper.anbieter : alt.anbieter,
          tokenEnc: koerper.token ? await verschluessle(env, koerper.token) : alt.tokenEnc,
          mailboxId: wert('mailboxId'),
          warnAn: wert('warnAn'),
          absenderName: wert('absenderName'),
          absenderMail: wert('absenderMail'),
          antwortAn: wert('antwortAn'),
          standardFuerKurse:
            typeof koerper.standardFuerKurse === 'boolean' ? koerper.standardFuerKurse : alt.standardFuerKurse,
          // Ein neuer Schlüssel oder ein anderer Dienst muss neu getestet werden.
          geprueft: koerper.token || (koerper.anbieter && koerper.anbieter !== alt.anbieter) ? null : alt.geprueft,
        };
        await speichereMail(env, neu);
        return json({ ok: true });
      }

      case 'mail/test': {
        const m = await ladeMail(env);
        const an = koerper.an || m.warnAn;
        if (!an) return fehler('Es fehlt eine Adresse, an die die Testmail gehen soll.');
        if (!m.anbieter || !m.tokenEnc) return fehler('Erst den Versanddienst und den Schlüssel speichern.');
        await sendeMail(
          {
            anbieter: m.anbieter,
            token: await entschluessle(env, m.tokenEnc),
            mailboxId: m.mailboxId,
          },
          {
            an,
            betreff: 'Testmail: der Versand funktioniert',
            absenderName: m.absenderName || 'Bescheinigungen',
            absenderMail: m.absenderMail,
            antwortAn: m.antwortAn,
            html: '<div style="font-family:Arial;font-size:16px">Wenn diese Mail ankommt, ist der Versand richtig eingerichtet.</div>',
          }
        );
        await speichereMail(env, { ...m, geprueft: new Date().toISOString() });
        return json({ ok: true, an });
      }

      /* ---- Ablefy-Konten ---- */
      case 'konto/anlegen': {
        if (!koerper.name || !koerper.schluessel || !koerper.secret) {
          return fehler('Name, Schlüssel und Secret werden alle drei gebraucht.');
        }
        // Erst prüfen, dann speichern — sonst liegen tote Zugangsdaten herum.
        const produkte = await ladeProdukte({
          key: koerper.schluessel.trim(),
          secret: koerper.secret.trim(),
        });
        const konto = await legeKontoAn(env, koerper);
        const webhookUrl = `${url.origin}/w/${konto.id}/${konto.webhookPfad}`;
        let webhook = null;
        let webhookFehler = null;
        try {
          webhook = await legeWebhookAn(
            { key: koerper.schluessel.trim(), secret: koerper.secret.trim() },
            { name: `Teilnahmebescheinigung (${konto.name})`, url: webhookUrl }
          );
        } catch (e) {
          webhookFehler = String(e.message || e);
        }
        const konten = await ladeKonten(env);
        const i = konten.findIndex((k) => k.id === konto.id);
        konten[i] = { ...konten[i], webhookId: webhook?.id ?? null, webhookUrl };
        await speichereKonten(env, konten);
        return json({
          ok: true,
          konto: oeffentlich(konten[i]),
          produkte,
          webhookUrl,
          webhookFehler,
        });
      }

      case 'konto/umbenennen': {
        const name = String(koerper.name || '').trim();
        if (!name) return fehler('Der Name darf nicht leer sein.');
        const konten = await ladeKonten(env);
        const i = konten.findIndex((k) => k.id === koerper.kontoId);
        if (i < 0) return fehler('Konto nicht gefunden.');
        konten[i] = { ...konten[i], name };
        await speichereKonten(env, konten);
        return json({ ok: true });
      }

      case 'konto/schluessel': {
        if (!koerper.schluessel || !koerper.secret) return fehler('Schlüssel und Secret werden beide gebraucht.');
        const konto = await ladeKonto(env, koerper.kontoId);
        if (!konto) return fehler('Konto nicht gefunden.');
        const produkte = await ladeProdukte({ key: koerper.schluessel.trim(), secret: koerper.secret.trim() });
        await ersetzeKontoZugang(env, konto.id, koerper);
        return json({ ok: true, produkte: produkte.length });
      }

      case 'konto/webhook-neu': {
        const konto = await ladeKonto(env, koerper.kontoId);
        if (!konto) return fehler('Konto nicht gefunden.');
        const zugang = await kontoZugang(env, konto);
        const webhookUrl = `${url.origin}/w/${konto.id}/${konto.webhookPfad}`;
        const webhook = await legeWebhookAn(zugang, {
          name: `Teilnahmebescheinigung (${konto.name})`,
          url: webhookUrl,
        });
        const konten = await ladeKonten(env);
        const i = konten.findIndex((k) => k.id === konto.id);
        konten[i] = { ...konten[i], webhookId: webhook.id, webhookUrl };
        await speichereKonten(env, konten);
        return json({ ok: true, webhookUrl });
      }

      case 'konto/produkte': {
        const konto = await ladeKonto(env, url.searchParams.get('kontoId'));
        if (!konto) return fehler('Konto nicht gefunden.');
        return json({ produkte: await ladeProdukte(await kontoZugang(env, konto)) });
      }

      case 'konto/gesehen': {
        // Zuletzt gesehen (14 Tage, mit Zeit) plus alles, was je gemeldet wurde —
        // so bleibt die Liste auch nach Wochen ohne Quiz nicht leer.
        const kontoId = url.searchParams.get('kontoId');
        const produktId = url.searchParams.get('produktId');
        const gesehen = await ladeGesehen(env, kontoId);
        const liste = gesehen.filter((g) => !produktId || String(g.produktId) === String(produktId));
        if (produktId) {
          for (const b of await ladeBekannt(env, kontoId, produktId)) {
            const da = liste.find((g) => String(g.quizId) === String(b.id));
            if (da) { if (!da.quizName) da.quizName = b.name; continue; }
            liste.push({ quizId: b.id, quizName: b.name, produktId, produktName: '', pflicht: b.pflicht, zeit: null, zuerst: b.zuerst });
          }
        }
        // Als Abschlussquiz markierte Quizze kennen ihren Namen auch
        for (const k of await ladeKurse(env)) {
          for (const q of k.quizze) {
            const da = liste.find((g) => String(g.quizId) === String(q.id));
            if (da && !da.quizName) da.quizName = q.name;
          }
        }
        return json({ gesehen: liste });
      }

      case 'kurs/warnung': {
        const kurse = await ladeKurse(env);
        const i = kurse.findIndex((k) => k.id === koerper.id);
        if (i < 0) return fehler('Kurs nicht gefunden.');
        const w = await ladeQuizWarnung(env, kurse[i].id);
        if (koerper.uebernehmen && w) {
          const q = kurse[i].quizze;
          const j = q.findIndex((x) => String(x.id) === String(w.ersetzt));
          const neu = { id: String(w.quizId), name: w.quizName || '' };
          if (j >= 0) q[j] = neu; else q.push(neu);
          await speichereKurse(env, kurse);
        }
        await setzeQuizWarnung(env, kurse[i].id, null);
        return json({ ok: true, kurs: kurse[i] });
      }

      case 'konto/pruefen': {
        const konto = await ladeKonto(env, koerper.kontoId);
        if (!konto) return fehler('Konto nicht gefunden.');
        const zugang = await kontoZugang(env, konto);
        const webhooks = await ladeWebhooks(zugang);
        const url_ = konto.webhookUrl;
        const gefunden = webhooks.some((w) => String(w.url || '') === String(url_));
        return json({ ok: true, webhookVorhanden: gefunden, anzahl: webhooks.length });
      }

      case 'konto/loeschen': {
        const kurse = await ladeKurse(env);
        if (kurse.some((k) => k.kontoId === koerper.kontoId)) {
          return fehler('An diesem Konto hängen noch Kurse. Erst die Kurse entfernen.');
        }
        const konto = await ladeKonto(env, koerper.kontoId);
        if (!konto) return fehler('Konto nicht gefunden.');
        // Den Webhook bei Ablefy mitnehmen — sonst schickt Ablefy weiter
        // Meldungen an eine Adresse, die niemand mehr annimmt.
        let webhookEntfernt = false;
        if (konto.webhookId) {
          try {
            webhookEntfernt = await loescheWebhook(await kontoZugang(env, konto), konto.webhookId);
          } catch {
            webhookEntfernt = false; // z. B. keine Zugangsdaten nach einer Wiederherstellung
          }
        }
        await speichereKonten(env, (await ladeKonten(env)).filter((k) => k.id !== koerper.kontoId));
        return json({ ok: true, webhookEntfernt, hatteWebhook: Boolean(konto.webhookId), name: konto.name });
      }

      /* ---- Kurse ---- */
      case 'kurs/anlegen': {
        const konto = await ladeKonto(env, koerper.kontoId);
        if (!konto) return fehler('Erst ein Ablefy-Konto verbinden.');
        const kurse = await ladeKurse(env);
        const kurs = neuerKurs(konto.id);
        kurs.mailText = STANDARDTEXT;
        kurse.push(kurs);
        await speichereKurse(env, kurse);
        return json({ ok: true, kurs });
      }

      case 'kurs/speichern': {
        const kurse = await ladeKurse(env);
        const i = kurse.findIndex((k) => k.id === koerper.kurs?.id);
        if (i < 0) return fehler('Kurs nicht gefunden.');
        // Kennung, Konto und Unterschrift-Zustand kommen nie aus dem Formular.
        const { id, kontoId, hatUnterschrift, angelegt, letzterProbelauf, quizId, quizName, ...aenderung } = koerper.kurs || {};
        if (aenderung.quizze !== undefined && !Array.isArray(aenderung.quizze)) return fehler('Abschlussquizze müssen eine Liste sein.');
        const zusammen = normalisiereKurs({ ...kurse[i], ...aenderung });
        for (const f of ['absenderMail', 'antwortAn', 'testEmpfaenger']) {
          if (zusammen[f] && !istMail(zusammen[f])) return fehler(`„${zusammen[f]}“ sieht nicht nach einer E-Mail-Adresse aus.`);
        }
        const doppelt = kurse.find(
          (k, j) =>
            j !== i &&
            k.kontoId === zusammen.kontoId &&
            zusammen.produktId &&
            String(k.produktId) === String(zusammen.produktId) &&
            k.quizze.some((q) => zusammen.quizze.some((z) => String(z.id) === String(q.id)))
        );
        if (doppelt) {
          return fehler(
            `Dieses Abschlussquiz ist schon dem Kurs „${doppelt.titel || doppelt.produktName || 'ohne Titel'}“ zugeordnet. Zwei Kurse mit demselben Quiz würden zwei Bescheinigungen verschicken.`
          );
        }
        const mail = await ladeMail(env);
        const mangel = pruefeKurs(zusammen, mail);
        if (zusammen.aktiv && mangel.length) {
          return fehler('Für die Freigabe fehlt noch: ' + mangel.join(', '));
        }
        if (zusammen.aktiv && zusammen.testmodus && !zusammen.testEmpfaenger && !mail.warnAn) {
          return fehler('Im Testmodus braucht es eine Testadresse, an die die Bescheinigungen gehen.');
        }
        kurse[i] = zusammen;
        await speichereKurse(env, kurse);
        return json({ ok: true, kurs: kurse[i], mangel });
      }

      case 'kurs/loeschen': {
        await speichereKurse(env, (await ladeKurse(env)).filter((k) => k.id !== koerper.id));
        return json({ ok: true });
      }

      case 'kurs/unterschrift': {
        const kurse = await ladeKurse(env);
        const i = kurse.findIndex((k) => k.id === koerper.id);
        if (i < 0) return fehler('Kurs nicht gefunden.');
        if (koerper.entfernen) {
          kurse[i].hatUnterschrift = false;
          await speichereKurse(env, kurse);
          return json({ ok: true, hatUnterschrift: false });
        }
        const roh = String(koerper.datenUrl || '');
        if (!roh.startsWith('data:image/png')) {
          return fehler('Die Unterschrift muss ein PNG mit durchsichtigem Hintergrund sein.');
        }
        const bytes = Uint8Array.from(atob(roh.split(',')[1] || ''), (c) => c.charCodeAt(0));
        if (bytes.length > 300000) return fehler('Das Bild ist zu groß. Bitte unter 300 KB.');
        await speichereUnterschrift(env, kurse[i].id, bytes);
        kurse[i].hatUnterschrift = true;
        await speichereKurse(env, kurse);
        return json({ ok: true, hatUnterschrift: true });
      }

      /* ---- Probelauf und Nachholen ---- */
      case 'kurs/probelauf': {
        const kurs = await ladeKurs(env, koerper.id);
        if (!kurs) return fehler('Kurs nicht gefunden.');
        if (!koerper.orderToken) return fehler('Es fehlt eine Bestellnummer aus Ablefy.');
        const e = await stelleAus(env, kurs, String(koerper.orderToken).trim(), { trocken: true });
        if (e.ergebnis !== 'probelauf') return json({ ok: false, ...e, pdf: undefined });
        const vorschau = baueText(kurs.mailText, {
          vorname: (e.name || '').split(' ')[0],
          nachname: (e.name || '').split(' ').slice(1).join(' '),
          kurs: kurs.titel,
          anbieter: kurs.anbieterName,
        });
        // Merken, dass der Probelauf einmal geklappt hat — der Assistent fragt danach.
        const kurse = await ladeKurse(env);
        const i = kurse.findIndex((k) => k.id === kurs.id);
        if (i >= 0) {
          kurse[i].letzterProbelauf = new Date().toISOString();
          await speichereKurse(env, kurse);
        }
        const absender = absenderFuerKurs(await ladeMail(env), kurs);
        return json({
          ok: true,
          an: e.an,
          name: e.name,
          gebuehr: e.gebuehr,
          mailBetreff: kurs.betreff,
          mailText: vorschau,
          absender,
          pdf: pdfNachBase64(e.pdf),
        });
      }

      case 'kurs/nachholen': {
        const kurs = await ladeKurs(env, koerper.id);
        if (!kurs) return fehler('Kurs nicht gefunden.');
        const token = String(koerper.orderToken || '').trim();
        if (!token) return fehler('Es fehlt eine Bestellnummer.');
        if (koerper.erneut) await loescheSperre(env, kurs.id, token);
        const e = await stelleAus(env, kurs, token, { trocken: false });
        return json({ ok: e.ergebnis.includes('verschickt'), ...e, pdf: undefined });
      }

      default:
        return fehler('unbekannter Aufruf', 404);
    }
  } catch (e) {
    return fehler(String(e?.message || e), 500);
  }
}

/* ------------------------------------------------------------------ *
 * Übersicht und Vollständigkeitsprüfung
 * ------------------------------------------------------------------ */

/** Konto ohne die verschlüsselten Zugangsdaten. */
const oeffentlich = (k) => ({
  id: k.id,
  name: k.name,
  webhookUrl: k.webhookUrl,
  webhookId: k.webhookId,
  angelegt: k.angelegt,
  zugangGeaendert: k.zugangGeaendert || null,
  hatZugang: Boolean(k.schluesselEnc && k.secretEnc),
});

/** Was einem Kurs noch fehlt, bevor er scharf geschaltet werden darf. */
export function pruefeKurs(k, mail) {
  const fehlt = [];
  if (!k.produktId) fehlt.push('das Ablefy-Produkt');
  if (!k.quizze || !k.quizze.length) fehlt.push('das Abschlussquiz');
  if (!k.titel) fehlt.push('der Titel der Maßnahme');
  if (!k.zppKursId) fehlt.push('die ZPP-Kurs-ID');
  if (!k.praeventionsprinzip) fehlt.push('das Präventionsprinzip');
  if (!k.anbieterName) fehlt.push('der Anbietername');
  if (!k.anbieterAdresse) fehlt.push('die Anschrift');
  if (!k.ort) fehlt.push('der Ausstellungsort');
  const absender = absenderFuerKurs(mail || {}, k);
  // Bei Hostinger ist der Absender immer das Postfach — da braucht es keine Adresse.
  if (mail?.anbieter !== 'hostinger' && !absender.absenderMail) {
    fehlt.push(absender.quelle === 'standard' ? 'die Standard-Absenderadresse im Mailversand' : 'die Absenderadresse');
  }
  if (!k.hatUnterschrift && !k.unterschriftName) fehlt.push('die Unterschrift');
  return fehlt;
}

async function uebersicht(env, url) {
  const [konten, kurse, mail, protokoll, offen, einstellungen, eigenesPasswort] = await Promise.all([
    ladeKonten(env),
    ladeKurse(env),
    ladeMail(env),
    ladeProtokoll(env, 60),
    ladeOffen(env),
    ladeEinstellungen(env),
    hatEigenesPasswort(env),
  ]);

  const kontenMitPuls = [];
  for (const k of konten) {
    kontenMitPuls.push({
      ...oeffentlich(k),
      letzterEmpfang: await ladePuls(env, k.id),
      webhookUrl: k.webhookUrl || `${url.origin}/w/${k.id}/${k.webhookPfad}`,
    });
  }

  return {
    version: VERSION,
    adresse: url.origin,
    eigenesPasswort,
    einstellungen,
    mail: {
      anbieter: mail.anbieter || '',
      hatToken: Boolean(mail.tokenEnc),
      mailboxId: mail.mailboxId || '',
      warnAn: mail.warnAn || '',
      absenderName: mail.absenderName || '',
      absenderMail: mail.absenderMail || '',
      antwortAn: mail.antwortAn || '',
      standardFuerKurse: Boolean(mail.standardFuerKurse),
      geprueft: mail.geprueft || null,
    },
    konten: kontenMitPuls,
    kurse: await Promise.all(
      kurse.map(async (k) => ({
        ...k,
        mangel: pruefeKurs(k, mail),
        absender: absenderFuerKurs(mail, k),
        quizZuletzt: await ladeQuizPuls(env, k.id),
        quizWarnung: await ladeQuizWarnung(env, k.id),
      }))
    ),
    protokoll,
    offen,
    standardtext: STANDARDTEXT,
    schritte: {
      mail: Boolean(mail.anbieter && mail.tokenEnc && mail.geprueft),
      konto: konten.length > 0,
      kurs: kurse.length > 0,
      scharf: kurse.some((k) => k.aktiv),
    },
  };
}
