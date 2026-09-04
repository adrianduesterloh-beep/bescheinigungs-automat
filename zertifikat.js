/**
 * Das GKV-Muster "Teilnahmebescheinigung und Antrag auf Bezuschussung"
 * ausfüllen. Verbindlich seit 01.01.2026.
 *
 * Teil 1 füllt der Anbieter — das ist alles, was hier passiert.
 * Teil 2 bleibt der teilnehmenden Person vorbehalten; nur die Anbieterangaben
 * darin werden vorbelegt.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib';
import formularBytes from './formular.pdf';

const TEIL1_FELDER = [
  'Vor- und Nachname',
  'Titel der Maßnahme',
  'Datum von',
  'Datum bis',
  'Kontrollkästchen Teilnahme',
  'Nutzen Präventionsprinzip',
  'Name Unternehmen/Organisation',
  'Angebots-ID',
  'Teilnahmegebühr',
  'Ort 1',
  'Datum',
  'Unterschrift bzw. digitale Signatur der unterzeichnungsberechtigten Person',
  'Name des anbietenden Unternehmens / der anbietenden Organisation',
  'Adresse des anbietenden Unternehmens / der anbietenden Organisation',
];

const de = (d) =>
  new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(d);

/**
 * @param {object} kurs      Kurs-Eintrag aus dem Speicher
 * @param {object} daten     {vorname, nachname, von: Date, bis: Date, gebuehr: string}
 * @param {ArrayBuffer|null} unterschriftPng
 */
export async function baueBescheinigung(kurs, daten, unterschriftPng = null) {
  const doc = await PDFDocument.load(formularBytes);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const ausstellung = daten.bis;

  const set = (name, wert, groesse = 8) => {
    const f = form.getTextField(name);
    f.setText(String(wert ?? ''));
    f.setFontSize(groesse);
  };

  if (!daten.gebuehr) {
    throw new Error('Teilnahmegebühr fehlt — eine Bescheinigung darf so nicht entstehen.');
  }

  set('Vor- und Nachname', `${daten.vorname} ${daten.nachname}`.trim());
  set('Titel der Maßnahme', kurs.titel);
  set('Datum von', de(daten.von));
  set('Datum bis', de(daten.bis));
  set('Nutzen Präventionsprinzip', kurs.praeventionsprinzip);
  set('Name Unternehmen/Organisation', kurs.anbieterName);
  // Das Formularfeld heißt "Angebots-ID". Die ZPP nennt denselben Wert Kurs-ID.
  set('Angebots-ID', kurs.zppKursId);
  set('Teilnahmegebühr', daten.gebuehr);
  set('Ort 1', kurs.ort);
  set('Datum', de(ausstellung));
  form.getCheckBox('Kontrollkästchen Teilnahme').check();

  set('Name des anbietenden Unternehmens / der anbietenden Organisation', kurs.anbieterName);
  set('Adresse des anbietenden Unternehmens / der anbietenden Organisation', kurs.anbieterAdresse);

  const sigFeld = form.getTextField(
    'Unterschrift bzw. digitale Signatur der unterzeichnungsberechtigten Person'
  );
  if (unterschriftPng) {
    const png = await doc.embedPng(unterschriftPng);
    const rect = sigFeld.acroField.getWidgets()[0].getRectangle();
    const skala = Math.min(105 / png.width, 18 / png.height);
    doc.getPage(0).drawImage(png, {
      x: rect.x + 4,
      y: rect.y + 3,
      width: png.width * skala,
      height: png.height * skala,
    });
    sigFeld.setText('');
  } else {
    set(
      'Unterschrift bzw. digitale Signatur der unterzeichnungsberechtigten Person',
      `${kurs.unterschriftName || kurs.anbieterName} (digital signiert am ${de(ausstellung)})`,
      6.5
    );
  }

  form.updateFieldAppearances(font);
  // Teil 1 festschreiben, damit niemand die Anbieterangaben nachträglich ändert.
  for (const name of TEIL1_FELDER) {
    try {
      form.getField(name).enableReadOnly();
    } catch {
      /* Feld nicht vorhanden — dann eben nicht */
    }
  }

  doc.setTitle('Teilnahmebescheinigung und Antrag auf Bezuschussung');
  doc.setAuthor(kurs.anbieterName || 'Anbieter');
  doc.setSubject(`${kurs.titel} – ${kurs.zppKursId}`);
  return doc.save();
}

/** Dateiname des Anhangs. */
export const dateiname = (vorname, nachname) =>
  `Teilnahmebescheinigung_${`${vorname}_${nachname}`.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '')}.pdf`;
