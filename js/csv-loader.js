// Lettura del file CSV con l'elenco delle obbligazioni.
// Formato: separatore ";", decimali con la virgola, date gg/mm/aaaa.

const COLONNE_OBBLIGATORIE = [
  'isincode', 'description', 'redemptiondate', 'currencycode',
  'price', 'grossytm', 'netytm', 'grossduration', 'currentcouponrate'
];

function numero(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

// "15/07/2027" -> "2027-07-15" (formato ordinabile)
function data(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || '');
  return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
}

// "2,8" -> [2, 8]
function mesi(v) {
  if (!v) return [];
  return v.split(',').map(x => parseInt(x, 10)).filter(n => n >= 1 && n <= 12);
}

// Le percentuali "frazione" (0,0625) diventano percentuali (6,25)
function percento(v) {
  const n = numero(v);
  return n === null ? null : Math.round(n * 1e6) / 1e4;
}

export function leggiCsv(testo, nomeFile) {
  const righe = testo.replace(/^﻿/, '').split(/\r?\n/).filter(r => r.trim() !== '');
  if (righe.length < 2) {
    throw new Error('Il file è vuoto o non contiene titoli.');
  }

  const intestazione = righe[0].split(';').map(s => s.trim().toLowerCase());
  const mancanti = COLONNE_OBBLIGATORIE.filter(c => !intestazione.includes(c));
  if (mancanti.length > 0) {
    throw new Error('Questo non sembra il file giusto. Colonne mancanti: ' + mancanti.join(', '));
  }

  const pos = {};
  intestazione.forEach((nome, i) => { if (nome) pos[nome] = i; });

  const titoli = righe.slice(1).map(riga => {
    const c = riga.split(';');
    const t = nome => (c[pos[nome]] === undefined ? '' : c[pos[nome]].trim());
    return {
      isin: t('isincode'),
      nome: t('description'),
      scadenza: data(t('redemptiondate')),
      valuta: t('currencycode'),
      emittenteCodice: t('issuercode'),
      emittente: t('issuerdescription'),
      ratingSP: t('ratingsp'),
      ratingMoodys: t('ratingmoodys'),
      grado: t('status'),
      lottoMinimo: numero(t('minimumlot')),
      tipoPrezzo: t('pricetype'),
      prezzo: numero(t('price')),
      volume: numero(t('volume')),
      rendLordo: numero(t('grossytm')),
      durationLorda: numero(t('grossduration')),
      rendNetto: numero(t('netytm')),
      rendSupernetto: numero(t('supernetytm')),
      durationSupernetto: numero(t('supernetduration')),
      ispread: numero(t('ispread')),
      zspread: numero(t('zspread')),
      cedola: percento(t('currentcouponrate')),
      periodicita: numero(t('couponperiodicity')),
      mesiCedola: mesi(t('couponmonths')),
      rendCorrente: percento(t('instantyield')),
      prezzoEmissione: numero(t('issueprice'))
    };
  }).filter(t => t.isin !== '');

  const valute = {};
  titoli.forEach(t => { valute[t.valuta] = (valute[t.valuta] || 0) + 1; });

  const meta = {
    nomeFile: nomeFile,
    righe: titoli.length,
    dataRiferimento: data(t0(righe, pos)),
    caricatoIl: new Date().toISOString(),
    valute: valute
  };

  return { titoli: titoli, meta: meta };
}

// Data di riferimento = quella scritta nella prima riga di dati
function t0(righe, pos) {
  const c = righe[1].split(';');
  return pos.referencedate === undefined ? '' : (c[pos.referencedate] || '').trim();
}
