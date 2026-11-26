// Collegamento al progetto Firebase e caricamento delle librerie direttamente da Google.
// Questi valori identificano il progetto e non sono segreti: i dati sono protetti dalle regole di sicurezza.

const VERSIONE_SDK = '13.4.0';
const BASE = 'https://www.gstatic.com/firebasejs/' + VERSIONE_SDK + '/';

const configurazione = {
  apiKey: 'AIzaSyA7xIzdcr-wvgHNECUp4ldOUJS3oOSuqbs',
  authDomain: 'bondfolio-180ad.firebaseapp.com',
  projectId: 'bondfolio-180ad',
  storageBucket: 'bondfolio-180ad.firebasestorage.app',
  messagingSenderId: '307213813607',
  appId: '1:307213813607:web:9dca73689b89a7bdba91c2'
};

let promessaApp = null;

// Carica un modulo di Firebase (es. 'app', 'auth').
// Il caricamento avviene solo quando serve: se Google non è raggiungibile, il resto dell'app funziona lo stesso.
export function moduloFirebase(nome) {
  return import(BASE + 'firebase-' + nome + '.js');
}

// Avvia Firebase una sola volta
export function avviaFirebase() {
  if (!promessaApp) {
    promessaApp = moduloFirebase('app').then(m => m.initializeApp(configurazione));
  }
  return promessaApp;
}
