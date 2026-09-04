/**
 * Mailversand.
 *
 * Ein Cloudflare Worker kann kein SMTP. Der Versand läuft deshalb über einen
 * Anbieter mit HTTP-Schnittstelle. Unterstützt sind zwei:
 *
 *   resend     — der Regelfall. Ein Schlüssel, beliebig viele verifizierte
 *                Absenderdomains. Absenderadresse steht am Kurs.
 *   hostinger  — für Postfächer bei Hostinger. Absender ist dann immer das
 *                Postfach, zu dem der Token gehört.
 */

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function zuBase64(bytes) {
  let bin = '';
  const a = new Uint8Array(bytes);
  for (let i = 0; i < a.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

import { VERSION, PROGRAMM } from './version.js';

const AGENT = `${PROGRAMM}/${VERSION}`;

let RESEND = 'https://api.resend.com/emails';
let HOSTINGER = 'https://api.mail.hostinger.com/api/v1/mailboxes';

/** Nur für Tests: Versanddienste auf einen Nachbau umbiegen. */
export function setzeMailBasis({ resend, hostinger } = {}) {
  if (resend) RESEND = resend;
  if (hostinger) HOSTINGER = hostinger;
}

/**
 * @param {{anbieter:string, token:string, mailboxId?:string}} versand
 * @param {{an:string, betreff:string, html:string, absenderName?:string,
 *          absenderMail?:string, antwortAn?:string,
 *          anhang?:{name:string, bytes:Uint8Array}}} mail
 */
export async function sendeMail(versand, mail) {
  if (!versand?.anbieter) throw new Error('Es ist kein Mailversand eingerichtet.');
  if (versand.anbieter === 'resend') return sendeResend(versand, mail);
  if (versand.anbieter === 'hostinger') return sendeHostinger(versand, mail);
  throw new Error(`Unbekannter Mailanbieter: ${versand.anbieter}`);
}

async function sendeResend(versand, mail) {
  if (!mail.absenderMail) {
    throw new Error('Für diesen Kurs ist keine Absenderadresse hinterlegt.');
  }
  const from = mail.absenderName
    ? `${mail.absenderName.replace(/["<>]/g, '')} <${mail.absenderMail}>`
    : mail.absenderMail;

  const body = {
    from,
    to: [mail.an],
    subject: mail.betreff,
    html: mail.html,
  };
  if (mail.antwortAn) body.reply_to = mail.antwortAn;
  if (mail.anhang) {
    body.attachments = [{ filename: mail.anhang.name, content: zuBase64(mail.anhang.bytes) }];
  }

  const res = await fetch(RESEND, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${versand.token}`,
      'Content-Type': 'application/json',
      'User-Agent': AGENT,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = (await res.text()).slice(0, 400);
    if (res.status === 403 && /domain/i.test(text)) {
      throw new Error(
        `Resend nimmt die Absenderadresse ${mail.absenderMail} nicht an. Die Domain ist dort noch nicht verifiziert. Antwort: ${text}`
      );
    }
    throw new Error(`Mailversand fehlgeschlagen (${res.status}): ${text}`);
  }
}

async function sendeHostinger(versand, mail) {
  if (!versand.mailboxId) throw new Error('Für Hostinger fehlt die Postfach-Kennung.');
  const payload = {
    to: [mail.an],
    displayName: mail.absenderName || undefined,
    subject: mail.betreff,
    html: mail.html,
  };
  if (mail.anhang) {
    payload.attachments = [
      {
        filename: mail.anhang.name,
        content: zuBase64(mail.anhang.bytes),
        contentType: 'application/pdf',
      },
    ];
  }

  const res = await fetch(
    `${HOSTINGER}/${versand.mailboxId}/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${versand.token}`,
        'Content-Type': 'application/json',
        // Ohne eigenen User-Agent antwortet Cloudflare vor der API mit 1010.
        'User-Agent': AGENT,
      },
      body: JSON.stringify(payload),
    }
  );
  if (res.status !== 204 && !res.ok) {
    throw new Error(`Mailversand fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

/* ------------------------------------------------------------------ *
 * Der Text der Bescheinigungsmail
 * ------------------------------------------------------------------ */

/**
 * Vorgabetext. Der Betreiber kann ihn je Kurs überschreiben.
 * Platzhalter: {vorname} {nachname} {kurs} {anbieter}
 */
export const STANDARDTEXT = `Hallo {vorname},

Sie haben den Kurs „{kurs}" vollständig abgeschlossen. Herzlichen Glückwunsch.

Im Anhang finden Sie Ihre Teilnahmebescheinigung. Teil 1 ist bereits ausgefüllt und unterschrieben.

**So reichen Sie sie ein**
Füllen Sie Teil 2 aus: Ihr Geburtsdatum, die Versichertennummer von Ihrer Karte und Ihre IBAN. Unterschreiben und bei Ihrer Krankenkasse einreichen — bei den meisten geht das per App oder über das Online-Portal.

Bei Fragen antworten Sie einfach auf diese Mail.

Herzliche Grüße
{anbieter}`;

/** Platzhalter ersetzen und einfaches Markdown in HTML gießen. */
export function baueHtml(text, werte) {
  let t = String(text || STANDARDTEXT);
  for (const [k, v] of Object.entries(werte)) {
    t = t.replaceAll(`{${k}}`, String(v ?? ''));
  }

  const absaetze = esc(t)
    .split(/\n{2,}/)
    .map((block) => {
      const mitFett = block.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return `<p style="margin:0 0 16px 0;">${mitFett.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n  ');

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#222;font-size:16px;line-height:1.6;">
  ${absaetze}
</div>`;
}

/** Reine Textvorschau, wie sie in der Oberfläche gezeigt wird. */
export function baueText(text, werte) {
  let t = String(text || STANDARDTEXT);
  for (const [k, v] of Object.entries(werte)) t = t.replaceAll(`{${k}}`, String(v ?? ''));
  return t;
}
