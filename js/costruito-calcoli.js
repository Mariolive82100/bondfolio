// Calcoli del portafoglio costruito (nessuna grafica).
// Un "lotto" è un acquisto: { id, isin, nominale, prezzoCarico, data, commissioni }.

import { risolviPosizioni, calcolaTotali, calcolaIndicatori, VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';

// Somma i nominali dello stesso ISIN: [{ isin, nominale }]
export function sommaPerIsin(...liste) {
  const somme = new Map();
  liste.forEach(lista => lista.forEach(x => somme.set(x.isin, (somme.get(x.isin) || 0) + x.nominale)));
  return Array.from(somme, ([isin, nominale]) => ({ isin: isin, nominale: nominale }));
}

// Confronto tra quanto hai pagato e quanto vale oggi (prezzi del file caricato).
// Conta solo i lotti il cui titolo è nel file ed è in euro; gli altri sono in "esclusi".
// - costoTitoli = nominale x prezzo di carico / 100; commissioni = somma delle commissioni
// - capitaleInvestito = costoTitoli + commissioni; valoreOggi = nominale x prezzo di oggi / 100
// - variazione = valoreOggi - costoTitoli (solo effetto prezzo, senza rateo né tasse sulla plusvalenza)
export function riepilogoAcquisti(lotti, titoli) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  let costoTitoli = 0, commissioni = 0, valoreOggi = 0, validi = 0, esclusi = 0;
  lotti.forEach(l => {
    const t = perIsin.get(l.isin);
    if (!t || t.valuta !== VALUTA_PORTAFOGLIO) { esclusi += 1; return; }
    validi += 1;
    costoTitoli += l.nominale * l.prezzoCarico / 100;
    commissioni += l.commissioni || 0;
    valoreOggi += l.nominale * (t.prezzo || 0) / 100;
  });
  const variazione = valoreOggi - costoTitoli;
  return {
    costoTitoli: costoTitoli,
    commissioni: commissioni,
    capitaleInvestito: costoTitoli + commissioni,
    valoreOggi: valoreOggi,
    variazione: variazione,
    variazionePct: costoTitoli > 0 ? variazione / costoTitoli * 100 : null,
    commissioniPct: costoTitoli > 0 ? commissioni / costoTitoli * 100 : null,
    lotti: validi,
    esclusi: esclusi
  };
}

// Stima del rendimento netto annuo dopo le commissioni: si sottrae il costo delle commissioni
// (in % del capitale) spalmato sugli anni medi alla scadenza. È un'approssimazione.
export function rendDopoCommissioni(rendNetto, commissioniPct, scadenzaAnni) {
  if (rendNetto === null || commissioniPct === null || !(scadenzaAnni > 0)) return null;
  return rendNetto - commissioniPct / scadenzaAnni;
}

// Prima e dopo: il portafoglio costruito da solo, e il costruito più gli acquisti della bozza.
// Restituisce { prima, dopo } con { tot, ind } (totali e indicatori ai prezzi di oggi).
export function impattoAggiunta(lotti, bozza, titoli, dataRif) {
  const calcola = lista => {
    const pos = risolviPosizioni(lista, titoli);
    return { tot: calcolaTotali(pos), ind: calcolaIndicatori(pos, dataRif) };
  };
  const costruito = sommaPerIsin(lotti);
  return { prima: calcola(costruito), dopo: calcola(sommaPerIsin(costruito, bozza)) };
}
