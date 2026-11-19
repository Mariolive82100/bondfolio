// Schermata 1: caricamento del file con l'elenco delle obbligazioni

import { stato, impostaDati } from './state.js';
import { leggiCsv } from './csv-loader.js';
import { salva, carica, elimina } from './archivio.js';

const radice = document.getElementById('view-dati');
let messaggio = null; // { tipo: 'errore' | 'avviso', testo: '...' }

function esc(testo) {
  return String(testo).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatoData(iso) {
  if (!iso) return '—';
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function formatoDataOra(isoCompleto) {
  const d = new Date(isoCompleto);
  return d.toLocaleDateString('it-IT') + ' ' +
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function disegna() {
  const m = stato.meta;

  let html = `
    <div class="dropzone" id="dropzone">
      <div class="dropzone-icona">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>
      </div>
      <div class="dropzone-titolo">Trascina qui il file CSV</div>
      <div class="dropzone-testo">Scaricato da Simple Tools for Investors con l'elenco delle obbligazioni MOT. Viene letto direttamente nel browser.</div>
      <button class="btn btn-primario" id="btn-scegli">Scegli file</button>
      <input type="file" id="input-file" accept=".csv,.txt" hidden>
    </div>`;

  if (messaggio) {
    html += `<div class="messaggio messaggio-${messaggio.tipo}">${esc(messaggio.testo)}</div>`;
  }

  if (m) {
    const valute = Object.keys(m.valute)
      .sort((a, b) => m.valute[b] - m.valute[a])
      .map(v => `<span class="chip">${esc(v)} <strong>${m.valute[v].toLocaleString('it-IT')}</strong></span>`)
      .join('');

    html += `
      <div class="riga-card">
        <div class="card card-flex">
          <div class="card-titolo">File caricato</div>
          <div>${esc(m.nomeFile)}</div>
          <div class="testo-soft">${m.righe.toLocaleString('it-IT')} titoli · prezzi del ${formatoData(m.dataRiferimento)}</div>
          <div class="testo-soft">Caricato il ${formatoDataOra(m.caricatoIl)}. Resta salvato nel browser: non serve ricaricarlo a ogni apertura.</div>
          <div class="gruppo-bottoni">
            <button class="btn btn-primario" id="btn-vai">Vai alla selezione</button>
            <button class="btn btn-secondario" id="btn-rimuovi">Rimuovi dati</button>
          </div>
        </div>
        <div class="card card-flex">
          <div class="card-titolo">Titoli per valuta</div>
          <div class="chips">${valute}</div>
        </div>
      </div>`;
  }

  radice.innerHTML = html;
  collega();
}

function collega() {
  const zona = document.getElementById('dropzone');
  const input = document.getElementById('input-file');

  document.getElementById('btn-scegli').addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) leggiFile(input.files[0]); });

  zona.addEventListener('dragover', e => { e.preventDefault(); zona.classList.add('is-over'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('is-over'));
  zona.addEventListener('drop', e => {
    e.preventDefault();
    zona.classList.remove('is-over');
    if (e.dataTransfer.files[0]) leggiFile(e.dataTransfer.files[0]);
  });

  const vai = document.getElementById('btn-vai');
  if (vai) {
    vai.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('vai-a', { detail: 'selezione' }));
    });
  }

  const rimuovi = document.getElementById('btn-rimuovi');
  if (rimuovi) {
    rimuovi.addEventListener('click', () => {
      elimina();
      messaggio = null;
      impostaDati([], null);
      disegna();
    });
  }
}

async function leggiFile(file) {
  try {
    const testo = await file.text();
    const risultato = leggiCsv(testo, file.name);
    impostaDati(risultato.titoli, risultato.meta);
    const salvato = salva(risultato.titoli, risultato.meta);
    messaggio = salvato ? null : {
      tipo: 'avviso',
      testo: 'File letto, ma non è stato possibile salvarlo nel browser: dovrai ricaricarlo alla prossima apertura.'
    };
  } catch (errore) {
    messaggio = { tipo: 'errore', testo: errore.message };
  }
  disegna();
}

// Avvio: se c'è già un file salvato nel browser lo ricarico
const salvati = carica();
if (salvati && salvati.titoli && salvati.meta) {
  impostaDati(salvati.titoli, salvati.meta);
}
disegna();
