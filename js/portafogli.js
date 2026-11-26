// Elenco dei portafogli e dati di ciascuno (bozza + costruito), salvati nel browser.
// "Principale" usa le stesse chiavi di quando il portafoglio era uno solo: i dati esistenti non vengono spostati.
// Il salvataggio online è in sincronizzazione.js.

export const PRINCIPALE = 'principale';
export const NOME_MAX = 40;

const CHIAVE_ELENCO = 'bondfolio_portafogli_v1';
const CHIAVE_ELIMINATI = 'bondfolio_eliminati_v1'; // eliminati qui e non ancora comunicati online
const CHIAVI = { bozza: 'bondfolio_bozza_v1', costruito: 'bondfolio_costruito_v1' };

const chiave = (id, nome) => (id === PRINCIPALE ? CHIAVI[nome] : CHIAVI[nome] + ':' + id);

// { attivo, elenco: [{ id, nome }] } con "Principale" sempre al primo posto
export function leggiElenco() {
  let salvato = null;
  try { salvato = JSON.parse(localStorage.getItem(CHIAVE_ELENCO)); } catch (e) { /* si riparte da Principale */ }
  const validi = (salvato && Array.isArray(salvato.elenco) ? salvato.elenco : [])
    .filter(p => p && typeof p.id === 'string' && typeof p.nome === 'string');
  const principale = validi.find(p => p.id === PRINCIPALE) || { id: PRINCIPALE, nome: 'Principale' };
  const elenco = [principale].concat(validi.filter(p => p.id !== PRINCIPALE));
  const attivo = salvato && elenco.some(p => p.id === salvato.attivo) ? salvato.attivo : PRINCIPALE;
  return { attivo: attivo, elenco: elenco };
}

// Ogni modifica rilegge prima l'elenco salvato, così due schede aperte non si cancellano i portafogli a vicenda
function modifica(funzione) {
  const dati = leggiElenco();
  funzione(dati);
  try { localStorage.setItem(CHIAVE_ELENCO, JSON.stringify(dati)); return true; } catch (e) { return false; }
}

export function nomePortafoglio(id) {
  const p = leggiElenco().elenco.find(x => x.id === id);
  return p ? p.nome : '';
}

// Nome ripulito e diverso da quelli già usati: "Prova" -> "Prova (2)"
export function nomeLibero(nome, escluso) {
  const base = String(nome || '').trim().replace(/\s+/g, ' ').slice(0, NOME_MAX) || 'Portafoglio';
  const usati = new Set(leggiElenco().elenco.filter(p => p.id !== escluso).map(p => p.nome.toLowerCase()));
  let risultato = base;
  for (let n = 2; usati.has(risultato.toLowerCase()); n++) risultato = base + ' (' + n + ')';
  return risultato;
}

export function leggiLista(id, nome) {
  try {
    const lista = JSON.parse(localStorage.getItem(chiave(id, nome)) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

export function scriviLista(id, nome, lista) {
  try { localStorage.setItem(chiave(id, nome), JSON.stringify(lista)); return true; } catch (e) { return false; }
}

export function leggiEliminati() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHIAVE_ELIMINATI) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

function scriviEliminati(lista) {
  try { localStorage.setItem(CHIAVE_ELIMINATI, JSON.stringify(lista)); } catch (e) { /* niente da fare */ }
}

export function dimenticaEliminato(id) {
  const lista = leggiEliminati();
  if (lista.includes(id)) scriviEliminati(lista.filter(x => x !== id));
}

export const nuovoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function creaPortafoglio(nome, id = nuovoId()) {
  const libero = nomeLibero(nome, id);
  dimenticaEliminato(id); // ricreato (per esempio importando un file): non è più da eliminare
  modifica(d => { if (!d.elenco.some(p => p.id === id)) d.elenco.push({ id: id, nome: libero }); });
  return id;
}

export function rinominaPortafoglio(id, nome) {
  const libero = nomeLibero(nome, id);
  modifica(d => { d.elenco.forEach(p => { if (p.id === id) p.nome = libero; }); });
}

// "Principale" non si può eliminare
export function eliminaPortafoglio(id) {
  if (id === PRINCIPALE) return;
  modifica(d => {
    d.elenco = d.elenco.filter(p => p.id !== id);
    if (d.attivo === id) d.attivo = PRINCIPALE;
  });
  scriviEliminati(leggiEliminati().filter(x => x !== id).concat(id));
  try {
    localStorage.removeItem(chiave(id, 'bozza'));
    localStorage.removeItem(chiave(id, 'costruito'));
  } catch (e) { /* niente da fare */ }
}

export function segnaAttivo(id) {
  modifica(d => { if (d.elenco.some(p => p.id === id)) d.attivo = id; });
}

// Titoli presenti in almeno un portafoglio
export function tuttiGliIsin() {
  const isin = new Set();
  leggiElenco().elenco.forEach(p => ['bozza', 'costruito'].forEach(nome =>
    leggiLista(p.id, nome).forEach(x => isin.add(x.isin))));
  return Array.from(isin);
}
