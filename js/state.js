// Dati condivisi tra le schermate (restano in memoria finché la pagina è aperta)

import { leggiElenco, leggiLista, scriviLista, segnaAttivo } from './portafogli.js';

const attivo = leggiElenco().attivo;

export const stato = {
  titoli: [],              // elenco obbligazioni letto dal file
  meta: null,              // informazioni sul file (nome, data, numero titoli...)
  portafoglio: attivo,     // identificativo del portafoglio selezionato
  bozza: leggiLista(attivo, 'bozza'),         // del portafoglio selezionato: [{ isin, nominale }]
  costruito: leggiLista(attivo, 'costruito')  // acquisti confermati: [{ id, isin, nominale, prezzoCarico, data, commissioni }]
};

const avvisa = evento => document.dispatchEvent(new CustomEvent(evento));

export function impostaDati(titoli, meta) {
  stato.titoli = titoli;
  stato.meta = meta;
  avvisa('dati-aggiornati');
}

export function impostaBozza(lista) {
  stato.bozza = lista;
  scriviLista(stato.portafoglio, 'bozza', lista);
  avvisa('bozza-aggiornata');
}

export function impostaCostruito(lista) {
  stato.costruito = lista;
  scriviLista(stato.portafoglio, 'costruito', lista);
  avvisa('costruito-aggiornato');
}

// Come impostaCostruito, ma senza ridisegnare la schermata: serve per le correzioni scritte dentro la tabella,
// così il cursore resta dove sta (chi chiama aggiorna da sé i numeri che cambiano).
export function correggiCostruito(lista) {
  stato.costruito = lista;
  scriviLista(stato.portafoglio, 'costruito', lista);
  avvisa('costruito-corretto'); // serve al salvataggio online
}

// Bozza o costruito di un portafoglio qualsiasi, anche non selezionato. nome = 'bozza' oppure 'costruito'
export function listaDi(id, nome) {
  return id === stato.portafoglio ? stato[nome] : leggiLista(id, nome);
}

export function impostaListaDi(id, nome, lista) {
  if (id !== stato.portafoglio) scriviLista(id, nome, lista);
  else if (nome === 'bozza') impostaBozza(lista);
  else impostaCostruito(lista);
}

// Seleziona un altro portafoglio e ridisegna tutte le schermate
export function cambiaPortafoglio(id) {
  segnaAttivo(id);
  stato.portafoglio = id;
  stato.bozza = leggiLista(id, 'bozza');
  stato.costruito = leggiLista(id, 'costruito');
  ['portafoglio-cambiato', 'bozza-aggiornata', 'costruito-aggiornato'].forEach(avvisa);
}
