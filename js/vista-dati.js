// Schermata 1: caricamento del file con l'elenco delle obbligazioni

import { stato, impostaDati, impostaBozza, impostaCostruito } from './state.js';
import { leggiCsv } from './csv-loader.js';
import { salva, carica, elimina } from './archivio.js';
import { leggiCashflow, impostaCashflow, rimuoviCashflow, cashflowAttuale } from './cashflow-dati.js';
import { creaEsportazione, nomeFileEsportazione, scaricaTesto, leggiImportazione, haPortafogli } from './esporta-importa.js';

const radice = document.getElementById('view-dati');
let messaggio = null; // { tipo: 'errore' | 'avviso', testo: '...' }
let messaggioPortafogli = null; // stesso formato, per la scheda dei portafogli
let messaggioCashflow = null; // stesso formato, per la scheda del calendario incassi

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
      <div class="dropzone-testo">Il file dei prezzi (End of Day) scaricato dalla sezione «Data export» di Simple Tools for Investors. Viene letto direttamente nel browser e non viene inviato da nessuna parte.</div>
      <button class="btn btn-secondario" id="btn-scegli">Scegli file</button>
      <input type="file" id="input-file" hidden>
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

  const cf = cashflowAttuale();
  let corpoCashflow;
  if (cf) {
    const giorniVecchio = Math.round((Date.now() - new Date(cf.dataAcquisto + 'T00:00:00')) / 86400000);
    corpoCashflow = `
      <div>${esc(cf.nomeFile)}</div>
      <div class="testo-soft">${cf.perIsin.size.toLocaleString('it-IT')} titoli · calendario calcolato dal ${formatoData(cf.dataAcquisto)}. Caricato il ${formatoDataOra(cf.caricatoIl)}.</div>
      ${giorniVecchio > 7 ? '<div class="messaggio messaggio-avviso">Il file ha più di una settimana: le cedole già incassate vengono escluse, ma conviene riscaricarlo.</div>' : ''}
      <div class="gruppo-bottoni">
        <button class="btn btn-secondario" id="btn-scegli-cashflow">Sostituisci file</button>
        <button class="btn btn-secondario" id="btn-rimuovi-cashflow">Rimuovi</button>
      </div>`;
  } else {
    corpoCashflow = `
      <div class="testo-soft">Non ancora caricato: finché manca, il portafoglio mostra una stima di cedole e rimborsi.</div>
      <div class="gruppo-bottoni">
        <button class="btn btn-primario" id="btn-scegli-cashflow">Scegli file cashflow</button>
      </div>`;
  }
  html += `
    <div class="card card-flex">
      <div class="card-titolo">Calendario incassi (facoltativo)</div>
      <div class="testo-soft">Il file dei cashflow scaricato dalla sezione «Data export» di Simple Tools for Investors. Con questo file l'analisi del portafoglio mostra date e importi reali di cedole, tasse e rimborsi. Viene letto nel tuo browser e non viene inviato da nessuna parte.</div>
      ${corpoCashflow}
      <input type="file" id="input-cashflow" accept=".csv,text/csv" hidden>
      ${messaggioCashflow ? `<div class="messaggio messaggio-${messaggioCashflow.tipo}">${esc(messaggioCashflow.testo)}</div>` : ''}
    </div>

    <div class="card card-flex scheda-portafogli">
      <div class="card-titolo">Portafogli: esporta e importa</div>
      <div class="testo-soft">Per portare la bozza e il portafoglio costruito su un altro computer: esporta il file qui, aprilo su quel computer con «Importa portafogli». Il file dei titoli (CSV) non è incluso: va caricato a mano.</div>
      <div class="gruppo-bottoni">
        <button class="btn btn-primario" id="btn-esporta">Esporta portafogli</button>
        <button class="btn btn-secondario" id="btn-importa">Importa portafogli</button>
        <input type="file" id="input-importa" accept=".json,application/json" hidden>
      </div>
      ${messaggioPortafogli ? `<div class="messaggio messaggio-${messaggioPortafogli.tipo}">${esc(messaggioPortafogli.testo)}</div>` : ''}
    </div>`;

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

  const inputCashflow = document.getElementById('input-cashflow');
  document.getElementById('btn-scegli-cashflow').addEventListener('click', () => inputCashflow.click());
  inputCashflow.addEventListener('change', () => { if (inputCashflow.files[0]) leggiFileCashflow(inputCashflow.files[0]); });
  const rimuoviCf = document.getElementById('btn-rimuovi-cashflow');
  if (rimuoviCf) {
    rimuoviCf.addEventListener('click', () => {
      rimuoviCashflow();
      messaggioCashflow = null;
      disegna();
    });
  }

  document.getElementById('btn-esporta').addEventListener('click', () => {
    if (!haPortafogli()) {
      messaggioPortafogli = { tipo: 'avviso', testo: 'Non c\'è ancora nessun portafoglio da esportare: la bozza e il costruito sono vuoti.' };
    } else {
      scaricaTesto(nomeFileEsportazione(), creaEsportazione());
      messaggioPortafogli = { tipo: 'ok', testo: 'File esportato: lo trovi nella cartella dei download (' + nomeFileEsportazione() + ').' };
    }
    disegna();
  });

  const inputImporta = document.getElementById('input-importa');
  document.getElementById('btn-importa').addEventListener('click', () => inputImporta.click());
  inputImporta.addEventListener('change', () => { if (inputImporta.files[0]) importaFile(inputImporta.files[0]); });

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

async function importaFile(file) {
  try {
    const r = leggiImportazione(await file.text());
    if (haPortafogli() && !confirm('L\'importazione sostituisce la bozza (' + stato.bozza.length + ' titoli) e il portafoglio costruito (' +
      stato.costruito.length + ' acquisti) che hai ora in questo browser. Continuare?')) return;
    impostaBozza(r.bozza);
    impostaCostruito(r.costruito);
    messaggioPortafogli = {
      tipo: r.scartati > 0 ? 'avviso' : 'ok',
      testo: 'Importati ' + r.bozza.length + (r.bozza.length === 1 ? ' titolo' : ' titoli') + ' in bozza e ' + r.costruito.length + (r.costruito.length === 1 ? ' acquisto' : ' acquisti') + ' nel portafoglio costruito.' +
        (r.scartati > 0 ? ' Voci scartate perché non valide: ' + r.scartati + '.' : '')
    };
  } catch (errore) {
    messaggioPortafogli = { tipo: 'errore', testo: errore.message };
  }
  disegna();
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

async function leggiFileCashflow(file) {
  try {
    const risultato = leggiCashflow(await file.text());
    const salvato = impostaCashflow(risultato, file.name);
    messaggioCashflow = salvato
      ? { tipo: 'ok', testo: 'Calendario caricato: ' + risultato.perIsin.size.toLocaleString('it-IT') + ' titoli.' }
      : { tipo: 'avviso', testo: 'File letto, ma non è stato possibile salvarlo nel browser: dovrai ricaricarlo alla prossima apertura.' };
  } catch (errore) {
    messaggioCashflow = { tipo: 'errore', testo: errore.message };
  }
  disegna();
}

// Avvio: se c'è già un file salvato nel browser lo ricarico
const salvati = carica();
if (salvati && salvati.titoli && salvati.meta) {
  impostaDati(salvati.titoli, salvati.meta);
}
disegna();
