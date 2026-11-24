// Calendario degli incassi: lettura del file cashflow.csv scaricato a mano da Simple Tools for Investors
// (sezione «Data export»). Il file contiene gli eventi di cedola, rimborso e tasse per 10.000 € di nominale.
// Formato: separatore ";", decimali con la virgola, date gg/mm/aaaa.
// Il file viene letto nel browser e salvato (in forma compatta) nel browser: non viene inviato da nessuna parte.

export const NOMINALE_BASE = 10000; // gli importi del file sono calcolati per questo nominale
const CHIAVE_SALVATAGGIO = 'bondfolio_cashflow_v1';

// Cosa fare di ogni tipo di evento (le voci non elencate qui riguardano l'acquisto simulato e vengono ignorate)
const TIPI = {
  'Incasso cedola lorda': 'cedola',
  'Tassazione cedola': 'tassa',
  'Rimborso nominale': 'rimborso',
  'Tassazione capital gain': 'tassa',
  'Addebito disaggio di emissione': 'tassa',
  'Imposta sul disaggio': 'tassa',
  'Credito disaggio': 'tassa'
};
const VOCI = Object.keys(TIPI); // per il salvataggio compatto: si salva la posizione della voce

let attuale = null; // { perIsin: Map, dataAcquisto, nomeFile, caricatoIl }

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
  if (righe.length < 2) throw new Error('Il file è vuoto.');
  const intestazione = righe[0].split(';').map(s => s.trim().toLowerCase());
  const pos = {};
  intestazione.forEach((nome, i) => { if (nome) pos[nome] = i; });
  const mancanti = ['isincode', 'eventtype', 'eventdescription', 'eventdate', 'eventamount'].filter(c => pos[c] === undefined);
  if (mancanti.length > 0) {
    throw new Error('Questo non sembra il file dei cashflow. Colonne mancanti: ' + mancanti.join(', '));
  }

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
  if (perIsin.size === 0) throw new Error('Nel file non ci sono cedole né rimborsi.');
  perIsin.forEach(lista => lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)));
  return { perIsin: perIsin, dataAcquisto: dataAcquisto };
}

// Il calendario in uso (o null se non è stato caricato). Mappa isin -> [{ data, tipo, voce, importo }] per 10.000 € di nominale
export function cashflowAttuale() { return attuale; }

function avvisa() { document.dispatchEvent(new CustomEvent('cashflow-aggiornato')); }

function salva() {
  try {
    const eventi = {};
    attuale.perIsin.forEach((lista, isin) => {
      eventi[isin] = lista.map(e => [e.data, VOCI.indexOf(e.voce), e.importo]);
    });
    localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify({
      nomeFile: attuale.nomeFile, caricatoIl: attuale.caricatoIl, dataAcquisto: attuale.dataAcquisto, eventi: eventi
    }));
    return true;
  } catch (e) {
    return false;
  }
}

// Imposta il calendario letto con leggiCashflow. Restituisce true se è stato salvato anche nel browser.
export function impostaCashflow(risultato, nomeFile) {
  attuale = {
    perIsin: risultato.perIsin, dataAcquisto: risultato.dataAcquisto,
    nomeFile: nomeFile, caricatoIl: new Date().toISOString()
  };
  const salvato = salva();
  avvisa();
  return salvato;
}

export function rimuoviCashflow() {
  attuale = null;
  try { localStorage.removeItem(CHIAVE_SALVATAGGIO); } catch (e) { /* non è essenziale */ }
  avvisa();
}

// All'apertura dell'app: recupera il calendario salvato nel browser (se c'è)
function caricaSalvato() {
  try {
    const grezzo = localStorage.getItem(CHIAVE_SALVATAGGIO);
    if (!grezzo) return;
    const s = JSON.parse(grezzo);
    const perIsin = new Map();
    Object.keys(s.eventi).forEach(isin => {
      perIsin.set(isin, s.eventi[isin].map(([d, v, importo]) => {
        const voce = VOCI[v];
        return { data: d, tipo: TIPI[voce], voce: voce, importo: importo };
      }));
    });
    attuale = { perIsin: perIsin, dataAcquisto: s.dataAcquisto, nomeFile: s.nomeFile, caricatoIl: s.caricatoIl };
  } catch (e) {
    attuale = null;
  }
}
caricaSalvato();
