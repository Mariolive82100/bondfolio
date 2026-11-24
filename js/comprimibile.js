// Sezioni che si possono comprimere (es. le tabelle dei titoli) con un clic sull'intestazione.
// Lo stato aperta/chiusa resta salvato nel browser e si mantiene anche quando la schermata si ridisegna.

import { esc } from './formati.js';

const CHIAVE = 'bondfolio_ui_v1';

function leggi() {
  try { return JSON.parse(localStorage.getItem(CHIAVE)) || {}; } catch (e) { return {}; }
}

function scrivi(id, chiusa) {
  try {
    const stati = leggi();
    stati[id] = chiusa;
    localStorage.setItem(CHIAVE, JSON.stringify(stati));
  } catch (e) { /* niente da fare */ }
}

export function staChiusa(id) { return !!leggi()[id]; }

// Da aggiungere alla classe della scheda: " chiusa" se la sezione è compressa
export function classeChiusa(id) { return staChiusa(id) ? ' chiusa' : ''; }

// Intestazione cliccabile: titolo, riassunto (visibile soprattutto quando è chiusa) e freccia
export function testaComprimibile(id, titolo, idRiassunto, riassunto = '') {
  return `<button type="button" class="sezione-testa" data-comprimi="${esc(id)}" aria-expanded="${!staChiusa(id)}">
    <span class="card-titolo">${esc(titolo)}</span>
    <span class="testo-soft" id="${esc(idRiassunto)}">${esc(riassunto)}</span>
    <span class="freccia" aria-hidden="true">▾</span>
  </button>`;
}

document.addEventListener('click', e => {
  const bottone = e.target.closest('[data-comprimi]');
  if (!bottone) return;
  const scheda = bottone.closest('.card');
  const chiusa = !scheda.classList.contains('chiusa');
  scheda.classList.toggle('chiusa', chiusa);
  bottone.setAttribute('aria-expanded', String(!chiusa));
  scrivi(bottone.dataset.comprimi, chiusa);
});
