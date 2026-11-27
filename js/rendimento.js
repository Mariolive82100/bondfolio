// Rendimento netto a scadenza "all'acquisto": calcolato dal prezzo medio di carico (commissioni comprese) e dalla data di acquisto.
// Resta fisso nel tempo, a differenza del rendimento del file che cambia con i prezzi.
//
// Regole (semplificazioni):
// - Flussi: cedole nette (cedola x (1 - aliquota)) nei mesi di pagamento del file, nel giorno della scadenza; rimborso a 100 alla scadenza.
// - Si paga il prezzo di carico più il rateo netto maturato alla data di acquisto (la prima cedola è poi incassata per intero).
// - Le tasse sulla differenza tra 100 e il prezzo di carico si pagano alla scadenza (con la stessa aliquota; se il prezzo è sopra 100 è un credito).
// - Se il file non ha i mesi di pagamento si assume una cedola annua nel mese di scadenza.
// - Nessun giorno di regolamento (T+2) e nessuno scarto di emissione. Rendimento annuo effettivo, giorni effettivi/365.

import { aliquota } from './filtri.js';

const MS_GIORNO = 24 * 3600 * 1000;
const giorniTra = (a, b) => Math.round((b - a) / MS_GIORNO);
const giornoDelMese = (anno, mese0, giorno) => new Date(anno, mese0, Math.min(giorno, new Date(anno, mese0 + 1, 0).getDate()));

// Date di pagamento delle cedole da (anno inizio - 1) fino alla scadenza, in ordine: [Date]
function dateCedole(t, annoInizio) {
  const scad = new Date(t.scadenza + 'T00:00:00');
  const giorno = scad.getDate();
  const mesi = (t.mesiCedola && t.mesiCedola.length > 0) ? t.mesiCedola.slice().sort((a, b) => a - b) : [scad.getMonth() + 1];
  const date = [];
  for (let anno = annoInizio - 1; anno <= scad.getFullYear(); anno++) {
    mesi.forEach(m => {
      const d = giornoDelMese(anno, m - 1, giorno);
      if (d <= scad) date.push(d);
    });
  }
  return { date: date, perAnno: mesi.length };
}

// Rendimento netto annuo (%) di un acquisto, oppure null se non calcolabile
export function rendimentoNettoAcquisto(t, prezzoCarico, dataAcquisto) {
  if (!t || !t.scadenza || !(prezzoCarico > 0) || !dataAcquisto) return null;
  const t0 = new Date(dataAcquisto + 'T00:00:00');
  const scad = new Date(t.scadenza + 'T00:00:00');
  if (!(scad > t0)) return null;

  const tassa = aliquota(t) / 100;
  const cedolaLorda = t.cedola > 0 ? t.cedola : 0;
  const { date, perAnno } = dateCedole(t, t0.getFullYear());
  const periodo = cedolaLorda / perAnno; // cedola di ogni pagamento, per 100 di nominale

  const flussi = []; // { giorni, importo }
  let precedente = null, successiva = null;
  date.forEach(d => {
    if (d <= t0) precedente = d;
    else {
      if (successiva === null) successiva = d;
      flussi.push({ giorni: giorniTra(t0, d), importo: periodo * (1 - tassa) });
    }
  });
  if (flussi.length === 0) {
    flussi.push({ giorni: giorniTra(t0, scad), importo: 0 });
  }
  flussi[flussi.length - 1].importo += 100 - tassa * (100 - prezzoCarico);

  // rateo maturato alla data di acquisto (netto), con giorni effettivi sul periodo
  let rateoNetto = 0;
  if (precedente && successiva && periodo > 0) {
    rateoNetto = periodo * giorniTra(precedente, t0) / giorniTra(precedente, successiva) * (1 - tassa);
  }
  const prezzoSporco = prezzoCarico + rateoNetto;

  const valore = y => flussi.reduce((s, f) => s + f.importo / Math.pow(1 + y, f.giorni / 365), 0) - prezzoSporco;
  let lo = -0.9, hi = 1;
  if (valore(lo) * valore(hi) > 0) return null;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (valore(lo) * valore(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2 * 100;
}

// Media del rendimento all'acquisto pesata sul capitale investito (nominale x prezzo di carico / 100).
// lotti = acquisti del portafoglio; titoli = elenco del file; scadutoOggi(titolo) esclude i titoli già scaduti.
// Restituisce { rend, conteggio, totale } (conteggio = acquisti inclusi nella media, totale = acquisti validi)
export function rendimentoAcquistoPortafoglio(lotti, titoli, valuta, scadutoOggi) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  let somma = 0, pesi = 0, conteggio = 0, totale = 0;
  lotti.forEach(l => {
    const t = perIsin.get(l.isin);
    if (!t || t.valuta !== valuta || scadutoOggi(t)) return;
    totale += 1;
    const y = rendimentoNettoAcquisto(t, l.prezzoCarico, l.data);
    if (y === null) return;
    const peso = l.nominale * l.prezzoCarico / 100;
    somma += y * peso; pesi += peso; conteggio += 1;
  });
  return { rend: pesi > 0 ? somma / pesi : null, conteggio: conteggio, totale: totale };
}

// Confronto tra il rendimento al tuo acquisto e quello che avresti comprando oggi gli stessi titoli con gli stessi nominali.
// - "oggi" = prezzo del file, data di calcolo dataOggi; stessa formula dell'acquisto.
// - Al prezzo di oggi si aggiungono le commissioni scritte in quell'acquisto (il prezzo di carico le comprende già).
// - Un acquisto entra in entrambe le medie solo se si possono calcolare tutti e due i rendimenti.
// - Ogni media è pesata sul suo costo: capitale investito per l'acquisto, costo di oggi (commissioni comprese) per oggi.
// Restituisce { acquisto, oggi, conteggio, totale, costoOggi, commissioni }; totale = tutti gli acquisti ricevuti.
export function confrontoRendimenti(lotti, titoli, valuta, scadutoOggi, dataOggi) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  let sAcq = 0, pAcq = 0, sOggi = 0, pOggi = 0, conteggio = 0, commissioni = 0;
  lotti.forEach(l => {
    const t = perIsin.get(l.isin);
    if (!t || t.valuta !== valuta || scadutoOggi(t) || !(t.prezzo > 0) || !(l.nominale > 0)) return;
    const comm = l.commissioni || 0;
    const prezzoOggi = t.prezzo + comm / l.nominale * 100;
    const yAcq = rendimentoNettoAcquisto(t, l.prezzoCarico, l.data);
    const yOggi = rendimentoNettoAcquisto(t, prezzoOggi, dataOggi);
    if (yAcq === null || yOggi === null) return;
    const costoAcq = l.nominale * l.prezzoCarico / 100;
    const costo = l.nominale * prezzoOggi / 100;
    sAcq += yAcq * costoAcq; pAcq += costoAcq;
    sOggi += yOggi * costo; pOggi += costo;
    commissioni += comm;
    conteggio += 1;
  });
  return {
    acquisto: pAcq > 0 ? sAcq / pAcq : null,
    oggi: pOggi > 0 ? sOggi / pOggi : null,
    conteggio: conteggio, totale: lotti.length,
    costoOggi: pOggi, commissioni: commissioni
  };
}
