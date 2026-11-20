// Calcoli del portafoglio costruito (nessuna grafica).
// Un "lotto" è un acquisto: { id, isin, nominale, prezzoEsecuzione, prezzoCarico, data, dataRegolamento, rateo, ritenutaRateo, commissioni }.
// rateo = rateo lordo pagato in euro; ritenutaRateo = ritenuta sul rateo scalata dalla banca (assenti negli acquisti salvati con le versioni precedenti: valgono 0).

import { risolviPosizioni, calcolaTotali, calcolaIndicatori, VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';

// Prezzo di esecuzione (per 100 di nominale, senza commissioni) e prezzo di carico (con commissioni, come lo mostra il broker).
// Negli acquisti salvati prima della versione 0.24.0 esiste solo prezzoCarico (scritto dal broker, quindi con commissioni): l'esecuzione se ne ricava.
export function prezzoEsecuzione(l) {
  if (typeof l.prezzoEsecuzione === 'number') return l.prezzoEsecuzione;
  return l.nominale > 0 ? l.prezzoCarico - (l.commissioni || 0) / l.nominale * 100 : l.prezzoCarico;
}
export const prezzoCaricoDa = (nominale, esecuzione, commissioni) => esecuzione + (nominale > 0 ? commissioni / nominale * 100 : 0);

// Somma i nominali dello stesso ISIN: [{ isin, nominale }]
export function sommaPerIsin(...liste) {
  const somme = new Map();
  liste.forEach(lista => lista.forEach(x => somme.set(x.isin, (somme.get(x.isin) || 0) + x.nominale)));
  return Array.from(somme, ([isin, nominale]) => ({ isin: isin, nominale: nominale }));
}

// Confronto tra quanto hai pagato e quanto vale oggi (prezzi del file caricato).
// Conta solo i lotti il cui titolo è nel file ed è in euro; gli altri sono in "esclusi".
// - costoTitoli = nominale x prezzo di esecuzione / 100 (senza commissioni); commissioni = somma delle commissioni
// - capitaleInvestito (totale a debito) = costoTitoli + rateo - ritenutaRateo + commissioni; valoreOggi = nominale x prezzo di oggi / 100
// - variazione = valoreOggi - costoTitoli - commissioni (come il carico del broker: senza rateo né tasse sulla plusvalenza)
export function riepilogoAcquisti(lotti, titoli) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  let costoTitoli = 0, rateo = 0, ritenutaRateo = 0, commissioni = 0, valoreOggi = 0, validi = 0, esclusi = 0;
  lotti.forEach(l => {
    const t = perIsin.get(l.isin);
    if (!t || t.valuta !== VALUTA_PORTAFOGLIO) { esclusi += 1; return; }
    validi += 1;
    costoTitoli += l.nominale * prezzoEsecuzione(l) / 100;
    rateo += l.rateo || 0;
    ritenutaRateo += l.ritenutaRateo || 0;
    commissioni += l.commissioni || 0;
    valoreOggi += l.nominale * (t.prezzo || 0) / 100;
  });
  const variazione = valoreOggi - costoTitoli - commissioni; // rispetto a quanto pagato per i titoli, commissioni comprese
  return {
    costoTitoli: costoTitoli,
    rateo: rateo,
    ritenutaRateo: ritenutaRateo,
    commissioni: commissioni,
    capitaleInvestito: costoTitoli + rateo - ritenutaRateo + commissioni,
    valoreOggi: valoreOggi,
    variazione: variazione,
    variazionePct: costoTitoli + commissioni > 0 ? variazione / (costoTitoli + commissioni) * 100 : null,
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
