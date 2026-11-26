// Salva su Firestore solo le voci di cashflow dei titoli presenti nella bozza o nel Costruito.
// Documento: utenti/{uid}/portafogli/cashflow  ->  { aggiornato, dati }  (dati = testo JSON: isin -> voci)

import { avviaFirebase, moduloFirebase } from './firebase-config.js';
import { voceDaFile, piuRecente, impostaCashflowOnline } from './cashflow-dati.js';

const LIMITE = 900000; // byte: un documento Firestore arriva a circa 1 MiB

// elencoIsin = titoli in bozza e nel Costruito. Scarica, aggiorna e, solo se serve, riscrive il documento.
export async function allineaCashflow(uid, elencoIsin) {
  const app = await avviaFirebase();
  const fs = await moduloFirebase('firestore-lite');
  const db = fs.getFirestore(app);
  const rif = fs.doc(db, 'utenti', uid, 'portafogli', 'cashflow');
  const isin = Array.from(new Set(elencoIsin)).sort();

  const voci = await fs.runTransaction(db, async operazione => {
    const documento = await operazione.get(rif);
    const testoPrima = documento.exists() ? documento.data().dati : null;
    const prima = testoPrima ? JSON.parse(testoPrima) : {};
    const dopo = {};
    isin.forEach(codice => {
      const scelta = piuRecente(voceDaFile(codice), prima[codice]);
      if (scelta) dopo[codice] = { dal: scelta.dal, al: scelta.al, ev: scelta.ev };
    });
    const testoDopo = JSON.stringify(dopo);
    const invariato = testoPrima === null ? testoDopo === '{}' : testoDopo === testoPrima;
    if (!invariato) {
      if (new Blob([testoDopo]).size > LIMITE) {
        throw Object.assign(new Error('Cashflow troppo grande'), { code: 'cashflow-troppo-grande' });
      }
      operazione.set(rif, { aggiornato: new Date().toISOString(), dati: testoDopo });
    }
    return dopo;
  });

  impostaCashflowOnline(voci);
}
