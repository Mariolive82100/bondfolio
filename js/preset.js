// Preset di selezione (nessun accesso alla pagina: solo calcoli).
// - "soglia": il titolo deve rispettarli tutti (AND)
// - "riduzione": si applica alla fine sulla lista già filtrata e ordinata
// Le fasce (es. "il 20% migliore") sono calcolate sui titoli in euro dell'intero file,
// così non cambiano mentre combini i preset.

import { ordinaleTitolo } from './rating.js';
import { VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';

export const FASCIA = 0.2;        // 20%
const RATING_MINIMO = 7;          // A- o migliore

export const PRESET = [
  { id: 'rendimento', nome: 'Massimo rendimento', tipo: 'soglia',
    info: 'Rendimento netto nel 20% migliore dei titoli in euro' },
  { id: 'cedola', nome: 'Massima cedola', tipo: 'soglia',
    info: 'Cedola nel 20% più alta dei titoli in euro' },
  { id: 'duration', nome: 'Minima duration', tipo: 'soglia',
    info: 'Duration nel 20% più bassa dei titoli in euro' },
  { id: 'qualita', nome: 'Alta qualità', tipo: 'soglia',
    info: 'Rating A- o migliore (i titoli senza rating sono esclusi)' },
  { id: 'efficiente', nome: 'Rendimento efficiente', tipo: 'soglia',
    info: 'Rendimento netto per unità di duration nel 20% migliore' },
  { id: 'liquidi', nome: 'Liquidi', tipo: 'soglia',
    info: 'Volumi nel 20% più alto tra i titoli che hanno scambi' },
  { id: 'emittente', nome: 'Un titolo per emittente', tipo: 'riduzione',
    info: 'Tiene un solo titolo per emittente: quello meglio piazzato nell\'ordinamento attuale' }
];

export function nomePreset(id) {
  const p = PRESET.find(x => x.id === id);
  return p ? p.nome : id;
}

export function eSoglia(id) {
  const p = PRESET.find(x => x.id === id);
  return !!p && p.tipo === 'soglia';
}

export function efficienza(t) {
  if (t.rendNetto === null || t.rendNetto === undefined) return null;
  if (!(t.durationLorda > 0)) return null;
  return t.rendNetto / t.durationLorda;
}

// q tra 0 e 1: 0.8 = valore sotto cui sta l'80% dei dati
function quantile(valori, q) {
  if (valori.length === 0) return null;
  const v = valori.slice().sort((a, b) => a - b);
  return v[Math.floor((v.length - 1) * q)];
}

export function calcolaSoglie(titoli) {
  const eur = titoli.filter(t => t.valuta === VALUTA_PORTAFOGLIO);
  const col = f => eur.map(f).filter(x => x !== null && x !== undefined && !Number.isNaN(x));
  return {
    rendimento: quantile(col(t => t.rendNetto), 1 - FASCIA),
    cedola: quantile(col(t => t.cedola), 1 - FASCIA),
    duration: quantile(col(t => t.durationLorda), FASCIA),
    efficiente: quantile(col(efficienza), 1 - FASCIA),
    liquidi: quantile(col(t => t.volume).filter(x => x > 0), 1 - FASCIA)
  };
}

export function passaPreset(id, t, s) {
  switch (id) {
    case 'rendimento':
      return s.rendimento !== null && t.rendNetto !== null && t.rendNetto >= s.rendimento;
    case 'cedola':
      return s.cedola !== null && t.cedola !== null && t.cedola >= s.cedola;
    case 'duration':
      return s.duration !== null && t.durationLorda !== null && t.durationLorda <= s.duration;
    case 'qualita': {
      const o = ordinaleTitolo(t);
      return o !== null && o <= RATING_MINIMO;
    }
    case 'efficiente': {
      const e = efficienza(t);
      return s.efficiente !== null && e !== null && e >= s.efficiente;
    }
    case 'liquidi':
      return s.liquidi !== null && t.volume > 0 && t.volume >= s.liquidi;
    default:
      return true;
  }
}

// Tiene solo i titoli che rispettano TUTTI i preset a soglia indicati
export function applicaPreset(titoli, ids, soglie) {
  const attivi = ids.filter(eSoglia);
  if (attivi.length === 0) return titoli;
  return titoli.filter(t => attivi.every(id => passaPreset(id, t, soglie)));
}

// La lista deve essere già ordinata: per ogni emittente resta il primo titolo
export function riduciPerEmittente(titoliOrdinati) {
  const visti = new Set();
  return titoliOrdinati.filter(t => {
    const chiave = t.emittenteCodice || t.emittente;
    if (visti.has(chiave)) return false;
    visti.add(chiave);
    return true;
  });
}

/* ---------- Flusso delle cedole ---------- */

export const FLUSSI = [
  { freq: 12, nome: 'Mensile' },
  { freq: 4, nome: 'Trimestrale' },
  { freq: 2, nome: 'Semestrale' },
  { freq: 1, nome: 'Annuale' }
];

// Quante cedole all'anno paga il titolo (0 = nessuna / non indicato).
// Si conta dai mesi di pagamento del file; se mancano si usa la periodicità.
export function frequenzaCedole(t) {
  const n = t.mesiCedola ? t.mesiCedola.length : 0;
  return n || t.periodicita || 0;
}

// Più frequenze scelte = basta una di esse (OR). Nessuna scelta = indifferente.
export function filtraPerFlusso(titoli, frequenze) {
  if (!frequenze || frequenze.size === 0) return titoli;
  return titoli.filter(t => frequenze.has(frequenzaCedole(t)));
}
