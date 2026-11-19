// Calcoli sul portafoglio (nessuna grafica): usati dalla schermata Portafoglio
// e, più avanti, dalla schermata Analisi.

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
      cedolaAnnua: valida ? b.nominale * (titolo.cedola || 0) / 100 : 0
    };
  });
}

export function calcolaTotali(posizioni) {
  let nominale = 0, cedoleAnnue = 0, numero = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    nominale += p.nominale;
    cedoleAnnue += p.cedolaAnnua;
    numero += 1;
  });
  return { nominale: nominale, cedoleAnnue: cedoleAnnue, numero: numero, escluse: posizioni.length - numero };
}

// Peso percentuale sul nominale totale dei titoli validi
export function peso(posizione, totali) {
  if (!posizione.valida || totali.nominale === 0) return null;
  return posizione.nominale / totali.nominale * 100;
}
