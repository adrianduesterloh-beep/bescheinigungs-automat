/**
 * Nachbau von Ablefy-API und Resend für lokale Tests.
 *
 *   node werkzeuge/test-nachbau.mjs            → lauscht auf 127.0.0.1:8788
 *
 * In .dev.vars daneben:
 *   TEST_ABLEFY_BASIS="http://127.0.0.1:8788/api"
 *   TEST_RESEND_BASIS="http://127.0.0.1:8788/emails"
 *
 * Alles, was verschickt "wurde", landet unter GET /_mails (JSON).
 * Nur der Schlüssel "test-key" mit Secret "test-secret" wird angenommen.
 */
import http from 'node:http';

const mails = [];
const webhooks = [];

const produkte = [
  { id: 734201, name: 'Stressbewältigung im Alltag (Onlinekurs)', form: 'course' },
  { id: 734988, name: 'Rückenfit online – 8 Wochen', form: 'course' },
];

const bestellungen = {
  ord_ok: {
    order_id: 1001, order_token: 'ord_ok', payment_state: 'paid',
    order_amount_gross: '129.00', created_at: '2026-07-01T10:00:00Z',
    access_activated_at: '2026-07-01T10:05:00Z',
    payer: { email: 'jonas.mueller@example.de', first_name: 'Jonas', last_name: 'Müller' },
  },
  ord_null: {
    order_id: 1002, order_token: 'ord_null', payment_state: 'paid',
    order_amount_gross: '0.00', created_at: '2026-07-02T10:00:00Z',
    payer: { email: 'test@example.de', first_name: 'Test', last_name: 'Person' },
  },
};

function lese(req) {
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
}
const json = (res, daten, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(daten));
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const body = await lese(req);
  const p = url.pathname;

  if (p === '/_mails') return json(res, mails);
  if (p === '/_reset') { mails.length = 0; webhooks.length = 0; return json(res, { ok: true }); }

  // Resend
  if (p === '/emails' && req.method === 'POST') {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer re_test') return json(res, { message: 'invalid key' }, 401);
    const m = JSON.parse(body);
    if (!/@(meine-firma\.de|beispiel\.de)>?$/.test(m.from)) {
      return json(res, { message: 'The meine-andere.de domain is not verified' }, 403);
    }
    mails.push({ ...m, attachments: (m.attachments || []).map((a) => ({ filename: a.filename, bytes: a.content.length })) });
    return json(res, { id: 'mail_' + mails.length });
  }

  // Ablefy
  const key = url.searchParams.get('key') || (body && (() => { try { return JSON.parse(body).key; } catch { return ''; } })());
  const secret = url.searchParams.get('secret') || (body && (() => { try { return JSON.parse(body).secret; } catch { return ''; } })());
  if (p.startsWith('/api/')) {
    if (key !== 'test-key' || secret !== 'test-secret') return json(res, { error: 'unauthorized' }, 401);
    if (p === '/api/products') return json(res, produkte);
    if (p.startsWith('/api/orders/')) {
      const t = decodeURIComponent(p.slice('/api/orders/'.length));
      return json(res, bestellungen[t] || {});
    }
    if (p === '/api/webhook_endpoints' && req.method === 'POST') {
      const w = { id: webhooks.length + 1, ...JSON.parse(body) };
      delete w.key; delete w.secret;
      webhooks.push(w);
      return json(res, w, 201);
    }
    if (p === '/api/webhook_endpoints') return json(res, webhooks);
    const del = p.match(/^\/api\/webhook_endpoints\/(\d+)$/);
    if (del && req.method === 'DELETE') {
      const i = webhooks.findIndex((w) => String(w.id) === del[1]);
      if (i < 0) return json(res, { error: 'nicht gefunden' }, 404);
      webhooks.splice(i, 1);
      return json(res, { success: true });
    }
  }
  json(res, { error: 'unbekannt ' + p }, 404);
}).listen(8788, '127.0.0.1', () => console.log('Nachbau läuft auf http://127.0.0.1:8788'));
