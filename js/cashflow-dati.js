// Scarica e legge data/cashflow.csv (eventi di cedola, rimborso e tasse per 10.000 € di nominale).
// Il file è pesante (circa 3,6 MB): si scarica solo quando serve e poi resta in memoria finché la pagina è aperta.
// Formato: separatore ";", decimali con la virgola, date gg/mm/aaaa.

const NOME_FILE = 'data/cashflow.csv';
export const NOMINALE_BASE = 10000; // gli importi del file sono calcolati per questo nominale

// Cosa fare di ogni tipo di evento (le voci non elencate qui riguardano l'acquisto e vengono ignorate)
const TIPI = {
  'Incasso cedola lorda': 'cedola',
  'Tassazione cedola': 'tassa',
  'Rimborso nominale': 'rimborso',
  'Tassazione capital gain': 'tassa',
  'Addebito disaggio di emissione': 'tassa',
  'Imposta sul disaggio': 'tassa',
  'Credito disaggio': 'tassa'
};

let cache = null; // { perIsin: Map, dataAcquisto: 'aaaa-mm-gg' }

function numero(v) {
  const n = parseFloat(String(v || '').trim().replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

// "01/11/2027" -> "2027-11-01"
function data(v) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((v || '').trim());
  return m ? m[3] + '-' + m[2] + '-' + m[1] : null;
}

// Legge il testo del file. Gli eventi nella data più vecchia del file sono quelli dell'acquisto simulato
// (pagamento nominale, rateo, commissioni, imposta sul disaggio): non sono incassi e vengono scartati.
export function leggiCashflow(testo) {
  const righe = testo.replace(/^﻿/, '').split(/\r?\n/).filter(r => r.trim() !== '');
  if (righe.length < 2) throw new Error('Il file cashflow è vuoto.');
  const intestazione = righe[0].split(';').map(s => s.trim().toLowerCase());
  const pos = {};
  intestazione.forEach((nome, i) => { if (nome) pos[nome] = i; });
  ['isincode', 'eventdescription', 'eventdate', 'eventamount'].forEach(c => {
    if (pos[c] === undefined) throw new Error('Il file cashflow non ha la colonna ' + c + '.');
  });

  const eventi = [];
  let dataAcquisto = null;
  for (let i = 1; i < righe.length; i++) {
    const c = righe[i].split(';');
    const d = data(c[pos.eventdate]);
    if (!d) continue;
    if (dataAcquisto === null || d < dataAcquisto) dataAcquisto = d;
    eventi.push({ isin: (c[pos.isincode] || '').trim(), data: d, voce: (c[pos.eventdescription] || '').trim(), importo: numero(c[pos.eventamount]) });
  }

  const perIsin = new Map();
  eventi.forEach(e => {
    const tipo = TIPI[e.voce];
    if (!tipo || e.data === dataAcquisto || e.importo === 0 || e.isin === '') return;
    if (!perIsin.has(e.isin)) perIsin.set(e.isin, []);
    perIsin.get(e.isin).push({ data: e.data, tipo: tipo, voce: e.voce, importo: e.importo });
  });
  perIsin.forEach(lista => lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)));
  return { perIsin: perIsin, dataAcquisto: dataAcquisto };
}

// Scarica il file (una sola volta per sessione) e lo legge
async function carica() {
  if (cache) return cache;
  const risposta = await fetch(NOME_FILE, { cache: 'no-cache' });
  if (!risposta.ok) throw new Error('file cashflow non raggiungibile (errore ' + risposta.status + ').');
  cache = leggiCashflow(await risposta.text());
  return cache;
}

// Eventi dei soli ISIN richiesti, per 10.000 € di nominale: Map isin -> [{ data, tipo, voce, importo }]
// Se il file non si può scaricare, lancia un errore: chi chiama deve usare la stima.
export async function eventiPerIsin(listaIsin) {
  const { perIsin, dataAcquisto } = await carica();
  const risultato = new Map();
  listaIsin.forEach(isin => { if (perIsin.has(isin)) risultato.set(isin, perIsin.get(isin)); });
  return { eventi: risultato, dataAcquisto: dataAcquisto };
}
