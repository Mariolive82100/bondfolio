// Esportazione e importazione dei portafogli (bozza + portafoglio costruito) in un file .json,
// per spostarli su un altro computer. Il file CSV con i titoli non è incluso: va caricato a parte.

import { stato } from './state.js';
import { VERSIONE } from './versione.js';
import { oggiIso } from './formati.js';

export function nomeFileEsportazione() {
  return 'bondfolio-portafogli-' + oggiIso() + '.json';
}

export function haPortafogli() {
  return stato.bozza.length > 0 || stato.costruito.length > 0;
}

export function creaEsportazione() {
  return JSON.stringify({
    app: 'BondFolio',
    formato: 1,
    versione: VERSIONE,
    esportatoIl: new Date().toISOString(),
    bozza: stato.bozza,
    costruito: stato.costruito
  }, null, 2);
}

// Fa scaricare un file di testo dal browser
export function scaricaTesto(nomeFile, testo) {
  const blob = new Blob([testo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const numero = (v, min) => typeof v === 'number' && Number.isFinite(v) && v >= min;
const dataValida = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Legge il testo di un file esportato e restituisce { bozza, costruito, scartati }.
// Le voci non valide vengono scartate (e contate); un file che non è di BondFolio dà un errore.
export function leggiImportazione(testo) {
  let dati;
  try { dati = JSON.parse(testo); } catch (e) { throw new Error('Il file non è leggibile: non è un file esportato da BondFolio.'); }
  if (!dati || dati.app !== 'BondFolio' || !Array.isArray(dati.bozza) || !Array.isArray(dati.costruito)) {
    throw new Error('Questo non sembra un file di portafogli esportato da BondFolio.');
  }

  let scartati = 0;
  const bozza = [];
  dati.bozza.forEach(b => {
    if (b && typeof b.isin === 'string' && b.isin !== '' && numero(b.nominale, 1)) bozza.push({ isin: b.isin, nominale: b.nominale });
    else scartati += 1;
  });

  const costruito = [];
  const usati = new Set();
  dati.costruito.forEach(l => {
    if (!l || typeof l.isin !== 'string' || l.isin === '' || !numero(l.nominale, 1) || !(l.prezzoCarico > 0) || !dataValida(l.data)) {
      scartati += 1;
      return;
    }
    let id = typeof l.id === 'string' && l.id !== '' && !usati.has(l.id) ? l.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    usati.add(id);
    costruito.push({
      id: id,
      isin: l.isin,
      nominale: l.nominale,
      prezzoCarico: l.prezzoCarico,
      data: l.data,
      dataRegolamento: dataValida(l.dataRegolamento) ? l.dataRegolamento : l.data,
      rateo: numero(l.rateo, 0) ? l.rateo : 0,
      ritenutaRateo: numero(l.ritenutaRateo, 0) ? l.ritenutaRateo : 0,
      commissioni: numero(l.commissioni, 0) ? l.commissioni : 0
    });
  });

  return { bozza: bozza, costruito: costruito, scartati: scartati };
}
