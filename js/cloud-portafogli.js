// Lettura e scrittura dei portafogli su Firestore.
// Un documento per portafoglio: utenti/{uid}/elencoPortafogli/{id}
//   { aggiornato, nome, eliminato, bozza: [...], costruito: [...] }
// Un portafoglio eliminato resta come documento con eliminato = true, così gli altri dispositivi lo vengono a sapere.
// I documenti delle versioni con un solo portafoglio (utenti/{uid}/portafogli/bozza e .../costruito)
// vengono solo letti, finché non esiste quello nuovo di "Principale": non vengono più modificati.

import { avviaFirebase, moduloFirebase } from './firebase-config.js';
import { PRINCIPALE } from './portafogli.js';

export const NOMI = ['bozza', 'costruito'];
const CAMPO_VECCHIO = { bozza: 'titoli', costruito: 'acquisti' };
const RACCOLTA = 'elencoPortafogli';

// "firestore-lite" è la versione leggera: legge e scrive solo quando lo chiediamo noi
async function prepara() {
  const app = await avviaFirebase();
  const fs = await moduloFirebase('firestore-lite');
  return { fs: fs, db: fs.getFirestore(app) };
}

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

const improntaDocumento = d => (d
  ? JSON.stringify([d.nome, d.eliminato, impronta('bozza', d.bozza), impronta('costruito', d.costruito)])
  : null);

function formatoErrato(id) {
  return new Error('Il documento online «' + id + '» non è nel formato previsto.');
}

function interpreta(id, d) {
  if (typeof d.nome !== 'string' || !Array.isArray(d.bozza) || !Array.isArray(d.costruito)) throw formatoErrato(id);
  return {
    nome: d.nome, eliminato: d.eliminato === true,
    bozza: pulisci('bozza', d.bozza), costruito: pulisci('costruito', d.costruito),
    aggiornato: d.aggiornato || null
  };
}

// "Principale" salvato da una versione precedente: gli elenchi mancanti valgono null
async function leggiVecchi(fs, db, uid) {
  const documenti = await Promise.all(NOMI.map(n => fs.getDoc(fs.doc(db, 'utenti', uid, 'portafogli', n))));
  const risultato = { nome: null, eliminato: false, bozza: null, costruito: null, aggiornato: null, vecchio: true };
  NOMI.forEach((n, i) => {
    if (!documenti[i].exists()) return;
    const d = documenti[i].data();
    if (!Array.isArray(d[CAMPO_VECCHIO[n]])) throw formatoErrato(n);
    risultato[n] = pulisci(n, d[CAMPO_VECCHIO[n]]);
    if (d.aggiornato && !(risultato.aggiornato > d.aggiornato)) risultato.aggiornato = d.aggiornato;
  });
  return NOMI.some(n => risultato[n] !== null) ? risultato : null;
}

// Restituisce una Map: id -> { nome, eliminato, bozza, costruito, aggiornato }
export async function leggiOnline(uid) {
  const { fs, db } = await prepara();
  const risposta = await fs.getDocs(fs.collection(db, 'utenti', uid, RACCOLTA));
  const risultato = new Map();
  risposta.docs.forEach(d => risultato.set(d.id, interpreta(d.id, d.data())));
  if (!risultato.has(PRINCIPALE)) {
    const vecchio = await leggiVecchi(fs, db, uid);
    if (vecchio) risultato.set(PRINCIPALE, vecchio);
  }
  return risultato;
}

// Scrive un portafoglio solo se online c'è ancora quello che avevamo letto (atteso; null = non esisteva).
// Restituisce false, senza scrivere, se nel frattempo è stato cambiato da un altro dispositivo.
export async function scriviOnline(uid, id, dati, atteso) {
  const { fs, db } = await prepara();
  const rif = fs.doc(db, 'utenti', uid, RACCOLTA, id);
  const improntaAttesa = atteso && !atteso.vecchio ? improntaDocumento(atteso) : null;
  return fs.runTransaction(db, async operazione => {
    const istantanea = await operazione.get(rif);
    const attuale = istantanea.exists() ? interpreta(id, istantanea.data()) : null;
    if (improntaDocumento(attuale) !== improntaAttesa) return false;
    operazione.set(rif, {
      aggiornato: new Date().toISOString(),
      nome: dati.nome,
      eliminato: dati.eliminato,
      bozza: pulisci('bozza', dati.bozza),
      costruito: pulisci('costruito', dati.costruito)
    });
    return true;
  });
}
