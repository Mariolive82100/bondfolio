// Report in PDF di Bozza o Costruito del portafoglio selezionato.
// Si prepara una pagina apposta e si apre la stampa del browser: da lì si sceglie "Salva come PDF".
// Le tabelle dei titoli si scrivono qui; riquadri, grafici e calendario sono copiati da quelli a schermo,
// così i numeri del report sono gli stessi che si vedono.

import { stato } from './state.js';
import { nomePortafoglio } from './portafogli.js';
import { risolviPosizioni, calcolaTotali, peso, VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';
import { riepilogoAcquisti } from './costruito-calcoli.js';
import { cedolaNetta } from './filtri.js';
import { dataFile, scadutoOggi } from './data-calcolo.js';
import { cashflowAttuale } from './cashflow-dati.js';
import { esc, fmtNum, fmtData, oggiIso } from './formati.js';

const radice = document.getElementById('view-portafoglio');
const TITOLI = { bozza: 'Bozza (simulazione)', costruito: 'Portafoglio costruito' };
let titoloPagina = null; // titolo della scheda da rimettere dopo la stampa

const num = (v, testo) => `<td class="num">${v === null || v === undefined ? '—' : testo}</td>`;
const cellaTitolo = (nome, isin) => `<td><strong>${esc(nome)}</strong><small>${esc(isin)}</small></td>`;
const testa = colonne => '<thead><tr>' + colonne.map(c => `<th${c[1] ? ' class="num"' : ''}>${c[0]}</th>`).join('') + '</tr></thead>';

function tabellaBozza() {
  const posizioni = risolviPosizioni(stato.bozza, stato.titoli);
  const tot = calcolaTotali(posizioni);
  const righe = posizioni.map(p => {
    const t = p.titolo;
    if (!p.valida) return `<tr>${cellaTitolo(t ? t.nome : p.isin, p.isin)}<td colspan="10">Escluso dai calcoli: ${esc(p.motivo)}</td></tr>`;
    return `<tr>${cellaTitolo(t.nome, p.isin)}<td>${esc(t.emittente)}</td><td>${fmtData(t.scadenza)}</td>
      ${num(cedolaNetta(t), fmtNum(cedolaNetta(t)) + '%')}${num(t.prezzo, fmtNum(t.prezzo))}
      ${num(t.rendNetto, fmtNum(t.rendNetto) + '%')}${num(t.durationLorda, fmtNum(t.durationLorda, 1))}
      ${num(p.nominale, fmtNum(p.nominale, 0))}${num(peso(p, tot), fmtNum(peso(p, tot), 1) + '%')}
      ${num(p.controvalore, fmtNum(p.controvalore, 0))}${num(p.cedolaAnnuaNetta, fmtNum(p.cedolaAnnuaNetta))}</tr>`;
  }).join('');
  return `<table class="report-tabella">
    ${testa([['Titolo'], ['Emittente'], ['Scadenza'], ['Cedola netta', 1], ['Prezzo', 1], ['Rend. netto', 1], ['Duration', 1], ['Nominale', 1], ['Peso', 1], ['Capitale stimato (€)', 1], ['Cedola annua netta (€)', 1]])}
    <tbody>${righe}
      <tr class="report-totale"><td colspan="7">Totale dei titoli inclusi nei calcoli</td>
        <td class="num">${fmtNum(tot.nominale, 0)}</td><td></td><td class="num">${fmtNum(tot.controvalore, 0)}</td><td class="num">${fmtNum(tot.cedoleNette)}</td></tr>
    </tbody></table>`;
}

function tabellaCostruito() {
  const perIsin = new Map(stato.titoli.map(t => [t.isin, t]));
  let nominale = 0;
  const righe = stato.costruito.slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)).map(l => {
    const t = perIsin.get(l.isin);
    const motivo = !t ? 'Non più nel file' : t.valuta !== VALUTA_PORTAFOGLIO ? 'Valuta non EUR' : scadutoOggi(t) ? 'Scaduto' : '';
    if (motivo) return `<tr>${cellaTitolo(t ? t.nome : l.isin, l.isin)}<td>${fmtData(l.data)}</td><td class="num">${fmtNum(l.nominale, 0)}</td><td colspan="7">Escluso dai calcoli: ${motivo}</td></tr>`;
    nominale += l.nominale;
    const variazione = (t.prezzo - l.prezzoCarico) / l.prezzoCarico * 100;
    return `<tr>${cellaTitolo(t.nome, l.isin)}<td>${fmtData(l.data)}</td>
      <td class="num">${fmtNum(l.nominale, 0)}</td><td class="num">${fmtNum(l.prezzoCarico, 3)}</td><td class="num">${fmtNum(t.prezzo)}</td>
      <td class="num">${(variazione > 0 ? '+' : '') + fmtNum(variazione)}%</td>
      <td class="num">${fmtNum(l.nominale * l.prezzoCarico / 100, 0)}</td><td class="num">${fmtNum(l.nominale * t.prezzo / 100, 0)}</td>
      <td class="num">${fmtNum(l.commissioni || 0)}</td><td class="num">${fmtNum(l.nominale * (cedolaNetta(t) || 0) / 100)}</td></tr>`;
  }).join('');
  const r = riepilogoAcquisti(stato.costruito, stato.titoli);
  const cedole = calcolaTotali(risolviPosizioni(stato.costruito, stato.titoli)).cedoleNette;
  return `<table class="report-tabella">
    ${testa([['Titolo'], ['Data acquisto'], ['Nominale', 1], ['Prezzo di carico', 1], ['Prezzo oggi', 1], ['Var. %', 1], ['Capitale investito (€)', 1], ['Valore oggi (€)', 1], ['Commissioni (€)', 1], ['Cedola annua netta (€)', 1]])}
    <tbody>${righe}
      <tr class="report-totale"><td colspan="2">Totale degli acquisti inclusi nei calcoli</td>
        <td class="num">${fmtNum(nominale, 0)}</td><td colspan="3"></td>
        <td class="num">${fmtNum(r.capitaleInvestito, 0)}</td><td class="num">${fmtNum(r.valoreOggi, 0)}</td>
        <td class="num">${fmtNum(r.commissioni)}</td><td class="num">${fmtNum(cedole)}</td></tr>
    </tbody></table>`;
}

// Copia di un pezzo della schermata (senza identificativi, che nella pagina devono restare unici)
function copia(elemento) {
  if (!elemento) return '';
  const c = elemento.cloneNode(true);
  c.removeAttribute('id');
  c.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
  return c.outerHTML;
}

const scheda = id => { const el = document.getElementById(id); return el ? el.closest('.card') : null; };

function costruisci(tipo) {
  const riquadri = Array.from(radice.querySelectorAll('.riepilogo')).filter(r => !r.classList.contains('riepilogo-gain'));
  const grafici = ['g-flusso', 'g-cedole-anno', 'g-scadenze', 'g-cedole'].map(id => copia(scheda(id))).join('');
  const torte = ['g-emittenti', 'g-titoli', 'g-tipo', 'g-rating'].map(id => copia(scheda(id))).join('');
  const calendario = radice.querySelector('.tabella-calendario') ? copia(document.getElementById('g-calendario'))
    : `<p class="report-nota">${cashflowAttuale()
      ? 'Calendario non disponibile: nel file cashflow non ci sono incassi futuri per questi titoli.'
      : 'Calendario non disponibile: il file cashflow non è caricato (flussi e incassi nei grafici sono stime).'}</p>`;
  const impatto = tipo === 'bozza' ? radice.querySelector('#impatto-box .card') : null;
  const prezzi = dataFile() ? ' · prezzi del file del ' + fmtData(dataFile()) : '';

  return `
    <header class="report-testata">
      <div><h1>${TITOLI[tipo]} · ${esc(nomePortafoglio(stato.portafoglio))}</h1>
        <p>Report del ${fmtData(oggiIso())}${prezzi}</p></div>
      <div class="report-marchio">BondFolio</div>
    </header>
    <h2>Riepilogo</h2>
    ${riquadri.map(copia).join('')}
    ${copia(radice.querySelector('.riepilogo-blocco'))}
    <h2>${tipo === 'bozza' ? 'Titoli in bozza (ai prezzi del file)' : 'Acquisti'}</h2>
    ${tipo === 'bozza' ? tabellaBozza() : tabellaCostruito()}
    ${copia(impatto)}
    <h2 class="report-pagina-nuova">Grafici</h2>
    <div class="grafici">${grafici}</div>
    <div class="grafici">${torte}</div>
    <h2 class="report-pagina-nuova">Calendario incassi</h2>
    <div class="report-calendario">${calendario}</div>
    <p class="report-nota report-avvertenza">I valori indicati come stime non sono dati ufficiali. Report per uso personale: non è una consulenza finanziaria.</p>`;
}

// Toglie il report: si fa alla prima azione dopo la stampa (alcuni telefoni preparano il PDF con calma,
// quindi non si può cancellare appena la finestra di stampa si apre)
function pulisci() {
  const el = document.getElementById('report');
  if (el) el.remove();
  document.body.classList.remove('stampa-report');
  if (titoloPagina !== null) { document.title = titoloPagina; titoloPagina = null; }
  ['pointerdown', 'keydown'].forEach(ev => window.removeEventListener(ev, pulisci, true));
}

function creaReport(tipo) {
  if (stato.titoli.length === 0) {
    alert('Per creare il report carica prima il file delle obbligazioni nella schermata Dati.');
    return;
  }
  pulisci();
  const el = document.createElement('div');
  el.id = 'report';
  el.innerHTML = costruisci(tipo);
  document.body.appendChild(el);
  document.body.classList.add('stampa-report');
  // il titolo della pagina diventa il nome proposto per il file PDF
  titoloPagina = document.title;
  document.title = ['BondFolio', tipo === 'bozza' ? 'Bozza' : 'Costruito', nomePortafoglio(stato.portafoglio), oggiIso()]
    .join(' - ').replace(/[\\/:*?"<>|]/g, '-');
  window.addEventListener('afterprint', () => setTimeout(() => {
    ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, pulisci, true));
  }, 0), { once: true });
  window.print();
}

radice.addEventListener('click', e => {
  const bottone = e.target.closest('[data-report]');
  if (bottone) creaReport(bottone.dataset.report);
});

// Cambiando schermata o portafoglio il report preparato non serve più
['mostra-portafoglio', 'portafoglio-cambiato'].forEach(ev => document.addEventListener(ev, pulisci));
