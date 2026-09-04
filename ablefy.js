/**
 * Zugriff auf die offizielle Ablefy-API.
 *
 * Auth läuft über key + secret als Abfrageparameter, bei POST im JSON-Body.
 * Keine Header, keine Signatur.
 *
 * Was es gibt: products, products/<id>, orders/<id>, webhook_endpoints.
 * Was es NICHT gibt: courses, lessons, quizzes. Deshalb lässt sich die
 * Quiz-Kennung nicht abfragen — sie wird über den Webhook gelernt.
 */

let BASIS = 'https://api.myablefy.com/api';

/** Nur für Tests: die Ablefy-Adresse auf einen Nachbau umbiegen. */
export function setzeAblefyBasis(url) {
  if (url) BASIS = String(url).replace(/\/$/, '');
}
import { VERSION, PROGRAMM } from './version.js';

const AGENT = `${PROGRAMM}/${VERSION}`;

async function hole(pfad, zugang, params = {}) {
  const url = new URL(`${BASIS}/${pfad}`);
  url.searchParams.set('key', zugang.key);
  url.searchParams.set('secret', zugang.secret);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Ablefy weist den Schlüssel ab. Schlüssel und Secret noch einmal prüfen.');
  }
  if (!res.ok) throw new Error(`Ablefy antwortet mit ${res.status} auf ${pfad}.`);
  return res.json();
}

/**
 * Aus einer Antwort die eigentliche Liste herausziehen. Ablefy liefert je nach
 * Endpunkt mal ein nacktes Array, mal ein Objekt mit der Liste darin.
 */
function alsListe(antwort) {
  if (Array.isArray(antwort)) return antwort;
  for (const feld of ['products', 'data', 'items', 'list', 'result', 'results']) {
    if (Array.isArray(antwort?.[feld])) return antwort[feld];
  }
  return [];
}

const ersterWert = (obj, felder) => {
  for (const f of felder) {
    const w = obj?.[f];
    if (w !== undefined && w !== null && String(w).trim() !== '') return String(w).trim();
  }
  return '';
};

/** Prüft die Zugangsdaten und liefert gleich die Produktliste mit. */
export async function ladeProdukte(zugang) {
  const antwort = await hole('products', zugang, { per: '100' });
  return alsListe(antwort)
    .map((p) => ({
      id: ersterWert(p, ['id', 'product_id']),
      name:
        ersterWert(p, ['name', 'internal_name', 'title', 'display_name']) ||
        `Produkt ${ersterWert(p, ['id'])}`,
      form: ersterWert(p, ['form', 'product_type', 'kind']),
    }))
    .filter((p) => p.id);
}

/** Bestellung über order_token oder Order-ID. */
export async function ladeBestellung(zugang, orderTokenOderId) {
  const order = await hole(`orders/${encodeURIComponent(orderTokenOderId)}`, zugang);
  // Ablefy antwortet auf unbekannte Kennungen mit 200 und einem leeren Objekt.
  if (!order || !order.order_id) {
    throw new Error(`Zu dieser Bestellnummer findet Ablefy nichts: ${orderTokenOderId}`);
  }
  return order;
}

/** Vor- und Nachname der zahlenden Person — bei Erwachsenenkursen die Teilnehmerin selbst. */
export function nameAusBestellung(order) {
  const v = (order?.payer?.first_name || '').trim();
  const n = (order?.payer?.last_name || '').trim();
  if (!v && !n) return null;
  return { vorname: v, nachname: n };
}

/** Tatsächlich gezahlter Bruttobetrag in Euro, oder null wenn nicht ermittelbar. */
export function gebuehrAusBestellung(order) {
  const roh = order?.order_amount_gross ?? order?.initial_order_amount_gross;
  if (roh === undefined || roh === null || roh === '') return null;
  const zahl = typeof roh === 'string' ? parseFloat(roh) : roh;
  return Number.isFinite(zahl) ? Math.round(zahl * 100) / 100 : null;
}

export const formatiereEuro = (betrag) => betrag.toFixed(2).replace('.', ',');

/**
 * Webhook bei Ablefy anlegen. Der so erzeugte Endpunkt hört auf alle Ereignisse
 * des Kontos; gefiltert wird bei uns. Genau das ist gewollt — dadurch bekommt
 * der Lernmodus auch Quizze zu sehen, die noch keinem Kurs zugeordnet sind.
 */
export async function legeWebhookAn(zugang, { name, url }) {
  const res = await fetch(`${BASIS}/webhook_endpoints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': AGENT },
    body: JSON.stringify({ key: zugang.key, secret: zugang.secret, name, url }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Ablefy konnte den Webhook nicht anlegen (${res.status}). Antwort: ${text.slice(0, 200)}`
    );
  }
  try {
    const daten = JSON.parse(text);
    return { id: daten.id ?? null, url: daten.url ?? url };
  } catch {
    return { id: null, url };
  }
}

/**
 * Webhook bei Ablefy löschen. Liefert true, wenn Ablefy das bestätigt hat,
 * sonst false — dann muss der Betreiber ihn in Ablefy von Hand entfernen.
 * Wirft nie: Das Konto soll hier auch dann entfernt werden können, wenn
 * Ablefy gerade nicht erreichbar ist oder den Schlüssel schon nicht mehr kennt.
 */
export async function loescheWebhook(zugang, id) {
  if (!id) return false;
  try {
    const res = await fetch(`${BASIS}/webhook_endpoints/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'User-Agent': AGENT },
      body: JSON.stringify({ key: zugang.key, secret: zugang.secret }),
    });
    if (res.ok) return true;
    // Manche Schnittstellen nehmen die Zugangsdaten bei DELETE nur als Parameter.
    const res2 = await fetch(
      `${BASIS}/webhook_endpoints/${encodeURIComponent(id)}?key=${encodeURIComponent(zugang.key)}&secret=${encodeURIComponent(zugang.secret)}`,
      { method: 'DELETE', headers: { 'User-Agent': AGENT } }
    );
    return res2.ok;
  } catch {
    return false;
  }
}

/** Vorhandene Webhooks des Kontos — für die Anzeige "ist er noch da?". */
export async function ladeWebhooks(zugang) {
  try {
    return alsListe(await hole('webhook_endpoints', zugang));
  } catch {
    return [];
  }
}
