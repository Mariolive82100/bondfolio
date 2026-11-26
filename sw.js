// Service worker minimo di BondFolio.
// Con la connessione usa SEMPRE i file online (così gli aggiornamenti arrivano subito);
// la copia salvata serve solo quando la rete non risponde.
// Gestisce soltanto i file dell'app: accesso e database (Google, Firebase) passano direttamente dalla rete.

const CACHE = 'bondfolio-app-v1';

// File salvati subito all'installazione. Quando si aggiunge un file all'app, va aggiunto anche qui.
const FILE_APP = [
  './',
  'index.html',
  'manifest.json',
  'icone/icona-192.png',
  'icone/icona-512.png',
  'icone/icona-maschera-512.png',
  'css/account.css',
  'css/base.css',
  'css/componenti.css',
  'css/grafici.css',
  'css/layout.css',
  'css/mobile.css',
  'css/portafoglio.css',
  'css/portafogli.css',
  'css/selezione.css',
  'js/analisi-pannello.js',
  'js/app.js',
  'js/archivio.js',
  'js/auth.js',
  'js/capital-gain.js',
  'js/cashflow-calcoli.js',
  'js/cashflow-dati.js',
  'js/cloud-cashflow.js',
  'js/cloud-portafogli.js',
  'js/comprimibile.js',
  'js/costruito-calcoli.js',
  'js/csv-loader.js',
  'js/data-calcolo.js',
  'js/esporta-importa.js',
  'js/filtri.js',
  'js/firebase-config.js',
  'js/formati.js',
  'js/grafici.js',
  'js/portafoglio-calcoli.js',
  'js/portafogli.js',
  'js/pwa.js',
  'js/rating.js',
  'js/rendimento.js',
  'js/sincronizzazione.js',
  'js/state.js',
  'js/versione.js',
  'js/vista-account.js',
  'js/vista-costruito.js',
  'js/vista-dati.js',
  'js/vista-portafogli.js',
  'js/vista-portafoglio.js',
  'js/vista-selezione.js'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILE_APP.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Elimina solo le vecchie copie di BondFolio (lo stesso indirizzo github.io può ospitare altre app)
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomi => Promise.all(nomi.filter(n => n.startsWith('bondfolio-') && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const richiesta = evento.request;
  const url = new URL(richiesta.url);
  if (richiesta.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  evento.respondWith(primaLaRete(richiesta));
});

async function primaLaRete(richiesta) {
  const cache = await caches.open(CACHE);
  // L'indirizzo senza la parte dopo "?" è la chiave della copia salvata
  const chiave = richiesta.url.split('?')[0];
  try {
    // 'no-cache': chiede sempre al sito se il file è cambiato
    const risposta = await fetch(richiesta.url, { cache: 'no-cache', credentials: 'same-origin' });
    if (risposta.ok && !risposta.redirected) await cache.put(chiave, risposta.clone()).catch(() => {});
    return risposta;
  } catch (errore) {
    const salvata = await cache.match(chiave);
    if (salvata) return salvata;
    throw errore;
  }
}
