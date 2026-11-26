// Portafoglio costruito: conferma dell'acquisto, elenco degli acquisti (modificabili), commissioni
// e impatto di nuovi acquisti (la bozza) sul portafoglio già costruito.
// Per ogni acquisto si scrive il prezzo medio di carico del broker (già comprensivo di commissioni), la data
// e, se si vuole, le commissioni pagate. Il disegno della schermata è in vista-portafoglio.js, che usa le funzioni qui sotto.

import { stato, impostaBozza, impostaCostruito, correggiCostruito } from './state.js';
import { risolviPosizioni, calcolaTotali, calcolaIndicatori, lottoMinimo, VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';
import { sommaPerIsin, riepilogoAcquisti, impattoAggiunta } from './costruito-calcoli.js';
import { dataCalcolo, scadutoOggi } from './data-calcolo.js';
import { rendimentoAcquistoPortafoglio } from './rendimento.js';
import { htmlPannelloAnalisi, aggiornaPannelloAnalisi } from './analisi-pannello.js';
import { etichettaDaOrdinale } from './rating.js';
import { esc, fmtNum, leggiNumero, leggiNominale, oggiIso } from './formati.js';
import { testaComprimibile, classeChiusa } from './comprimibile.js';
import { htmlCapitalGain, aggiornaCapitalGain } from './capital-gain.js';

const radice = document.getElementById('view-portafoglio');

let confermando = false; // true mentre si vede la schermata "Conferma acquisto"

export function inConferma() { return confermando; }
export function annullaConferma() { confermando = false; }

const dataRiferimento = dataCalcolo;
const set = (id, testo) => { const el = document.getElementById(id); if (el) el.textContent = testo; };
const segno = n => (n > 0 ? '+' : n < 0 ? '−' : '');
const ridisegna = modo => document.dispatchEvent(new CustomEvent('ridisegna-portafoglio', { detail: { modo: modo } }));
const dataOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d);

/* ---------- Conferma acquisto ---------- */

export function htmlConferma() {
  const posizioni = risolviPosizioni(stato.bozza, stato.titoli).filter(p => p.valida);
  const esclusi = stato.bozza.length - posizioni.length;
  if (posizioni.length === 0) {
    return `<div class="card vuoto"><p>Nessun titolo della bozza può essere acquistato (non presenti nel file o non in euro).</p>
      <button class="btn btn-secondario" data-azione="conferma-annulla">Torna alla bozza</button></div>`;
  }

  const oggi = oggiIso();
  const righe = posizioni.map(p => `
    <div class="riga" data-isin="${esc(p.isin)}" data-nominale="${p.nominale}">
      <div class="cella-titolo"><strong title="${esc(p.titolo.nome)}">${esc(p.titolo.nome)}</strong><small>${esc(p.isin)}</small></div>
      <div class="num" data-eti="Nominale">${fmtNum(p.nominale, 0)}</div>
      <div class="num" data-eti="Prezzo medio di carico"><input class="input-conferma in-carico" type="text" inputmode="decimal" value="${fmtNum(p.titolo.prezzo, 3)}" aria-label="Prezzo medio di carico"></div>
      <div data-eti="Data acquisto"><input class="input-conferma in-data" type="date" value="${oggi}" aria-label="Data di acquisto"></div>
      <div class="num" data-eti="Commissioni (€, facolt.)"><input class="input-conferma in-comm" type="text" inputmode="decimal" value="0,00" aria-label="Commissioni in euro"></div>
      <div class="num" data-eti="Costo (€)" data-costo>—</div>
    </div>`).join('');

  return `
    <section class="card conferma">
      <div class="card-titolo">Conferma acquisto</div>
      <div class="testo-soft">Per ogni titolo scrivi il <strong>prezzo medio di carico</strong> che vedi sul broker (è già comprensivo di commissioni; qui è precompilato con il prezzo del file) e la data di acquisto. Le commissioni sono facoltative: servono solo per mostrare quanto hai pagato di commissioni e il rendimento dopo commissioni.</div>
      ${esclusi > 0 ? `<div class="messaggio messaggio-avviso">${esclusi === 1 ? '1 titolo della bozza non verrà inserito' : esclusi + ' titoli della bozza non verranno inseriti'} (non presenti nel file o non in euro).</div>` : ''}
      <div class="tabella-scroll"><div class="tabella tabella-conferma">
        <div class="riga-testa">
          <div>Titolo</div><div class="num">Nominale</div><div class="num">Prezzo medio di carico</div>
          <div>Data acquisto</div><div class="num">Commissioni (€, facoltative)</div><div class="num">Costo (€)</div>
        </div>
        ${righe}
      </div></div>
      <div class="conferma-totali">
        <div><span class="testo-soft">Capitale investito</span><strong id="c-totale">—</strong></div>
        <div><span class="testo-soft">di cui commissioni</span><strong id="c-comm">—</strong></div>
        <div><span class="testo-soft">Commissioni sul capitale</span><strong id="c-comm-pct">—</strong></div>
      </div>
      <div class="messaggio messaggio-errore" id="conferma-errore" hidden></div>
      <div class="gruppo-bottoni">
        <button class="btn btn-primario" data-azione="conferma-ok">Conferma acquisto</button>
        <button class="btn btn-secondario" data-azione="conferma-annulla">Annulla</button>
      </div>
      <div class="nota-tabella">Il costo è nominale × prezzo medio di carico / 100. Il rateo di cedola non è incluso: ti viene restituito con la prima cedola, quindi non è un costo del portafoglio.</div>
    </section>`;
}

// Aggiorna costo di ogni riga e totali mentre scrivi
export function aggiornaConferma() {
  let costo = 0, comm = 0, validi = true;
  radice.querySelectorAll('.tabella-conferma .riga[data-isin]').forEach(r => {
    const carico = leggiNumero(r.querySelector('.in-carico').value);
    const c = leggiNumero(r.querySelector('.in-comm').value);
    const cella = r.querySelector('[data-costo]');
    if (!(carico > 0) || c === null) { cella.textContent = '—'; validi = false; return; }
    const parziale = Number(r.dataset.nominale) * carico / 100;
    cella.textContent = fmtNum(parziale);
    costo += parziale;
    comm += c;
  });
  if (!validi) { ['c-totale', 'c-comm', 'c-comm-pct'].forEach(id => set(id, '—')); return; }
  set('c-totale', fmtNum(costo) + ' €');
  set('c-comm', fmtNum(comm) + ' €');
  set('c-comm-pct', costo > 0 ? fmtNum(comm / costo * 100) + '%' : '—');
}

function mostraErrore(testo) {
  const el = document.getElementById('conferma-errore');
  if (el) { el.textContent = testo; el.hidden = false; }
}

function confermaAcquisto() {
  const lotti = [];
  const righe = Array.from(radice.querySelectorAll('.tabella-conferma .riga[data-isin]'));
  for (const r of righe) {
    const carico = leggiNumero(r.querySelector('.in-carico').value);
    const comm = leggiNumero(r.querySelector('.in-comm').value);
    const data = r.querySelector('.in-data').value;
    if (!(carico > 0)) return mostraErrore('Controlla il prezzo medio di carico: deve essere un numero maggiore di zero.');
    if (comm === null) return mostraErrore('Controlla le commissioni: scrivi un numero (anche 0).');
    if (!dataOk(data)) return mostraErrore('Scegli la data di acquisto di ogni titolo.');
    lotti.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      isin: r.dataset.isin,
      nominale: Number(r.dataset.nominale),
      prezzoCarico: carico,
      data: data,
      commissioni: comm
    });
  }
  confermando = false;
  impostaCostruito(stato.costruito.concat(lotti));
  impostaBozza([]);
  ridisegna('costruito');
}

/* ---------- Schermata Costruito ---------- */

function rigaLotto(l, perIsin) {
  const t = perIsin.get(l.isin);
  const nome = t ? t.nome : l.isin;
  const sotto = esc(l.isin);
  const bottone = `<button class="btn-x" data-azione="rimuovi-acquisto" data-id="${esc(l.id)}" aria-label="Togli questo acquisto">✕</button>`;

  if (!t || t.valuta !== VALUTA_PORTAFOGLIO || scadutoOggi(t)) {
    const motivo = !t ? 'Non più nel file' : t.valuta !== VALUTA_PORTAFOGLIO ? 'Valuta non EUR' : 'Scaduto';
    return `<div class="riga riga-esclusa">
      <div class="cella-titolo"><strong title="${esc(nome)}">${esc(nome)}</strong><small>${sotto}</small></div>
      <div class="esclusa-motivo"><span class="pill pill-basso">${esc(motivo)}</span> <span class="testo-soft">Escluso dai calcoli</span></div>
      ${bottone}</div>`;
  }

  const variazione = l.prezzoCarico > 0 ? (t.prezzo - l.prezzoCarico) / l.prezzoCarico * 100 : null;
  const classe = variazione === null ? '' : variazione >= 0 ? 'pos' : 'neg';
  return `<div class="riga" data-id="${esc(l.id)}">
    <div class="cella-titolo"><strong title="${esc(nome)}">${esc(nome)}</strong><small>${sotto}</small></div>
    <div data-eti="Data acquisto"><input class="input-conferma mod-data" type="date" value="${esc(l.data || '')}" aria-label="Data di acquisto"></div>
    <div class="num" data-eti="Nominale"><input class="input-conferma mod-nominale" type="text" inputmode="numeric" value="${fmtNum(l.nominale, 0)}" aria-label="Nominale"></div>
    <div class="num" data-eti="Prezzo di carico"><input class="input-conferma mod-carico" type="text" inputmode="decimal" value="${fmtNum(l.prezzoCarico, 3)}" aria-label="Prezzo medio di carico"></div>
    <div class="num" data-eti="Prezzo oggi">${fmtNum(t.prezzo)}</div>
    <div class="num ${classe}" data-eti="Var. %" data-var>${variazione === null ? '—' : segno(variazione) + fmtNum(Math.abs(variazione)) + '%'}</div>
    <div class="num" data-eti="Valore oggi" data-valore-oggi>${fmtNum(l.nominale * t.prezzo / 100, 0)}</div>
    <div class="num" data-eti="Commissioni (€)"><input class="input-conferma mod-comm" type="text" inputmode="decimal" value="${fmtNum(l.commissioni || 0)}" aria-label="Commissioni in euro"></div>
    ${bottone}</div>`;
}

export function htmlRiepilogoAcquisti() {
  return `
    <div class="riepilogo riepilogo-acquisti">
      <div class="card"><div class="testo-soft">Capitale investito (prezzo medio di carico)</div><div class="valore" id="r-investito"></div><div class="testo-soft" id="r-investito-nota"></div></div>
      <div class="card"><div class="testo-soft">Valore oggi (prezzi del file)</div><div class="valore" id="r-valore"></div></div>
      <div class="card"><div class="testo-soft">Variazione latente dei prezzi</div><div class="valore" id="r-var"></div></div>
      <div class="card"><div class="testo-soft">Commissioni pagate</div><div class="valore" id="r-comm"></div><div class="testo-soft" id="r-comm-nota"></div></div>
      <div class="card"><div class="testo-soft">Rendimento netto all'acquisto (stima)</div><div class="valore" id="r-rend-comm"></div><div class="testo-soft" id="r-rend-comm-nota"></div></div>
    </div>`;
}

export function htmlCostruito() {
  const perIsin = new Map(stato.titoli.map(t => [t.isin, t]));
  return `
    <div id="avviso-costruito"></div>

    ${htmlRiepilogoAcquisti()}

    ${htmlCapitalGain(['scadenza', 'oggi'], 'tuo prezzo medio di carico (i rimborsi netti nei grafici seguono invece il file cashflow, che non conosce quel prezzo)')}

    <section class="card tabella-card${classeChiusa('tab-costruito')}">
      ${testaComprimibile('tab-costruito', 'Acquisti', 'riassunto-costruito')}
      <div class="tabella-scroll"><div class="tabella tabella-costruito">
        <div class="riga-testa">
          <div>Titolo</div><div>Data acquisto</div><div class="num">Nominale</div><div class="num">Prezzo medio di carico</div>
          <div class="num">Prezzo oggi</div><div class="num">Var. %</div><div class="num">Valore oggi</div><div class="num">Commissioni (€)</div><div></div>
        </div>
        ${stato.costruito.map(l => rigaLotto(l, perIsin)).join('')}
      </div></div>
      <div class="tabella-piede nota-tabella">Ogni riga è un acquisto: puoi comprare più volte lo stesso titolo. Puoi correggere data, nominale, prezzo medio di carico (quello del broker, commissioni comprese) e commissioni scrivendo nelle caselle: la modifica si salva quando esci dalla casella o premi Invio. Cambiando il nominale, prezzo di carico e commissioni restano quelli scritti: se serve, correggi anche quelli. Per togliere del tutto un acquisto usa la ✕. Le analisi qui sotto sommano gli acquisti dello stesso titolo e usano i prezzi del file caricato. La variazione riguarda solo i prezzi (rispetto al prezzo medio di carico) e non comprende rateo né tasse sulla plusvalenza.</div>
    </section>

    ${htmlPannelloAnalisi()}`;
}

export function aggiornaCostruito() {
  const posizioni = risolviPosizioni(sommaPerIsin(stato.costruito), stato.titoli);
  const tot = calcolaTotali(posizioni);
  aggiornaPannelloAnalisi(posizioni, tot, dataRiferimento(), [stato.costruito]);
  aggiornaCapitalGain(['scadenza', 'oggi'], [stato.costruito], stato.titoli);

  const r = aggiornaRiepilogoAcquisti(stato.costruito, tot);
  set('riassunto-costruito', stato.costruito.length + (stato.costruito.length === 1 ? ' acquisto' : ' acquisti') + ' · capitale investito ' + fmtNum(r.capitaleInvestito, 0) + ' €');

  set('avviso-costruito', '');
  const avviso = document.getElementById('avviso-costruito');
  if (avviso) {
    avviso.className = r.esclusi > 0 ? 'messaggio messaggio-avviso' : '';
    avviso.textContent = r.esclusi === 0 ? '' : (r.esclusi === 1
      ? '1 acquisto è escluso dai calcoli (titolo non più nel file, scaduto o non in euro). Puoi toglierlo con la ✕.'
      : r.esclusi + ' acquisti sono esclusi dai calcoli (titoli non più nel file, scaduti o non in euro). Puoi toglierli con la ✕.');
  }
}

// Riempie i riquadri degli acquisti (usati dal Costruito e dall'Aggregato). tot = totali delle posizioni ai prezzi di oggi
export function aggiornaRiepilogoAcquisti(lotti, tot) {
  const r = riepilogoAcquisti(lotti, stato.titoli);
  set('r-investito', fmtNum(r.capitaleInvestito, 0) + ' €');
  set('r-investito-nota', 'nominale × prezzo medio di carico, commissioni comprese');
  set('r-valore', fmtNum(r.valoreOggi, 0) + ' €');

  const elVar = document.getElementById('r-var');
  if (elVar) {
    elVar.textContent = segno(r.variazione) + fmtNum(Math.abs(r.variazione), 0) + ' €' +
      (r.variazionePct === null ? '' : ' (' + segno(r.variazionePct) + fmtNum(Math.abs(r.variazionePct)) + '%)');
    elVar.classList.toggle('pos', r.variazione >= 0);
    elVar.classList.toggle('neg', r.variazione < 0);
  }

  set('r-comm', fmtNum(r.commissioni) + ' €');
  set('r-comm-nota', r.commissioniPct === null ? '' : fmtNum(r.commissioniPct) + '% del capitale investito');

  const acq = rendimentoAcquistoPortafoglio(lotti, stato.titoli, VALUTA_PORTAFOGLIO, scadutoOggi);
  set('r-rend-comm', acq.rend === null ? '—' : fmtNum(acq.rend) + '%');
  set('r-rend-comm-nota', acq.rend === null ? '' :
    'fisso, dal prezzo di carico' + (tot.rendNetto === null ? '' : ' · ai prezzi di oggi: ' + fmtNum(tot.rendNetto) + '%') +
    (acq.conteggio < acq.totale ? ' · calcolato su ' + acq.conteggio + ' di ' + acq.totale + ' acquisti' : ''));
  return r;
}

/* ---------- Impatto di nuovi acquisti (bozza) sul costruito ---------- */

const RIGHE_IMPATTO = [
  { nome: 'Nominale totale', dec: 0, val: (t) => t.nominale, fmt: n => fmtNum(n, 0) + ' €' },
  { nome: 'Capitale impiegato (stima)', dec: 0, val: (t) => t.controvalore, fmt: n => fmtNum(n, 0) + ' €' },
  { nome: 'Cedole annue nette', dec: 2, val: (t) => t.cedoleNette, fmt: n => fmtNum(n) + ' €' },
  { nome: 'Rendimento netto', dec: 2, val: (t) => t.rendNetto, fmt: n => fmtNum(n) + '%', diff: n => fmtNum(n) + ' pt' },
  { nome: 'Duration', dec: 1, val: (t) => t.duration, fmt: n => fmtNum(n, 1) + ' anni' },
  { nome: 'Scadenza media', dec: 1, val: (t, i) => i.scadenzaAnni, fmt: n => fmtNum(n, 1) + ' anni' },
  { nome: 'Cedola media netta', dec: 2, val: (t, i) => i.cedolaNetta, fmt: n => fmtNum(n) + '%', diff: n => fmtNum(n) + ' pt' },
  { nome: 'Rating medio', val: (t, i) => i.ratingOrdinale, fmt: n => etichettaDaOrdinale(n), diff: () => '' }
];

// Il numero come si vede a schermo: così la differenza torna sempre con "Prima" e "Dopo"
function comeMostrato(n, decimali) {
  return Number(n.toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: decimali, maximumFractionDigits: decimali }));
}

export function aggiornaImpatto() {
  const box = document.getElementById('impatto-box');
  if (!box) return;
  if (stato.costruito.length === 0 || stato.bozza.length === 0) { box.innerHTML = ''; return; }

  const { prima, dopo } = impattoAggiunta(stato.costruito, stato.bozza, stato.titoli, dataRiferimento());
  const righe = RIGHE_IMPATTO.map(m => {
    const a = m.val(prima.tot, prima.ind), b = m.val(dopo.tot, dopo.ind);
    const fmtDiff = m.diff || m.fmt;
    let diff = '—';
    if (a !== null && b !== null) {
      if (m.diff && m.diff(0) === '') {
        diff = '';
      } else {
        const d = comeMostrato(comeMostrato(b, m.dec) - comeMostrato(a, m.dec), m.dec);
        diff = d === 0 ? '=' : segno(d) + fmtDiff(Math.abs(d));
      }
    }
    return `<div class="riga">
      <div>${esc(m.nome)}</div>
      <div class="num" data-eti="Prima">${a === null ? '—' : m.fmt(a)}</div>
      <div class="num forte" data-eti="Dopo">${b === null ? '—' : m.fmt(b)}</div>
      <div class="num" data-eti="Differenza">${diff}</div></div>`;
  }).join('');

  box.innerHTML = `<section class="card impatto">
    <div class="card-titolo">Impatto sul portafoglio costruito</div>
    <div class="testo-soft">Cosa cambia se confermi questi acquisti: il portafoglio costruito da solo (prima) contro costruito più bozza (dopo), ai prezzi del file.</div>
    <div class="tabella tabella-impatto">
      <div class="riga-testa"><div>Indicatore</div><div class="num">Prima</div><div class="num">Dopo</div><div class="num">Differenza</div></div>
      ${righe}
    </div></section>`;
}

/* ---------- Azioni dell'utente ---------- */

radice.addEventListener('click', e => {
  const el = e.target.closest('[data-azione]');
  if (!el) return;
  switch (el.dataset.azione) {
    case 'conferma-apri': confermando = true; ridisegna(); break;
    case 'conferma-annulla': confermando = false; ridisegna(); break;
    case 'conferma-ok': confermaAcquisto(); break;
    case 'rimuovi-acquisto':
      impostaCostruito(stato.costruito.filter(l => l.id !== el.dataset.id));
      break;
    case 'svuota-costruito':
      if (stato.costruito.length > 0 && confirm('Cancellare tutti i ' + stato.costruito.length + ' acquisti dal portafoglio costruito?')) {
        impostaCostruito([]);
      }
      break;
  }
});

// Mentre scrivi nella conferma, i totali si aggiornano
radice.addEventListener('input', e => {
  if (e.target.closest('.tabella-conferma')) aggiornaConferma();
});

/* ---------- Correzione degli acquisti già confermati ---------- */

radice.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.tabella-costruito .input-conferma')) e.target.blur();
});

// La modifica si applica quando esci dalla casella: così il cursore non salta mentre scrivi
radice.addEventListener('change', e => {
  const campo = e.target;
  if (!campo.classList.contains('input-conferma') || !campo.closest('.tabella-costruito')) return;
  const riga = campo.closest('.riga[data-id]');
  const lotto = riga && stato.costruito.find(l => l.id === riga.dataset.id);
  if (!lotto) return;

  const carico = leggiNumero(riga.querySelector('.mod-carico').value);
  const comm = leggiNumero(riga.querySelector('.mod-comm').value);
  const data = riga.querySelector('.mod-data').value;
  const nominale = leggiNominale(riga.querySelector('.mod-nominale').value);
  if (nominale === null || !(carico > 0) || comm === null || !dataOk(data)) {
    alert('Valore non valido: il nominale deve essere un numero intero maggiore di zero, il prezzo di carico maggiore di zero, le commissioni zero o più, la data completa. Rimetto il valore di prima.');
    ridisegna('costruito');
    return;
  }
  const t = stato.titoli.find(x => x.isin === lotto.isin);
  // Un nominale fuori dal taglio minimo è quasi sempre un errore di battitura: si chiede conferma
  if (nominale !== lotto.nominale && nominale % lottoMinimo(t) !== 0 &&
      !confirm(fmtNum(nominale, 0) + ' € non è un multiplo del taglio minimo del titolo (' + fmtNum(lottoMinimo(t), 0) + ' €). Salvarlo comunque?')) {
    ridisegna('costruito');
    return;
  }
  const nuovo = { ...lotto, nominale: nominale, prezzoCarico: carico, commissioni: comm, data: data };
  correggiCostruito(stato.costruito.map(l => (l.id === lotto.id ? nuovo : l)));

  riga.querySelector('.mod-nominale').value = fmtNum(nominale, 0);
  if (t) riga.querySelector('[data-valore-oggi]').textContent = fmtNum(nominale * t.prezzo / 100, 0);
  const v = t ? (t.prezzo - carico) / carico * 100 : null;
  const el = riga.querySelector('[data-var]');
  el.textContent = v === null ? '—' : segno(v) + fmtNum(Math.abs(v)) + '%';
  el.classList.toggle('pos', v !== null && v >= 0);
  el.classList.toggle('neg', v !== null && v < 0);
  aggiornaCostruito();
});
