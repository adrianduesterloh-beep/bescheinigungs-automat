/**
 * Läuft vor jedem Deploy (npm-Lebenszyklus "predeploy").
 *
 * Fängt den häufigsten Fehler nach einem Update ab: Beim Hochladen der neuen
 * Dateien wurde auch wrangler.toml mit hochgeladen. Die Fassung aus dem
 * Update-Paket enthält aber nur einen Platzhalter statt der Kennung des
 * Speichers, die Cloudflare bei der Installation eingetragen hat. Cloudflare
 * würde dann mit dem Code 10042 abbrechen — hier steht stattdessen, was zu tun ist.
 *
 * Lokal (wrangler dev, --dry-run) greift die Prüfung nicht.
 */
import { readFileSync } from 'node:fs';

const inCloudflareBuild = Boolean(process.env.WORKERS_CI || process.env.CI);
if (!inCloudflareBuild) process.exit(0);

const toml = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
if (!toml.includes('hier_traegt_cloudflare_die_kennung_ein')) process.exit(0);

console.error(`
==========================================================================
ABBRUCH: wrangler.toml wurde durch die Fassung aus dem Update-Paket ersetzt.

Darin fehlt die Kennung des Speichers, die Cloudflare bei der Installation
eingetragen hat. Beim nächsten Update: wrangler.toml NICHT mit hochladen.

So wird es wieder gut (einmalig, etwa zwei Minuten):
  1. Cloudflare → Storage & Databases → KV → den Speicher dieses Programms
     anklicken → die Kennung (ID, 32 Zeichen) kopieren.
  2. GitHub → dein Verzeichnis → wrangler.toml → Stift (Bearbeiten).
  3. Die Zeile   id = "hier_traegt_cloudflare_die_kennung_ein"
     ändern in   id = "<die kopierte Kennung>"
  4. Commit changes. Cloudflare baut danach von selbst neu.
==========================================================================
`);
process.exit(1);
