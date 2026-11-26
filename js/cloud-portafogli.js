// Lettura e scrittura di bozza e portafoglio Costruito su Firestore.
// Un documento per ciascuno: utenti/{uid}/portafogli/bozza e .../costruito

import { avviaFirebase, moduloFirebase } from './firebase-config.js';

export const NOMI = ['bozza', 'costruito'];
const CAMPO = { bozza: 'titoli', costruito: 'acquisti' }; // nome dell'elenco dentro il documento

// "firestore-lite" è la versione leggera: legge e scrive solo quando lo chiediamo noi
async function prepara() {
  const app = await avviaFirebase();
  const fs = await moduloFirebase('firestore-lite');
  return { fs: fs, db: fs.getFirestore(app) };
}

const riferimento = (fs, db, uid, nome) => fs.doc(db, 'utenti', uid, 'portafogli', nome);

// Tiene solo i campi da salvare, sempre nello stesso ordine
export function pulisci(nome, lista) {
  const v = x => (x === undefined ? null : x);
  if (nome === 'bozza') return lista.map(b => ({ isin: v(b.isin), nominale: v(b.nominale) }));
  return lista.map(l => ({
    id: v(l.id), isin: v(l.isin), nominale: v(l.nominale),
    prezzoCarico: v(l.prezzoCarico), data: v(l.data), commissioni: l.commissioni || 0
  }));
}

// Testo che rappresenta il contenuto di un elenco: due elenchi uguali danno lo stesso testo
export function impronta(nome, lista) {
  return JSON.stringify(pulisci(nome, lista));
}

function leggiDocumento(nome, istantanea) {
  if (!istantanea.exists()) return null;
  const d = istantanea.data();
  if (!Array.isArray(d[CAMPO[nome]])) throw new Error('Il documento online «' + nome + '» non è nel formato previsto.');
  return { lista: pulisci(nome, d[CAMPO[nome]]), aggiornato: d.aggiornato || null };
}

// Restituisce { bozza, costruito }: per ciascuno { lista, aggiornato }, oppure null se online non c'è ancora
export async function leggiOnline(uid) {
  const { fs, db } = await prepara();
  const documenti = await Promise.all(NOMI.map(n => fs.getDoc(riferimento(fs, db, uid, n))));
  const risultato = {};
  NOMI.forEach((n, i) => { risultato[n] = leggiDocumento(n, documenti[i]); });
  return risultato;
}

// Scrive un elenco solo se online c'è ancora quello che avevamo letto (improntaAttesa; null = non esisteva).
// Restituisce false, senza scrivere, se nel frattempo è stato cambiato da un altro dispositivo.
export async function scriviOnline(uid, nome, lista, improntaAttesa) {
  const { fs, db } = await prepara();
  const rif = riferimento(fs, db, uid, nome);
  return fs.runTransaction(db, async operazione => {
    const attuale = leggiDocumento(nome, await operazione.get(rif));
    const improntaAttuale = attuale ? impronta(nome, attuale.lista) : null;
    if (improntaAttuale !== improntaAttesa) return false;
    operazione.set(rif, { aggiornato: new Date().toISOString(), [CAMPO[nome]]: pulisci(nome, lista) });
    return true;
  });
}
