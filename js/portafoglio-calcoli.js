// Calcoli sul portafoglio (nessuna grafica): usati dalla schermata Portafoglio
// e, più avanti, dalla schermata Analisi.

import { cedolaNetta } from './filtri.js';

// Il portafoglio accetta solo titoli in questa valuta
export const VALUTA_PORTAFOGLIO = 'EUR';

// Unisce la bozza [{ isin, nominale }] con i dati del file.
// Un titolo è "valido" se è nel file ed è in euro: solo quelli entrano nei calcoli.
export function risolviPosizioni(bozza, titoli) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  return bozza.map(b => {
    const titolo = perIsin.get(b.isin) || null;
    let motivo = '';
    if (!titolo) motivo = 'Non presente nel file';
    else if (titolo.valuta !== VALUTA_PORTAFOGLIO) motivo = 'Valuta non EUR';
    const valida = motivo === '';
    return {
      isin: b.isin,
      nominale: b.nominale,
      titolo: titolo,
      valida: valida,
      motivo: motivo,
      cedolaAnnua: valida ? b.nominale * (titolo.cedola || 0) / 100 : 0,
      cedolaAnnuaNetta: valida ? b.nominale * (cedolaNetta(titolo) || 0) / 100 : 0,
      // quanto costa comprarlo: nominale x prezzo / 100 (il prezzo è per 100 di nominale)
      controvalore: valida ? b.nominale * (titolo.prezzo || 0) / 100 : 0
    };
  });
}

// Media ponderata per nominale di un campo del titolo (es. 'rendNetto'); ignora i titoli senza quel dato
function mediaPonderata(posizioni, campo) {
  let somma = 0, pesi = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    const v = p.titolo[campo];
    if (v === null || v === undefined) return;
    somma += v * p.nominale;
    pesi += p.nominale;
  });
  return pesi > 0 ? somma / pesi : null;
}

export function calcolaTotali(posizioni) {
  let nominale = 0, cedoleAnnue = 0, cedoleNette = 0, numero = 0, controvalore = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    nominale += p.nominale;
    cedoleAnnue += p.cedolaAnnua;
    cedoleNette += p.cedolaAnnuaNetta;
    controvalore += p.controvalore;
    numero += 1;
  });
  return {
    rendLordo: mediaPonderata(posizioni, 'rendLordo'),
    rendNetto: mediaPonderata(posizioni, 'rendNetto'),
    duration: mediaPonderata(posizioni, 'durationLorda'),
    nominale: nominale, cedoleAnnue: cedoleAnnue, cedoleNette: cedoleNette, controvalore: controvalore, numero: numero, escluse: posizioni.length - numero };
}

// Peso percentuale sul nominale totale dei titoli validi
export function peso(posizione, totali) {
  if (!posizione.valida || totali.nominale === 0) return null;
  return posizione.nominale / totali.nominale * 100;
}

// Taglio minimo del titolo (se manca nel file si assume 1.000)
export function lottoMinimo(titolo) {
  return (titolo && titolo.lottoMinimo) || 1000;
}

// Nominale necessario per incassare almeno la cedola annua netta desiderata (in euro).
// Si arrotonda per eccesso a un multiplo del taglio minimo, e non scende mai sotto il taglio minimo.
// Se il titolo non ha cedola restituisce null.
export function nominaleDaCedolaNetta(titolo, cedolaDesiderata) {
  const tasso = (cedolaNetta(titolo) || 0) / 100;
  if (!(tasso > 0) || !(cedolaDesiderata > 0)) return null;
  const lotto = lottoMinimo(titolo);
  const lotti = Math.max(1, Math.ceil(cedolaDesiderata / tasso / lotto - 1e-9));
  return lotti * lotto;
}
