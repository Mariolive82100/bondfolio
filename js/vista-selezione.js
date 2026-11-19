// Schermata 2: filtri e tabella delle obbligazioni

import { stato, impostaBozza } from './state.js';
import { FILTRI_INIZIALI, applicaFiltri, ordina } from './filtri.js';
import { ordinaleTitolo, etichettaRating } from './rating.js';
import { esc, fmtNum, fmtData } from './formati.js';

const radice = document.getElementById('view-selezione');
const PASSO = 100; // righe mostrate alla volta

let filtri = Object.assign({}, FILTRI_INIZIALI);
let ordine = { campo: 'rendNetto', verso: -1 };
let visibili = PASSO;

const COLONNE = [
  { campo: 'nome', titolo: 'Titolo', verso: 1 },
  { campo: 'emittente', titolo: 'Emittente', verso: 1 },
  { campo: 'scadenza', titolo: 'Scadenza', verso: 1 },
  { campo: 'cedola', titolo: 'Cedola', verso: -1, num: true },
  { campo: 'prezzo', titolo: 'Prezzo', verso: -1, num: true },
  { campo: 'rendNetto', titolo: 'Rend. netto', verso: -1, num: true },
  { campo: 'durationLorda', titolo: 'Duration', verso: -1, num: true },
  { campo: 'rating', titolo: 'Rating', verso: 1 }
];

/* ---------- Struttura della schermata (filtri + contenitore tabella) ---------- */

function disegna() {
  if (stato.titoli.length === 0) {
    radice.innerHTML = `
      <div class="card vuoto">
        <p>Non ci sono ancora obbligazioni.</p>
        <p>Carica prima il file nella schermata Dati.</p>
        <button class="btn btn-primario" data-azione="vai-dati">Vai a Dati</button>
      </div>`;
    return;
  }

  // Se la valuta preferita non esiste nel file, mostro tutte le valute
  if (filtri.valuta && !stato.meta.valute[filtri.valuta]) filtri.valuta = '';

  const valute = Object.keys(stato.meta.valute)
    .sort((a, b) => stato.meta.valute[b] - stato.meta.valute[a])
    .map(v => `<option value="${esc(v)}">${esc(v)}</option>`)
    .join('');

  radice.innerHTML = `
    <div class="selezione">

      <section class="card pannello-filtri">
        <div class="filtri-testa">
          <div class="card-titolo">Filtri</div>
          <button class="link-btn" data-azione="azzera">Azzera</button>
        </div>

        <label class="campo"><span>Cerca</span>
          <input id="f-cerca" type="search" placeholder="Nome, ISIN o emittente">
        </label>

        <label class="campo"><span>Tipo di emittente</span>
          <select id="f-tipo">
            <option value="">Tutti</option>
            <option value="gov">Governativi</option>
            <option value="sov">Sovranazionali</option>
            <option value="corp">Societari</option>
          </select>
        </label>

        <label class="campo"><span>Valuta</span>
          <select id="f-valuta"><option value="">Tutte</option>${valute}</select>
        </label>

        <div class="campo"><span>Scadenza (anno)</span>
          <div class="coppia">
            <input id="f-annoDa" inputmode="numeric" placeholder="Da" aria-label="Anno di scadenza da">
            <input id="f-annoA" inputmode="numeric" placeholder="A" aria-label="Anno di scadenza a">
          </div>
        </div>

        <label class="campo"><span>Rendimento netto minimo (%)</span>
          <input id="f-rendMin" inputmode="decimal" placeholder="es. 2,5">
        </label>

        <div class="campo"><span>Cedola (%)</span>
          <div class="coppia">
            <input id="f-cedolaMin" inputmode="decimal" placeholder="Min" aria-label="Cedola minima">
            <input id="f-cedolaMax" inputmode="decimal" placeholder="Max" aria-label="Cedola massima">
          </div>
        </div>

        <label class="campo"><span>Rating minimo</span>
          <select id="f-rating">
            <option value="">Qualsiasi</option>
            <option value="1">AAA</option>
            <option value="4">AA- o migliore</option>
            <option value="7">A- o migliore</option>
            <option value="10">BBB- o migliore</option>
            <option value="13">BB- o migliore</option>
          </select>
          <small class="nota">Se scegli un rating, i titoli senza rating vengono esclusi.</small>
        </label>

        <label class="campo"><span>Grado</span>
          <select id="f-grado">
            <option value="">Tutti</option>
            <option value="senior">Solo senior</option>
            <option value="sub">Solo subordinati</option>
          </select>
        </label>
      </section>

      <section class="card tabella-card">
        <div class="tabella-testa">
          <div id="conteggio"></div>
          <div id="bozza-info" class="bozza-info"></div>
        </div>
        <div class="tabella-scroll"><div class="tabella" id="tabella"></div></div>
        <div class="tabella-piede" id="piede"></div>
      </section>

    </div>`;

  // Riporto nei campi i valori dei filtri attuali
  Object.keys(filtri).forEach(chiave => {
    const campo = document.getElementById('f-' + chiave);
    if (campo) campo.value = filtri[chiave];
  });

  aggiornaTabella();
}

/* ---------- Tabella ---------- */

function riga(t, inBozza) {
  const ord = ordinaleTitolo(t);
  const rating = ord === null
    ? '<span class="pill pill-nd">—</span>'
    : `<span class="pill ${ord <= 7 ? 'pill-ok' : ord <= 10 ? 'pill-medio' : 'pill-basso'}">${esc(etichettaRating(t))}</span>`;

  return `
    <div class="riga">
      <div class="cella-titolo">
        <strong title="${esc(t.nome)}">${esc(t.nome)}</strong>
        <small>${esc(t.isin)} · ${esc(t.valuta)}</small>
      </div>
      <div class="ellissi" title="${esc(t.emittente)}">${esc(t.emittente)}</div>
      <div>${fmtData(t.scadenza)}</div>
      <div class="num">${fmtNum(t.cedola)}%</div>
      <div class="num">${fmtNum(t.prezzo)}</div>
      <div class="num forte">${fmtNum(t.rendNetto)}%</div>
      <div class="num">${fmtNum(t.durationLorda, 1)}</div>
      <div>${rating}</div>
      <button class="btn-piu ${inBozza ? 'is-aggiunto' : ''}" data-isin="${esc(t.isin)}"
        aria-label="${inBozza ? 'Togli dal portafoglio' : 'Aggiungi al portafoglio'}">${inBozza ? '✓' : '+'}</button>
    </div>`;
}

function intestazione() {
  const celle = COLONNE.map(c => {
    const attiva = ordine.campo === c.campo;
    const freccia = attiva ? (ordine.verso === 1 ? ' ▲' : ' ▼') : '';
    return `<div class="${c.num ? 'num' : ''}"><button data-campo="${c.campo}">${c.titolo}${freccia}</button></div>`;
  }).join('');
  return `<div class="riga-testa">${celle}<div></div></div>`;
}

function aggiornaTabella() {
  const contenitore = document.getElementById('tabella');
  if (!contenitore) return;

  const filtrati = ordina(applicaFiltri(stato.titoli, filtri), ordine);
  const mostrati = filtrati.slice(0, visibili);
  const inBozza = new Set(stato.bozza.map(b => b.isin));

  document.getElementById('conteggio').innerHTML =
    `<strong>${filtrati.length.toLocaleString('it-IT')}</strong> titoli su ${stato.titoli.length.toLocaleString('it-IT')}`;

  document.getElementById('bozza-info').innerHTML =
    `<span class="testo-soft">Nel portafoglio: <strong>${stato.bozza.length}</strong></span>
     <button class="btn btn-secondario btn-piccolo" data-azione="vai-portafoglio">Vai al portafoglio</button>`;

  contenitore.innerHTML = intestazione() +
    (mostrati.length === 0
      ? '<div class="vuoto">Nessun titolo corrisponde ai filtri.</div>'
      : mostrati.map(t => riga(t, inBozza.has(t.isin))).join(''));

  const restanti = filtrati.length - mostrati.length;
  document.getElementById('piede').innerHTML = restanti > 0
    ? `<button class="btn btn-secondario" data-azione="altri">Mostra altri ${Math.min(PASSO, restanti)} (ne restano ${restanti.toLocaleString('it-IT')})</button>`
    : '';
}

/* ---------- Azioni dell'utente ---------- */

radice.addEventListener('input', e => {
  const id = e.target.id;
  if (id && id.indexOf('f-') === 0) {
    filtri[id.slice(2)] = e.target.value;
    visibili = PASSO;
    aggiornaTabella();
  }
});

radice.addEventListener('click', e => {
  const el = e.target.closest('[data-isin], [data-campo], [data-azione]');
  if (!el) return;

  if (el.dataset.isin) {
    const isin = el.dataset.isin;
    if (stato.bozza.some(b => b.isin === isin)) {
      impostaBozza(stato.bozza.filter(b => b.isin !== isin));
    } else {
      const titolo = stato.titoli.find(t => t.isin === isin);
      const nominale = (titolo && titolo.lottoMinimo) || 1000;
      impostaBozza(stato.bozza.concat([{ isin: isin, nominale: nominale }]));
    }
    return;
  }

  if (el.dataset.campo) {
    const colonna = COLONNE.find(c => c.campo === el.dataset.campo);
    if (ordine.campo === colonna.campo) {
      ordine.verso = -ordine.verso;
    } else {
      ordine = { campo: colonna.campo, verso: colonna.verso };
    }
    visibili = PASSO;
    aggiornaTabella();
    return;
  }

  switch (el.dataset.azione) {
    case 'azzera':
      filtri = Object.assign({}, FILTRI_INIZIALI);
      visibili = PASSO;
      disegna();
      break;
    case 'altri':
      visibili += PASSO;
      aggiornaTabella();
      break;
    case 'vai-dati':
      document.dispatchEvent(new CustomEvent('vai-a', { detail: 'dati' }));
      break;
    case 'vai-portafoglio':
      document.dispatchEvent(new CustomEvent('vai-a', { detail: 'portafoglio' }));
      break;
  }
});

document.addEventListener('dati-aggiornati', disegna);
document.addEventListener('bozza-aggiornata', aggiornaTabella);

disegna();
