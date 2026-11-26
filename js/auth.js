// Accesso e uscita con l'account Google. Nessuna grafica: la parte visibile è in vista-account.js.

import { avviaFirebase, moduloFirebase } from './firebase-config.js';

let lib = null;   // funzioni della libreria di accesso
let auth = null;

// Prepara l'accesso e avvisa a ogni cambio: suCambio(utente) riceve l'utente collegato oppure null.
export async function avviaAccesso(suCambio) {
  const app = await avviaFirebase();
  lib = await moduloFirebase('auth');
  auth = lib.getAuth(app);
  lib.onAuthStateChanged(auth, suCambio);
}

export function accedi() {
  const google = new lib.GoogleAuthProvider();
  google.setCustomParameters({ prompt: 'select_account' }); // fa sempre scegliere l'account
  return lib.signInWithPopup(auth, google);
}

export function esci() {
  return lib.signOut(auth);
}

// Traduce gli errori più comuni; restituisce null se non c'è nulla da segnalare
export function messaggioErrore(errore) {
  const codice = (errore && errore.code) || '';
  if (codice === 'auth/popup-closed-by-user' || codice === 'auth/cancelled-popup-request') return null;
  if (codice === 'auth/popup-blocked') return 'Il browser ha bloccato la finestra di accesso: consenti i popup per questo sito e riprova.';
  if (codice === 'auth/unauthorized-domain') return 'Questo indirizzo non è tra i domini autorizzati in Firebase.';
  if (codice === 'auth/operation-not-allowed') return "L'accesso con Google non è abilitato in Firebase.";
  if (codice === 'auth/network-request-failed') return 'Connessione non riuscita: controlla internet e riprova.';
  return 'Accesso non riuscito' + (codice ? ' (' + codice + ')' : '') + '.';
}
