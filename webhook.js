/**
 * Webhook-Empfang und Versand der Bescheinigung.
 *
 * Ablefy schickt x-www-form-urlencoded mit Rails-Klammern (payer[email]).
 * Ausgewertet werden nur die flachen Felder plus payer[...].
 *
 * Ablefy signiert seine Webhooks nicht. Der einzige Schutz ist der geheime
 * Pfad in der Adresse, der je Ablefy-Konto neu gewürfelt wird.
 */

import {
  ladeKonto,
  ladeKurse,
  findeKurs,
  kontoZugang,
  ladeMail,
  ladeUnterschrift,
  protokolliere,
  merkeQuiz,
  merkePuls,
  schonVerschickt,
  merkeVerschickt,
  loescheSperre,
  ladeKurs,
  merkeOffen,
  ladeOffen,
  loescheOffen,
  entschluessle,
  absenderFuerKurs,
  merkeBekannt,
  merkeQuizPuls,
  setzeQuizWarnung,
  ladeQuizWarnung,
  merkeBestanden,
  ladeBestanden,
  gleicherName,
} from './store.js';
import { ladeBestellung, nameAusBestellung, gebuehrAusBestellung, formatiereEuro } from './ablefy.js';
import { baueBescheinigung, dateiname } from './zertifikat.js';
import { sendeMail, baueHtml, esc } from './mail.js';
import { leseFelder } from './felder.js';

/**
 * Einstiegspunkt aus dem Router. Antwortet Ablefy sofort mit 200 und
 * arbeitet danach weiter — ein langsamer Webhook wird sonst wiederholt.
 */
export async function empfangeWebhook(env, ctx, kontoId, pfad, request) {
  const konto = await ladeKonto(env, kontoId);
  if (!konto || konto.webhookPfad !== pfad) {
    return new Response('nicht gefunden', { status: 404 });
  }
  const text = await request.text();
  ctx.waitUntil(verarbeite(env, konto, leseFelder(text)));
  return new Response('ok');
}

async function verarbeite(env, konto, f) {
  await merkePuls(env, konto.id);
  if (f.event !== 'quiz.answered') return;

  const quizName = f.lesson_name || f.quiz_name || '';
  const pflicht = String(f.required_to_proceed) === 'true';

  // Immer merken — daraus baut die Oberfläche die Liste "Zuletzt gesehen",
  // aus der der Betreiber sein Abschlussquiz auswählt.
  await merkeQuiz(env, konto.id, {
    quizId: f.quiz_id,
    quizName,
    produktId: f.product_id,
    produktName: f.course_name || '',
    pflicht,
  });

  const kurse = await ladeKurse(env);

  // Wächter: eine Quiz-Kennung, die dieses Produkt noch nie gemeldet hat.
  // Trägt sie denselben Lektionsnamen wie das eingestellte Abschlussquiz eines
  // Kurses, wurde das Quiz in Ablefy vermutlich neu angelegt — dann würde ab
  // jetzt still keine Bescheinigung mehr rausgehen.
  const neu = await merkeBekannt(env, konto.id, f.product_id, { id: f.quiz_id, name: quizName, pflicht });
  if (neu) {
    for (const k of kurse) {
      if (k.kontoId !== konto.id || String(k.produktId) !== String(f.product_id)) continue;
      if (k.quizze.some((q) => String(q.id) === String(f.quiz_id))) continue;
      const doppelgaenger = k.quizze.find((q) => gleicherName(q.name, quizName));
      if (!doppelgaenger) continue;
      const schon = await ladeQuizWarnung(env, k.id);
      if (schon && String(schon.quizId) === String(f.quiz_id)) continue;
      await setzeQuizWarnung(env, k.id, {
        quizId: String(f.quiz_id),
        quizName,
        ersetzt: doppelgaenger.id,
      });
      await protokolliere(env, {
        kurs: k.id,
        kursName: k.titel || k.produktName,
        ergebnis: 'prüfen',
        grund: `Neues Quiz „${quizName}“ (Kennung ${f.quiz_id}) — gleicher Lektionsname wie das eingestellte Abschlussquiz. Neu angelegt?`,
        order: f.order_token || '-',
      });
      await warneQuiz(env, k, quizName, f.quiz_id);
    }
  }

  const kurs = findeKurs(kurse, konto.id, f.product_id, f.quiz_id);
  if (!kurs) return; // gehört zu keinem eingerichteten Kurs
  await merkeQuizPuls(env, kurs.id);
  if (!kurs.aktiv) {
    await protokolliere(env, {
      kurs: kurs.id,
      kursName: kurs.titel || kurs.produktName,
      ergebnis: 'angehalten',
      grund: 'Kurs ist nicht freigegeben',
      order: f.order_token || '-',
    });
    return;
  }

  // Bewusst NICHT quiz_passed auswerten: das Feld stand in Tests auf false,
  // obwohl die volle Punktzahl erreicht war. Die Punkte sind eindeutig.
  const erreicht = Number(f.points_gained);
  const noetig = Number(f.points_to_pass);
  if (!Number.isFinite(erreicht) || !Number.isFinite(noetig) || erreicht < noetig) {
    await protokolliere(env, {
      kurs: kurs.id,
      kursName: kurs.titel || kurs.produktName,
      ergebnis: 'nicht bestanden',
      punkte: `${f.points_gained}/${f.points_to_pass}`,
      order: f.order_token || '-',
    });
    return;
  }

  // Mehrere Abschlussquizze: erst ausstellen, wenn alle bestanden sind.
  if (kurs.quizze.length > 1 && f.order_token) {
    await merkeBestanden(env, kurs.id, f.order_token, f.quiz_id);
    const bestanden = await ladeBestanden(env, kurs.id, f.order_token);
    const fehlt = kurs.quizze.filter((q) => !bestanden.includes(String(q.id)));
    if (fehlt.length) {
      await protokolliere(env, {
        kurs: kurs.id,
        kursName: kurs.titel || kurs.produktName,
        ergebnis: 'teilweise',
        grund: `${kurs.quizze.length - fehlt.length} von ${kurs.quizze.length} Abschlussquizzen bestanden, es fehlt: ${fehlt.map((q) => q.name || q.id).join(', ')}`,
        order: f.order_token,
      });
      return;
    }
  }

  const ergebnis = await stelleAus(env, kurs, f.order_token, { trocken: false });
  await protokolliere(env, {
    kurs: kurs.id,
    kursName: kurs.titel || kurs.produktName,
    order: f.order_token || '-',
    ...ergebnis,
  });
  if (ergebnis.ergebnis === 'fehler') {
    // Vorübergehende Störung: erneut versuchen statt aufgeben.
    await merkeOffen(env, kurs.id, f.order_token, ergebnis.grund, 1);
  }
  if (ergebnis.ergebnis === 'angehalten' || ergebnis.ergebnis === 'fehler') {
    await warne(env, kurs, ergebnis, f.order_token);
  }
}

/* ------------------------------------------------------------------ *
 * Bescheinigung bauen und verschicken
 * ------------------------------------------------------------------ */

/**
 * @returns {{ergebnis:string, grund?:string, an?:string, name?:string,
 *            gebuehr?:number, pdf?:Uint8Array}}
 */
export async function stelleAus(env, kurs, orderToken, { trocken = false } = {}) {
  try {
    if (!orderToken) return { ergebnis: 'übersprungen', grund: 'keine Bestellnummer im Webhook' };

    // Im Testmodus wird nichts gesperrt — der Betreiber soll beliebig oft üben können.
    if (!trocken && !kurs.testmodus && (await schonVerschickt(env, kurs.id, orderToken))) {
      return { ergebnis: 'übersprungen', grund: 'für diese Bestellung schon verschickt' };
    }

    const konto = await ladeKonto(env, kurs.kontoId);
    if (!konto) return { ergebnis: 'fehler', grund: 'Ablefy-Konto nicht mehr vorhanden' };
    const zugang = await kontoZugang(env, konto);
    const order = await ladeBestellung(zugang, orderToken);

    const empfaenger = order?.payer?.email;
    if (!empfaenger) {
      return { ergebnis: 'angehalten', grund: 'an der Bestellung hängt keine E-Mail-Adresse' };
    }
    if (order?.payment_state && order.payment_state !== 'paid') {
      return { ergebnis: 'übersprungen', grund: `Zahlungsstatus ist ${order.payment_state}` };
    }

    const person = nameAusBestellung(order);
    if (!person || !person.vorname) {
      return { ergebnis: 'angehalten', grund: 'an der Bestellung steht kein Name' };
    }

    // Die Gebühr steht auf einem Dokument für die Krankenkasse. Ein geratener
    // Betrag wäre schlimmer als eine verspätete Bescheinigung.
    const gebuehr = gebuehrAusBestellung(order);
    if (gebuehr === null) {
      return { ergebnis: 'angehalten', grund: 'die gezahlte Gebühr ist nicht ermittelbar' };
    }
    const mindest = Number(kurs.mindestGebuehr ?? 0.01);
    if (!kurs.testmodus && gebuehr < mindest) {
      return {
        ergebnis: 'angehalten',
        grund: `nur ${formatiereEuro(gebuehr)} € gezahlt, Mindestbetrag ist ${formatiereEuro(mindest)} € — vermutlich ein Testzugang`,
      };
    }

    const von = new Date(order.access_activated_at || order.created_at || Date.now());
    const bis = new Date();
    const unterschrift = kurs.hatUnterschrift ? await ladeUnterschrift(env, kurs.id) : null;

    const pdf = await baueBescheinigung(
      kurs,
      {
        vorname: person.vorname,
        nachname: person.nachname,
        von,
        bis,
        gebuehr: formatiereEuro(gebuehr),
      },
      unterschrift
    );

    if (trocken) {
      return {
        ergebnis: 'probelauf',
        an: empfaenger,
        name: `${person.vorname} ${person.nachname}`.trim(),
        gebuehr,
        pdf,
      };
    }

    const versand = await versandKonf(env);
    const absender = absenderFuerKurs(versand, kurs);
    const anEcht = kurs.testmodus ? kurs.testEmpfaenger || versand.warnAn : empfaenger;
    if (!anEcht) {
      return { ergebnis: 'angehalten', grund: 'im Testmodus fehlt die Adresse, an die geschickt werden soll' };
    }

    // Erst sperren, dann senden: lieber eine zu wenig als zwei zu viel.
    if (!kurs.testmodus) await merkeVerschickt(env, kurs.id, orderToken);

    const werte = {
      vorname: person.vorname,
      nachname: person.nachname,
      kurs: kurs.titel,
      anbieter: kurs.anbieterName,
    };

    try {
      await sendeMail(versand, {
      an: anEcht,
      betreff: (kurs.testmodus ? '[TEST] ' : '') + kurs.betreff,
      html:
        (kurs.testmodus
          ? `<p style="background:#fff3cd;border:1px solid #e0b400;padding:10px;font-family:Arial;font-size:14px">Testmodus. Diese Mail wäre an <strong>${esc(empfaenger)}</strong> gegangen.</p>`
          : '') + baueHtml(kurs.mailText, werte),
      absenderName: absender.absenderName,
      absenderMail: absender.absenderMail,
      antwortAn: absender.antwortAn,
      anhang: { name: dateiname(person.vorname, person.nachname), bytes: pdf },
      });
    } catch (e) {
      // Der Versand ist gescheitert, die Bescheinigung ist also NICHT draußen.
      // Sperre wieder lösen, sonst blockiert sie jeden weiteren Versuch.
      if (!kurs.testmodus) await loescheSperre(env, kurs.id, orderToken);
      throw e;
    }

    return {
      ergebnis: kurs.testmodus ? 'test verschickt' : 'verschickt',
      an: anEcht,
      name: `${person.vorname} ${person.nachname}`.trim(),
      gebuehr,
    };
  } catch (e) {
    return { ergebnis: 'fehler', grund: String(e?.message || e) };
  }
}

async function versandKonf(env) {
  const m = await ladeMail(env);
  return {
    anbieter: m.anbieter,
    token: await entschluessle(env, m.tokenEnc),
    mailboxId: m.mailboxId,
    warnAn: m.warnAn,
    absenderName: m.absenderName,
    absenderMail: m.absenderMail,
    antwortAn: m.antwortAn,
    standardFuerKurse: m.standardFuerKurse,
  };
}

/** Betreiber benachrichtigen, wenn eine Bescheinigung NICHT rausgegangen ist. */
async function warne(env, kurs, ergebnis, orderToken) {
  try {
    const versand = await versandKonf(env);
    if (!versand.warnAn || !versand.anbieter) return;
    await sendeMail(versand, {
      an: versand.warnAn,
      betreff: `[Bescheinigung] Nicht verschickt: ${kurs.titel}`,
      absenderName: versand.absenderName || absenderFuerKurs(versand, kurs).absenderName,
      absenderMail: versand.absenderMail || absenderFuerKurs(versand, kurs).absenderMail,
      html: `<div style="font-family:Arial;font-size:15px;line-height:1.6">
  <p>Für den Kurs <strong>${esc(kurs.titel)}</strong> wurde <strong>keine</strong> Bescheinigung verschickt.</p>
  <p>Grund: ${esc(ergebnis.grund || 'unbekannt')}</p>
  <p>Bestellnummer: <code>${esc(orderToken || '-')}</code></p>
  <p>Nach dem Beheben lässt sich die Bescheinigung in der Oberfläche unter „Nachholen“ mit dieser Bestellnummer erneut auslösen.</p>
</div>`,
    });
  } catch {
    /* Wenn nicht mal die Warnung rausgeht, bleibt das Protokoll. */
  }
}

/** Betreiber benachrichtigen, wenn ein Quiz mit gleichem Lektionsnamen neu auftaucht. */
async function warneQuiz(env, kurs, quizName, quizId) {
  try {
    const versand = await versandKonf(env);
    if (!versand.warnAn || !versand.anbieter) return;
    await sendeMail(versand, {
      an: versand.warnAn,
      betreff: `[Bescheinigung] Bitte prüfen: neues Quiz in ${kurs.titel}`,
      absenderName: versand.absenderName || absenderFuerKurs(versand, kurs).absenderName,
      absenderMail: versand.absenderMail || absenderFuerKurs(versand, kurs).absenderMail,
      html: `<div style="font-family:Arial;font-size:15px;line-height:1.6">
  <p>Im Kurs <strong>${esc(kurs.titel)}</strong> wurde gerade ein Quiz beantwortet, das das Programm noch nie gesehen hat: <strong>${esc(quizName)}</strong> (Kennung ${esc(quizId)}).</p>
  <p>Es trägt denselben Lektionsnamen wie das eingestellte Abschlussquiz. Das passiert, wenn das Quiz in Ablefy neu angelegt wurde — dann bekommt es eine neue Kennung, und <strong>ab jetzt würde keine Bescheinigung mehr verschickt</strong>.</p>
  <p>In der Oberfläche steht auf der Übersicht ein Hinweis mit zwei Knöpfen: <em>Neues Quiz übernehmen</em>, wenn es wirklich das neue Abschlussquiz ist — oder <em>Ignorieren</em>, wenn alles seine Richtigkeit hat.</p>
</div>`,
    });
  } catch {
    /* Protokoll und Hinweis in der Oberfläche bleiben. */
  }
}

/* ------------------------------------------------------------------ *
 * Wiederholung
 *
 * Läuft alle 15 Minuten. Nimmt sich, was beim ersten Mal an einer
 * vorübergehenden Störung gescheitert ist, und versucht es erneut.
 * Nach acht vergeblichen Versuchen — gut zwei Stunden — wird aufgegeben
 * und gemeldet, damit niemand auf eine stille Schleife vertraut.
 * ------------------------------------------------------------------ */

const HOECHSTVERSUCHE = 8;

export async function wiederhole(env) {
  const offen = await ladeOffen(env);
  for (const eintrag of offen) {
    const kurs = await ladeKurs(env, eintrag.kursId);
    if (!kurs) {
      await loescheOffen(env, eintrag.kursId, eintrag.orderToken);
      continue;
    }

    const ergebnis = await stelleAus(env, kurs, eintrag.orderToken, { trocken: false });
    const versuche = Number(eintrag.versuche || 1) + 1;

    if (String(ergebnis.ergebnis).includes('verschickt') || ergebnis.ergebnis === 'übersprungen') {
      await loescheOffen(env, eintrag.kursId, eintrag.orderToken);
      await protokolliere(env, {
        kurs: kurs.id,
        kursName: kurs.titel || kurs.produktName,
        order: eintrag.orderToken,
        ergebnis: ergebnis.ergebnis === 'übersprungen' ? 'übersprungen' : 'verschickt',
        grund: ergebnis.ergebnis === 'übersprungen' ? ergebnis.grund : `nach ${versuche}. Versuch`,
        an: ergebnis.an,
      });
      continue;
    }

    if (ergebnis.ergebnis === 'fehler' && versuche <= HOECHSTVERSUCHE) {
      await merkeOffen(env, eintrag.kursId, eintrag.orderToken, ergebnis.grund, versuche);
      continue;
    }

    // Endgültig: entweder fehlt eine Angabe, oder es klappt seit Stunden nicht.
    await loescheOffen(env, eintrag.kursId, eintrag.orderToken);
    await protokolliere(env, {
      kurs: kurs.id,
      kursName: kurs.titel || kurs.produktName,
      order: eintrag.orderToken,
      ergebnis: 'aufgegeben',
      grund: ergebnis.grund,
    });
    await warne(env, kurs, ergebnis, eintrag.orderToken);
  }
  return offen.length;
}
