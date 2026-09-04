/**
 * Ablefy schickt seine Webhooks als x-www-form-urlencoded mit Rails-Klammern:
 *   event=quiz.answered&payer[email]=…&answers[][question_id]=…
 *
 * Ausgewertet werden die flachen Felder und die einstufigen Klammern.
 * Die verschachtelten Antwortlisten interessieren hier nicht.
 */
export function leseFelder(text) {
  const felder = {};
  for (const [k, v] of new URLSearchParams(text)) {
    const treffer = k.match(/^(\w+)\[(\w+)\]$/);
    if (treffer) {
      felder[treffer[1]] ??= {};
      felder[treffer[1]][treffer[2]] = v;
    } else if (!k.includes('[')) {
      felder[k] = v;
    }
  }
  return felder;
}
