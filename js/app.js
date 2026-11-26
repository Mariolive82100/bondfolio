// Gestione della navigazione tra le 3 schermate

import { VERSIONE } from './versione.js';
import './vista-dati.js';
import './vista-selezione.js';
import './vista-portafoglio.js';
import './vista-account.js';

const TESTI = {
  dati: ['Dati', "Carica l'elenco delle obbligazioni scaricato da Simple Tools for Investors"],
  selezione: ['Selezione', 'Filtra le obbligazioni e aggiungile al portafoglio'],
  portafoglio: ['Portafoglio e analisi', 'Modifica i nominali e guarda subito rendimento, duration, cedole e diversificazione']
};

const voci = document.querySelectorAll('.nav-item');
const viste = document.querySelectorAll('.view');
const titolo = document.getElementById('titolo');
const sottotitolo = document.getElementById('sottotitolo');

document.getElementById('versione').textContent = 'v' + VERSIONE;

function mostra(nome) {
  voci.forEach(v => v.classList.toggle('is-active', v.dataset.view === nome));
  viste.forEach(v => { v.hidden = (v.id !== 'view-' + nome); });
  titolo.textContent = TESTI[nome][0];
  sottotitolo.textContent = TESTI[nome][1];
}

voci.forEach(v => v.addEventListener('click', () => mostra(v.dataset.view)));

// Le altre schermate possono chiedere di spostarsi su un'altra voce
document.addEventListener('vai-a', e => mostra(e.detail));

// All'avvio: se i dati sono già nel browser parto dalla Selezione, altrimenti da Dati
const datiPresenti = localStorage.getItem('bondfolio_dati_v1') !== null;
mostra(datiPresenti ? 'selezione' : 'dati');
