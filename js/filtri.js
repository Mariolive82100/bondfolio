// Filtri e ordinamento dell'elenco obbligazioni (nessun accesso alla pagina: solo calcoli)

import { ordinaleTitolo } from './rating.js';

export const FILTRI_INIZIALI = {
  cerca: '',
  tipi: [],        // tipi di emittente scelti: 'gov' governativi, 'sov' sovranazionali, 'corp' societari; vuoto = tutti
  valuta: 'EUR',   // '' = tutte
  annoDa: '',
  annoA: '',
  rendMin: '',
  cedolaMin: '',
  cedolaMax: '',
  rating: '',      // numero massimo accettato (1 = AAA ... 10 = BBB-)
  grado: '',       // '' = tutti, 'senior', 'sub' = subordinati
  mesi: [],        // mesi di pagamento della cedola (1 = gennaio ... 12); vuoto = tutti
  mesiRegola: 'solo' // 'solo' = paga solo in quei mesi, 'almeno' = paga in almeno uno di quei mesi
};

// Copia nuova dei filtri iniziali (le liste vanno sempre ricreate, mai condivise)
export function nuoviFiltri() {
  return Object.assign({}, FILTRI_INIZIALI, { mesi: [], tipi: [] });
}

export function tipoEmittente(t) {
  if (t.emittenteCodice.startsWith('GOV_')) return 'gov';
  if (t.emittenteCodice.startsWith('SOV_')) return 'sov';
  return 'corp';
}

// Aliquota sulle cedole:
// - 12,5% per i governativi di Paesi nella "white list" (D.M. 4/9/1996, come sostituita dal D.M. 9/8/2016) e per i sovranazionali
// - 26% per i societari e per i governativi di Paesi fuori dalla white list (oggi nel tuo file: Cile, Perù, Bahrain)
// Un Paese non riconosciuto dall'elenco qui sotto è trattato al 26% (scelta prudente).
export const ALIQUOTA_AGEVOLATA = 12.5;
export const ALIQUOTA_ORDINARIA = 26;

// Codici dei Paesi in white list (la parte dopo "GOV_" nel codice emittente)
const PAESI_WHITE_LIST = new Set([
  'AL', 'DZ', 'AR', 'AM', 'AU', 'AT', 'AZ', 'BD', 'BE', 'BY', 'BA', 'BR', 'BG', 'CM', 'CA', 'CN', 'CY', 'CO', 'CG',
  'KR', 'CI', 'CR', 'HR', 'DK', 'EC', 'EG', 'AE', 'EE', 'ET', 'RU', 'PH', 'FI', 'FR', 'GE', 'DE', 'GH', 'JP', 'JO',
  'GR', 'HK', 'IN', 'ID', 'IE', 'IS', 'IL', 'IT', 'KZ', 'KG', 'KW', 'LV', 'LB', 'LI', 'LT', 'LU', 'MK', 'MY', 'MT',
  'MA', 'MU', 'MX', 'MD', 'ME', 'MZ', 'NG', 'NO', 'NZ', 'OM', 'NL', 'PK', 'PL', 'PT', 'QA', 'GB', 'UK', 'CZ', 'SK',
  'RO', 'SM', 'SN', 'RS', 'SG', 'SI', 'ES', 'LK', 'US', 'ZA', 'SE', 'CH', 'TJ', 'TW', 'TZ', 'TH', 'TT', 'TN', 'TR',
  'TM', 'UA', 'UG', 'HU', 'UZ', 'VE', 'VN', 'ZM', 'SA'
]);

export function aliquota(t) {
  const tipo = tipoEmittente(t);
  if (tipo === 'sov') return ALIQUOTA_AGEVOLATA;
  if (tipo === 'gov') return PAESI_WHITE_LIST.has(t.emittenteCodice.slice(4)) ? ALIQUOTA_AGEVOLATA : ALIQUOTA_ORDINARIA;
  return ALIQUOTA_ORDINARIA;
}

// Cedola al netto delle tasse, in percentuale (3,00 con aliquota 12,5% -> 2,625)
export function cedolaNetta(t) {
  if (t.cedola === null || t.cedola === undefined) return null;
  return t.cedola * (1 - aliquota(t) / 100);
}

// "2,5" -> 2.5 ; vuoto o non valido -> null
function num(testo) {
  if (testo === undefined || testo === null || String(testo).trim() === '') return null;
  const n = parseFloat(String(testo).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

export function applicaFiltri(titoli, f) {
  const q = f.cerca.trim().toLowerCase();
  const annoDa = num(f.annoDa);
  const annoA = num(f.annoA);
  const rendMin = num(f.rendMin);
  const cedolaMin = num(f.cedolaMin);
  const cedolaMax = num(f.cedolaMax);
  const rating = num(f.rating);

  return titoli.filter(t => {
    if (q && !(t.nome.toLowerCase().includes(q) ||
               t.isin.toLowerCase().includes(q) ||
               t.emittente.toLowerCase().includes(q))) return false;
    if (f.tipi && f.tipi.length > 0 && !f.tipi.includes(tipoEmittente(t))) return false;
    if (f.valuta && t.valuta !== f.valuta) return false;

    const anno = t.scadenza ? Number(t.scadenza.slice(0, 4)) : null;
    if (annoDa !== null && (anno === null || anno < annoDa)) return false;
    if (annoA !== null && (anno === null || anno > annoA)) return false;

    if (rendMin !== null && (t.rendNetto === null || t.rendNetto < rendMin)) return false;
    const netta = cedolaNetta(t);
    if (cedolaMin !== null && (netta === null || netta < cedolaMin)) return false;
    if (cedolaMax !== null && (netta === null || netta > cedolaMax)) return false;

    if (rating !== null) {
      const o = ordinaleTitolo(t);
      if (o === null || o > rating) return false;
    }

    if (f.grado === 'senior' && t.grado !== 'Senior') return false;
    if (f.grado === 'sub' && t.grado === 'Senior') return false;

    const mesi = f.mesi || [];
    if (mesi.length > 0) {
      if (!t.mesiCedola || t.mesiCedola.length === 0) return false;
      if (f.mesiRegola === 'almeno') {
        if (!t.mesiCedola.some(m => mesi.includes(m))) return false;
      } else if (!t.mesiCedola.every(m => mesi.includes(m))) {
        return false;
      }
    }

    return true;
  });
}

function valoreDi(t, campo) {
  if (campo === 'rating') return ordinaleTitolo(t);
  if (campo === 'cedolaNetta') return cedolaNetta(t);
  if (campo === 'aliquota') return aliquota(t);
  const v = t[campo];
  return typeof v === 'string' ? v.toLowerCase() : v;
}

// ordine = { campo: 'rendNetto', verso: -1 }  (1 = crescente, -1 = decrescente)
export function ordina(lista, ordine) {
  const copia = lista.slice();
  copia.sort((a, b) => {
    const va = valoreDi(a, ordine.campo);
    const vb = valoreDi(b, ordine.campo);
    const aVuoto = va === null || va === undefined || va === '';
    const bVuoto = vb === null || vb === undefined || vb === '';
    if (aVuoto && bVuoto) return 0;
    if (aVuoto) return 1;   // i valori mancanti vanno sempre in fondo
    if (bVuoto) return -1;
    if (va < vb) return -1 * ordine.verso;
    if (va > vb) return 1 * ordine.verso;
    return 0;
  });
  return copia;
}
