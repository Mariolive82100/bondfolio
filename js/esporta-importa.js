// Esportazione e importazione di tutti i portafogli (bozza + costruito di ciascuno) in un file .json,
// per spostarli su un altro computer. Il file CSV con i titoli non è incluso: va caricato a parte.

import { stato, listaDi, impostaListaDi, cambiaPortafoglio } from './state.js';
import { PRINCIPALE, leggiElenco, creaPortafoglio, rinominaPortafoglio } from './portafogli.js';
import { VERSIONE } from './versione.js';
import { oggiIso } from './formati.js';

export function nomeFileEsportazione() {
  return 'bondfolio-portafogli-' + oggiIso() + '.json';
}

export function haPortafogli() {
  const { elenco } = leggiElenco();
  return elenco.length > 1 || listaDi(PRINCIPALE, 'bozza').length > 0 || listaDi(PRINCIPALE, 'costruito').length > 0;
}

export function creaEsportazione() {
  return JSON.stringify({
    app: 'BondFolio',
    formato: 2,
    versione: VERSIONE,
    esportatoIl: new Date().toISOString(),
    portafogli: leggiElenco().elenco.map(p => ({
      id: p.id, nome: p.nome, bozza: listaDi(p.id, 'bozza'), costruito: listaDi(p.id, 'costruito')
    }))
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

const ERRORE_FORMATO = 'Questo non sembra un file di portafogli esportato da BondFolio.';

// Tiene le voci valide di una bozza e di un costruito; conta quelle scartate
function controlla(vociBozza, vociCostruito) {
  let scartati = 0;
  const bozza = [];
  vociBozza.forEach(b => {
    if (b && typeof b.isin === 'string' && b.isin !== '' && numero(b.nominale, 1)) bozza.push({ isin: b.isin, nominale: b.nominale });
    else scartati += 1;
  });

  const costruito = [];
  const usati = new Set();
  vociCostruito.forEach(l => {
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
      commissioni: numero(l.commissioni, 0) ? l.commissioni : 0
    });
  });

  return { bozza: bozza, costruito: costruito, scartati: scartati };
}

const haElenchi = p => p && Array.isArray(p.bozza) && Array.isArray(p.costruito);

// Legge il testo di un file esportato e restituisce { formato, portafogli: [{ id, nome, bozza, costruito }], scartati }.
// formato 1 = file delle versioni con un solo portafoglio (id e nome sono null).
// Le voci non valide vengono scartate (e contate); un file che non è di BondFolio dà un errore.
export function leggiImportazione(testo) {
  let dati;
  try { dati = JSON.parse(testo); } catch (e) { throw new Error('Il file non è leggibile: non è un file esportato da BondFolio.'); }
  if (!dati || dati.app !== 'BondFolio') throw new Error(ERRORE_FORMATO);

  const formato = Array.isArray(dati.portafogli) ? 2 : 1;
  const grezzi = formato === 2 ? dati.portafogli : [dati];
  const idValido = id => typeof id === 'string' && /^[a-z0-9]{1,30}$/.test(id);
  if (grezzi.length === 0 || !grezzi.every(p => haElenchi(p) && (formato === 1 || (idValido(p.id) && typeof p.nome === 'string')))) {
    throw new Error(ERRORE_FORMATO);
  }
  if (new Set(grezzi.map(p => p.id)).size !== grezzi.length) throw new Error(ERRORE_FORMATO);

  let scartati = 0;
  const portafogli = grezzi.map(p => {
    const r = controlla(p.bozza, p.costruito);
    scartati += r.scartati;
    return { id: formato === 2 ? p.id : null, nome: formato === 2 ? p.nome : null, bozza: r.bozza, costruito: r.costruito };
  });

  return { formato: formato, portafogli: portafogli, scartati: scartati };
}

// Scrive nel browser quello che è stato letto.
// Formato 1: sostituisce il portafoglio selezionato. Formato 2: sostituisce i portafogli presenti nel file
// (riconosciuti dall'identificativo), aggiunge quelli nuovi e non tocca gli altri.
export function applicaImportazione(r) {
  if (r.formato === 1) {
    impostaListaDi(stato.portafoglio, 'bozza', r.portafogli[0].bozza);
    impostaListaDi(stato.portafoglio, 'costruito', r.portafogli[0].costruito);
    return;
  }
  r.portafogli.forEach(p => {
    if (leggiElenco().elenco.some(x => x.id === p.id)) rinominaPortafoglio(p.id, p.nome);
    else creaPortafoglio(p.nome, p.id);
    impostaListaDi(p.id, 'bozza', p.bozza);
    impostaListaDi(p.id, 'costruito', p.costruito);
  });
  cambiaPortafoglio(stato.portafoglio); // aggiorna barra e schermate
}
