// Rende l'app installabile: attiva il service worker (file sw.js nella cartella principale)

export function avviaPwa() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(e => {
    console.warn('Service worker non attivato:', e);
  });
}
