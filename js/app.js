// Gestione della navigazione tra le 4 schermate

const TESTI = {
  dati: ['Dati', "Carica l'elenco delle obbligazioni scaricato da Simple Tools for Investors"],
  selezione: ['Selezione', 'Filtra le obbligazioni e aggiungile al portafoglio'],
  portafoglio: ['Portafoglio', 'Assegna i nominali e controlla i pesi'],
  analisi: ['Analisi', 'Rendimento, duration, cedole e diversificazione']
};

const voci = document.querySelectorAll('.nav-item');
const viste = document.querySelectorAll('.view');
const titolo = document.getElementById('titolo');
const sottotitolo = document.getElementById('sottotitolo');

function mostra(nome) {
  voci.forEach(v => v.classList.toggle('is-active', v.dataset.view === nome));
  viste.forEach(v => { v.hidden = (v.id !== 'view-' + nome); });
  titolo.textContent = TESTI[nome][0];
  sottotitolo.textContent = TESTI[nome][1];
}

voci.forEach(v => v.addEventListener('click', () => mostra(v.dataset.view)));

mostra('dati');
