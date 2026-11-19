// Dati condivisi tra le schermate (restano in memoria finché la pagina è aperta)

import { caricaBozza, salvaBozza } from './archivio.js';

export const stato = {
  titoli: [],              // elenco obbligazioni letto dal file
  meta: null,              // informazioni sul file (nome, data, numero titoli...)
  bozza: caricaBozza()     // titoli scelti per il portafoglio: [{ isin, nominale }]
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
