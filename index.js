/**
 * Bescheinigungs-Worker — Einstiegspunkt.
 *
 *   /                     Bedienoberfläche
 *   /api/…                alles, was die Oberfläche aufruft
 *   /w/<konto>/<geheim>   der Webhook, den Ablefy anspricht
 *   /health               Lebenszeichen für die Überwachung
 *
 * Es gibt bewusst keine weiteren öffentlichen Adressen.
 */

import { adminApi } from './admin.js';
import { empfangeWebhook, wiederhole } from './webhook.js';
import oberflaeche from './admin.html';
import { VERSION } from './version.js';
import { setzeAblefyBasis } from './ablefy.js';
import { setzeMailBasis } from './mail.js';

/**
 * Nur für Tests: Wenn TEST_ABLEFY_BASIS oder TEST_RESEND_BASIS gesetzt sind
 * (lokal in .dev.vars), reden Ablefy-Zugriff und Mailversand mit einem
 * Nachbau statt mit den echten Diensten. Im Betrieb sind beide leer.
 */
function testziele(env) {
  setzeAblefyBasis(env.TEST_ABLEFY_BASIS);
  setzeMailBasis({ resend: env.TEST_RESEND_BASIS, hostinger: env.TEST_HOSTINGER_BASIS });
}

const html = (text, status = 200) =>
  new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });

const ERKLAERUNG_SECRET = {
  ADMIN_PASSWORT: 'Damit meldest du dich in dieser Oberfläche an. Ein Passwort deiner Wahl.',
  DATEN_SCHLUESSEL:
    'Damit verschlüsselt das Programm deine Ablefy-Schlüssel und den Mail-Token, bevor es sie speichert. Ein langes, ausgedachtes Wort, mindestens 30 Zeichen, zum Beispiel <code>Regenschirm-Kaktus-Fahrrad-Lampe-2026-Sommer</code>. <strong>Einmal setzen, nie wieder ändern</strong> — sonst kann das Programm die gespeicherten Zugangsdaten nicht mehr lesen.',
};

/**
 * Werte, die als Beispiel in .dev.vars.example standen oder offensichtlich
 * nur Platzhalter sind. Wer sie beim Installieren stehen lässt, hätte ein
 * Passwort, das öffentlich im Vorlagen-Verzeichnis steht.
 */
const BEISPIELWERTE = new Set([
  'hier-ein-eigenes-passwort',
  'hier-ein-langes-zufallswort-mindestens-30-zeichen',
  'hier-ein-passwort',
  'passwort',
  'password',
]);
const istUnbrauchbar = (wert) => !wert || BEISPIELWERTE.has(String(wert).trim().toLowerCase());

const HINWEIS_SEITE = (env) => {
  const fehlend = ['DATEN_SCHLUESSEL', 'ADMIN_PASSWORT'].filter((n) => istUnbrauchbar(env[n]));
  const beispiel = fehlend.filter((n) => env[n]);
  const zeilen = fehlend
    .map((n) => `<li style="margin-bottom:.8rem"><code style="font-size:1.05em;background:#f1f3f5;padding:.1em .4em;border-radius:4px">${n}</code><br>${ERKLAERUNG_SECRET[n]}</li>`)
    .join('');
  return `<!doctype html>
<html lang="de"><meta charset="utf-8">
<title>Einrichtung unvollständig</title>
<body style="font-family:system-ui,sans-serif;max-width:38rem;margin:3rem auto;padding:0 1.5rem;line-height:1.6;color:#222">
<h1 style="font-size:1.4rem">Fast fertig</h1>
<p>Das Programm läuft. ${fehlend.length === 1 ? 'Es fehlt noch ein Wert, der' : 'Es fehlen noch zwei Werte, die'} nur in deinem Cloudflare-Konto ${fehlend.length === 1 ? 'liegt' : 'liegen'} — Cloudflare nennt so etwas <em>Secret</em>:</p>
${beispiel.length ? `<p style="background:#fdf6e3;border:1px solid #e0b45c;border-radius:6px;padding:.6rem .9rem"><strong>${beispiel.join(' und ')}</strong> ${beispiel.length === 1 ? 'ist' : 'sind'} noch auf dem Beispielwert aus der Installation. Der steht öffentlich im Vorlagen-Verzeichnis und ist deshalb unbrauchbar — bitte durch ${beispiel.length === 1 ? 'einen eigenen Wert' : 'eigene Werte'} ersetzen.</p>` : ''}
<ul style="padding-left:1.2rem">${zeilen}</ul>
<h2 style="font-size:1.1rem;margin-top:1.6rem">So trägst du ${fehlend.length === 1 ? 'ihn' : 'sie'} ein</h2>
<ol style="padding-left:1.2rem">
<li>Im Cloudflare-Konto links <strong>Workers &amp; Pages</strong> → dieses Programm anklicken.</li>
<li>Oben Reiter <strong>Settings</strong> → der Abschnitt <strong>Variables and Secrets</strong> steht <strong>ganz oben</strong> auf der Seite → <strong>+ Add</strong>.<br><span style="color:#8a5a00">Nicht die gleichnamige Liste weit unten unter „Builds“ (bei <em>Branch control</em>, <em>Deploy Hooks</em>, Text „No build variables or secrets configured“) — die sieht das Programm nie.</span></li>
<li>Bei <em>Type</em> auf <strong>Secret</strong> stellen (nicht „Text“ oder „Variable“ — das wäre im Klartext sichtbar).</li>
<li><em>Variable name</em>: den Namen <strong>genau so</strong> wie oben — Großbuchstaben, Unterstrich, kein Umlaut. <em>Value</em>: der Wert.</li>
${fehlend.length === 2 ? '<li>Noch einmal <strong>Add</strong> für den zweiten Wert.</li>' : ''}
<li>Auf <strong>Save</strong> (in manchen Versionen <strong>Deploy</strong>) klicken.</li>
<li>Diese Seite neu laden. Erscheint sie immer noch, hat Cloudflare die Werte nur gespeichert, aber nicht eingeschaltet: Reiter <strong>Deployments</strong> → in der obersten Zeile der <em>Version History</em> („Add secret: …“) ganz rechts die <strong>drei Punkte (…)</strong> → <strong>Promote version</strong> → Seite erneut laden.</li>
</ol>
<p style="color:#555;font-size:.95em">Beide Werte in einen Passwortmanager legen — Cloudflare zeigt ein Secret nach dem Speichern nie wieder an.</p>
</body></html>`;
};

export default {
  /**
   * Alle 15 Minuten: was beim ersten Mal an einer vorübergehenden Störung
   * gescheitert ist, noch einmal versuchen. Ohne das ginge eine Bescheinigung
   * verloren, sobald der Mailanbieter für eine Minute nicht erreichbar ist.
   */
  async scheduled(event, env, ctx) {
    testziele(env);
    ctx.waitUntil(wiederhole(env));
  },

  async fetch(request, env, ctx) {
    testziele(env);
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, version: VERSION, zeit: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Webhook: /w/<kontoId>/<geheimer Pfad>
    const treffer = url.pathname.match(/^\/w\/([a-z0-9]+)\/([a-z0-9]+)$/);
    if (treffer) {
      if (request.method !== 'POST') return new Response('nur POST', { status: 405 });
      return empfangeWebhook(env, ctx, treffer[1], treffer[2], request);
    }

    // Ohne diese beiden Werte kann nichts sicher gespeichert werden.
    if (istUnbrauchbar(env.DATEN_SCHLUESSEL) || istUnbrauchbar(env.ADMIN_PASSWORT)) return html(HINWEIS_SEITE(env), 503);

    if (url.pathname.startsWith('/api/')) return adminApi(env, request, url);

    if (url.pathname === '/' || url.pathname === '/admin') return html(oberflaeche);

    return new Response('nicht gefunden', { status: 404 });
  },
};
