// Dati condivisi tra le schermate (restano in memoria finché la pagina è aperta)

import { caricaBozza, salvaBozza, caricaImpostazioni, salvaImpostazioni } from './archivio.js';
import { IMPOSTAZIONI_INIZIALI } from './costruttore.js';

export const stato = {
  titoli: [],              // elenco obbligazioni letto dal file
  meta: null,              // informazioni sul file (nome, data, numero titoli...)
  bozza: caricaBozza(),    // titoli scelti per il portafoglio: [{ isin, nominale }]
  // capitale disponibile e parametri di costruzione automatica
  impostazioni: Object.assign({}, IMPOSTAZIONI_INIZIALI, caricaImpostazioni())
};

export function impostaDati(titoli, meta) {
  stato.titoli = titoli;
  stato.meta = meta;
  document.dispatchEvent(new CustomEvent('dati-aggiornati'));
}

export function impostaBozza(lista) {
  stato.bozza = lista;
  salvaBozza(lista);
  document.dispatchEvent(new CustomEvent('bozza-aggiornata'));
}

export function impostaImpostazioni(parziale) {
  stato.impostazioni = Object.assign({}, stato.impostazioni, parziale);
  salvaImpostazioni(stato.impostazioni);
  document.dispatchEvent(new CustomEvent('impostazioni-aggiornate'));
}
