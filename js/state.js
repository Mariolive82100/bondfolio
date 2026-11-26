// Dati condivisi tra le schermate (restano in memoria finché la pagina è aperta)

import { caricaBozza, salvaBozza, caricaCostruito, salvaCostruito } from './archivio.js';

export const stato = {
  titoli: [],              // elenco obbligazioni letto dal file
  meta: null,              // informazioni sul file (nome, data, numero titoli...)
  bozza: caricaBozza(),    // titoli scelti per il portafoglio: [{ isin, nominale }]
  costruito: caricaCostruito() // acquisti confermati: [{ id, isin, nominale, prezzoCarico, data, commissioni }]
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

export function impostaCostruito(lista) {
  stato.costruito = lista;
  salvaCostruito(lista);
  document.dispatchEvent(new CustomEvent('costruito-aggiornato'));
}

// Come impostaCostruito, ma senza ridisegnare la schermata: serve per le correzioni scritte dentro la tabella,
// così il cursore resta dove sta (chi chiama aggiorna da sé i numeri che cambiano).
export function correggiCostruito(lista) {
  stato.costruito = lista;
  salvaCostruito(lista);
  document.dispatchEvent(new CustomEvent('costruito-corretto')); // serve al salvataggio online
}
