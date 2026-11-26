// Salvataggio nel browser dell'elenco delle obbligazioni letto dal file (non va su Firebase).
// I portafogli sono in portafogli.js.

const CHIAVE = 'bondfolio_dati_v1';

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
