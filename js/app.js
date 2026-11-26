// Gestione della navigazione tra le 4 schermate

import { VERSIONE } from './versione.js';
import { avviaPwa } from './pwa.js';
import './vista-dati.js';
import './vista-selezione.js';
import './vista-portafoglio.js';
import './vista-account.js';

const TESTI = {
  dati: ['Dati', "Carica l'elenco delle obbligazioni"],
  selezione: ['Selezione', 'Filtra le obbligazioni e aggiungile al portafoglio'],
  bozza: ['Bozza', 'Simula il portafoglio: modifica i nominali e guarda subito rendimento, duration, cedole e diversificazione'],
  costruito: ['Portafoglio costruito', 'I tuoi acquisti confermati e la loro analisi']
};

const voci = document.querySelectorAll('.nav-item');
const viste = document.querySelectorAll('.view');
const titolo = document.getElementById('titolo');
const sottotitolo = document.getElementById('sottotitolo');

document.getElementById('versione').textContent = 'v' + VERSIONE;
avviaPwa();

function mostra(nome) {
  voci.forEach(v => v.classList.toggle('is-active', v.dataset.view === nome));
  // Bozza e Costruito usano la stessa area: cambia solo il contenuto
  const diPortafoglio = nome === 'bozza' || nome === 'costruito';
  const area = diPortafoglio ? 'portafoglio' : nome;
  viste.forEach(v => { v.hidden = (v.id !== 'view-' + area); });
  if (diPortafoglio) document.dispatchEvent(new CustomEvent('mostra-portafoglio', { detail: nome }));
  titolo.textContent = TESTI[nome][0];
  sottotitolo.textContent = TESTI[nome][1];
}

voci.forEach(v => v.addEventListener('click', () => mostra(v.dataset.view)));

// Le altre schermate possono chiedere di spostarsi su un'altra voce
document.addEventListener('vai-a', e => mostra(e.detail));

// All'avvio: se i dati sono già nel browser parto dalla Selezione, altrimenti da Dati
const datiPresenti = localStorage.getItem('bondfolio_dati_v1') !== null;
mostra(datiPresenti ? 'selezione' : 'dati');
