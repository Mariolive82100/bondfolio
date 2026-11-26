// Calendario degli incassi: lettura del file cashflow.csv scaricato a mano da Simple Tools for Investors
// (sezione «Data export»). Il file contiene gli eventi di cedola, rimborso e tasse per 10.000 € di nominale.
// Formato: separatore ";", decimali con la virgola, date gg/mm/aaaa.
// Il file viene letto nel browser e salvato (in forma compatta) nel browser: il file non viene inviato da nessuna parte.
// Se si è fatto l'accesso, online vanno solo le voci dei titoli in portafoglio (vedi cloud-cashflow.js).
// Qui ci sono quindi due fonti: il file caricato e la copia delle voci salvate online.

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

const CHIAVE_ONLINE = 'bondfolio_cashflow_online_v1';

let daFile = null; // { perIsin: Map, dataAcquisto, nomeFile, caricatoIl }
let online = {};   // isin -> { dal, al, ev: [[data, numero della voce, importo]] }  dal = data del calendario, al = quando è stato caricato
let unito;         // le due fonti messe insieme (si ricalcola quando cambiano)

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

const compatta = lista => lista.map(e => [e.data, VOCI.indexOf(e.voce), e.importo]);
const espandi = righe => righe.map(([d, v, importo]) => {
  const voce = VOCI[v];
  return { data: d, tipo: TIPI[voce], voce: voce, importo: importo };
});

// Le voci di un titolo lette dal file caricato, nel formato della copia online (oppure null)
export function voceDaFile(isin) {
  const lista = daFile && daFile.perIsin.get(isin);
  return lista ? { dal: daFile.dataAcquisto, al: daFile.caricatoIl, ev: compatta(lista) } : null;
}

// Tra le voci del file e quelle online sceglie le più recenti. A parità di contenuto tiene quelle online (niente riscritture).
export function piuRecente(dalFile, salvata) {
  if (!dalFile) return salvata || null;
  if (!salvata) return dalFile;
  if (JSON.stringify(dalFile.ev) === JSON.stringify(salvata.ev)) return salvata;
  if (dalFile.dal !== salvata.dal) return dalFile.dal > salvata.dal ? dalFile : salvata;
  return dalFile.al > salvata.al ? dalFile : salvata;
}

// Il calendario in uso (o null se non c'è né il file né la copia online).
// perIsin: isin -> [{ data, tipo, voce, importo }] per 10.000 € di nominale
export function cashflowAttuale() {
  if (unito !== undefined) return unito;
  const isinOnline = Object.keys(online);
  if (!daFile && isinOnline.length === 0) { unito = null; return unito; }
  const perIsin = new Map(daFile ? daFile.perIsin : []);
  isinOnline.forEach(isin => {
    const dalFile = voceDaFile(isin);
    const scelta = piuRecente(dalFile, online[isin]);
    if (scelta === online[isin]) perIsin.set(isin, espandi(scelta.ev));
  });
  unito = { perIsin: perIsin };
  return unito;
}

// Informazioni sul file caricato (o null) e titoli presenti nella copia online
export function fileCashflow() { return daFile; }
export function isinOnline() { return Object.keys(online); }

function avvisa() {
  unito = undefined;
  document.dispatchEvent(new CustomEvent('cashflow-aggiornato'));
}

// Sostituisce la copia delle voci salvate online
export function impostaCashflowOnline(voci) {
  if (JSON.stringify(voci) === JSON.stringify(online)) return;
  online = voci;
  try { localStorage.setItem(CHIAVE_ONLINE, JSON.stringify(online)); } catch (e) { /* si riscarica al prossimo accesso */ }
  avvisa();
}

function salva() {
  try {
    const eventi = {};
    daFile.perIsin.forEach((lista, isin) => { eventi[isin] = compatta(lista); });
    localStorage.setItem(CHIAVE_SALVATAGGIO, JSON.stringify({
      nomeFile: daFile.nomeFile, caricatoIl: daFile.caricatoIl, dataAcquisto: daFile.dataAcquisto, eventi: eventi
    }));
    return true;
  } catch (e) {
    return false;
  }
}

// Imposta il calendario letto con leggiCashflow. Restituisce true se è stato salvato anche nel browser.
export function impostaCashflow(risultato, nomeFile) {
  daFile = {
    perIsin: risultato.perIsin, dataAcquisto: risultato.dataAcquisto,
    nomeFile: nomeFile, caricatoIl: new Date().toISOString()
  };
  const salvato = salva();
  avvisa();
  document.dispatchEvent(new CustomEvent('cashflow-file-caricato')); // serve al salvataggio online
  return salvato;
}

// Toglie il file caricato; le voci salvate online restano
export function rimuoviCashflow() {
  daFile = null;
  try { localStorage.removeItem(CHIAVE_SALVATAGGIO); } catch (e) { /* non è essenziale */ }
  avvisa();
}

// All'apertura dell'app: recupera quello che è salvato nel browser
function caricaSalvato() {
  try {
    const grezzo = localStorage.getItem(CHIAVE_SALVATAGGIO);
    if (grezzo) {
      const s = JSON.parse(grezzo);
      const perIsin = new Map();
      Object.keys(s.eventi).forEach(isin => perIsin.set(isin, espandi(s.eventi[isin])));
      daFile = { perIsin: perIsin, dataAcquisto: s.dataAcquisto, nomeFile: s.nomeFile, caricatoIl: s.caricatoIl };
    }
  } catch (e) {
    daFile = null;
  }
  try {
    online = JSON.parse(localStorage.getItem(CHIAVE_ONLINE)) || {};
  } catch (e) {
    online = {};
  }
}
caricaSalvato();
