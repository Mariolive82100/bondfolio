// Salvataggio nel browser (nessun dato va su Firebase):
// - l'elenco delle obbligazioni letto dal file
// - la bozza di portafoglio

const CHIAVE = 'bondfolio_dati_v1';
const CHIAVE_BOZZA = 'bondfolio_bozza_v1';

export function salva(titoli, meta) {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify({ titoli: titoli, meta: meta }));
    return true;
  } catch (e) {
    return false;
  }
}

export function carica() {
  try {
    const testo = localStorage.getItem(CHIAVE);
    return testo ? JSON.parse(testo) : null;
  } catch (e) {
    return null;
  }
}

export function elimina() {
  try { localStorage.removeItem(CHIAVE); } catch (e) { /* niente da fare */ }
}

export function salvaBozza(lista) {
  try {
    localStorage.setItem(CHIAVE_BOZZA, JSON.stringify(lista));
    return true;
  } catch (e) {
    return false;
  }
}

export function caricaBozza() {
  try {
    const testo = localStorage.getItem(CHIAVE_BOZZA);
    const lista = testo ? JSON.parse(testo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

// Portafoglio costruito: lista di acquisti { id, isin, nominale, prezzoCarico, data, commissioni }
const CHIAVE_COSTRUITO = 'bondfolio_costruito_v1';

export function salvaCostruito(lista) {
  try {
    localStorage.setItem(CHIAVE_COSTRUITO, JSON.stringify(lista));
    return true;
  } catch (e) {
    return false;
  }
}

export function caricaCostruito() {
  try {
    const testo = localStorage.getItem(CHIAVE_COSTRUITO);
    const lista = testo ? JSON.parse(testo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}
