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
    if (cedolaMin !== null && (t.cedola === null || t.cedola < cedolaMin)) return false;
    if (cedolaMax !== null && (t.cedola === null || t.cedola > cedolaMax)) return false;

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
