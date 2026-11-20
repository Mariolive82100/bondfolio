// Portafoglio costruito: conferma dell'acquisto, elenco degli acquisti, confronto acquisto/oggi,
// commissioni e impatto di nuovi acquisti (la bozza) sul portafoglio già costruito.
// Il disegno della schermata è in vista-portafoglio.js, che usa le funzioni qui sotto.

import { stato, impostaBozza, impostaCostruito, correggiCostruito } from './state.js';
import { risolviPosizioni, calcolaTotali, calcolaIndicatori, VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';
import { sommaPerIsin, riepilogoAcquisti, rendDopoCommissioni, impattoAggiunta } from './costruito-calcoli.js';
import { htmlPannelloAnalisi, aggiornaPannelloAnalisi } from './analisi-pannello.js';
import { etichettaDaOrdinale } from './rating.js';
import { esc, fmtNum, leggiNumero, oggiIso } from './formati.js';
import { testaComprimibile, classeChiusa } from './comprimibile.js';
import { dataRegolamento, calcolaRateo } from './rateo.js';

const radice = document.getElementById('view-portafoglio');

let confermando = false; // true mentre si vede la schermata "Conferma acquisto"

export function inConferma() { return confermando; }
export function annullaConferma() { confermando = false; }

const dataRiferimento = () => stato.meta && stato.meta.dataRiferimento;
const set = (id, testo) => { const el = document.getElementById(id); if (el) el.textContent = testo; };
const segno = n => (n > 0 ? '+' : n < 0 ? '−' : '');
const ridisegna = modo => document.dispatchEvent(new CustomEvent('ridisegna-portafoglio', { detail: { modo: modo } }));

/* ---------- Conferma acquisto ---------- */

export function htmlConferma() {
  const posizioni = risolviPosizioni(stato.bozza, stato.titoli).filter(p => p.valida);
  const esclusi = stato.bozza.length - posizioni.length;
  if (posizioni.length === 0) {
    return `<div class="card vuoto"><p>Nessun titolo della bozza può essere acquistato (non presenti nel file o non in euro).</p>
      <button class="btn btn-secondario" data-azione="conferma-annulla">Torna alla bozza</button></div>`;
  }

  const oggi = oggiIso();
  const reg = dataRegolamento(oggi);
  const righe = posizioni.map(p => {
    const r = calcolaRateo(p.titolo, reg);
    const rateoEuro = r ? p.nominale * r.per100 / 100 : 0;
    const avviso = !r || r.stima
      ? ` · <span class="pill pill-medio" title="${esc(r ? r.nota : 'Rateo non calcolabile')}">rateo da verificare</span>` : '';
    return `
    <div class="riga" data-isin="${esc(p.isin)}" data-nominale="${p.nominale}">
      <div class="cella-titolo"><strong title="${esc(p.titolo.nome)}">${esc(p.titolo.nome)}</strong><small>${esc(p.isin)}${avviso}</small></div>
      <div class="num">${fmtNum(p.nominale, 0)}</div>
      <div class="num"><input class="input-conferma in-carico" type="text" inputmode="decimal" value="${fmtNum(p.titolo.prezzo, 2)}" aria-label="Prezzo di carico"></div>
      <div><input class="input-conferma in-data" type="date" value="${oggi}" aria-label="Data di acquisto"></div>
      <div><input class="input-conferma in-reg" type="date" value="${reg || ''}" aria-label="Data di regolamento"></div>
      <div class="num"><input class="input-conferma in-rateo" type="text" inputmode="decimal" value="${fmtNum(rateoEuro)}" aria-label="Rateo lordo in euro"></div>
      <div class="num"><input class="input-conferma in-comm" type="text" inputmode="decimal" value="0,00" aria-label="Commissioni in euro"></div>
      <div class="num" data-costo>—</div>
    </div>`;
  }).join('');

  return `
    <section class="card conferma">
      <div class="card-titolo">Conferma acquisto</div>
      <div class="testo-soft">Controlla per ogni titolo il prezzo a cui hai comprato (precompilato con il prezzo del file), le date, il rateo e le commissioni pagate. Il rateo è una stima: se hai la lettera di conferma della banca, scrivi il rateo che trovi lì.</div>
      ${esclusi > 0 ? `<div class="messaggio messaggio-avviso">${esclusi === 1 ? '1 titolo della bozza non verrà inserito' : esclusi + ' titoli della bozza non verranno inseriti'} (non presenti nel file o non in euro).</div>` : ''}
      <div class="tabella-scroll"><div class="tabella tabella-conferma">
        <div class="riga-testa">
          <div>Titolo</div><div class="num">Nominale</div><div class="num">Prezzo di carico</div>
          <div>Data acquisto</div><div>Data regolamento</div><div class="num">Rateo lordo (€)</div><div class="num">Commissioni (€)</div><div class="num">Totale regolato (€)</div>
        </div>
        ${righe}
      </div></div>
      <div class="conferma-totali">
        <div><span class="testo-soft">Costo dei titoli</span><strong id="c-costo">—</strong></div>
        <div><span class="testo-soft">Rateo lordo</span><strong id="c-rateo">—</strong></div>
        <div><span class="testo-soft">Commissioni</span><strong id="c-comm">—</strong></div>
        <div><span class="testo-soft">Totale regolato</span><strong id="c-totale">—</strong></div>
        <div><span class="testo-soft">Commissioni sul costo dei titoli</span><strong id="c-comm-pct">—</strong></div>
      </div>
      <div class="messaggio messaggio-errore" id="conferma-errore" hidden></div>
      <div class="gruppo-bottoni">
        <button class="btn btn-primario" data-azione="conferma-ok">Conferma acquisto</button>
        <button class="btn btn-secondario" data-azione="conferma-annulla">Annulla</button>
        <button class="btn btn-secondario" data-azione="conferma-ricalcola">Ricalcola date e ratei</button>
      </div>
      <div class="nota-tabella">Il totale regolato è nominale × prezzo di carico / 100 + rateo lordo + commissioni. La data di regolamento proposta è 2 giorni lavorativi dopo l'acquisto (senza festività). Il rateo si calcola sui giorni effettivi del periodo cedolare; è lordo, perché la ritenuta si applica poi solo al periodo in cui hai detenuto il titolo. Se cambi la data di regolamento il rateo si ricalcola, a meno che tu non lo abbia scritto a mano.</div>
    </section>`;
}

// Aggiorna costo di ogni riga e totali mentre scrivi
export function aggiornaConferma() {
  let costo = 0, rateo = 0, comm = 0, validi = true;
  radice.querySelectorAll('.tabella-conferma .riga[data-isin]').forEach(r => {
    const carico = leggiNumero(r.querySelector('.in-carico').value);
    const ra = leggiNumero(r.querySelector('.in-rateo').value);
    const c = leggiNumero(r.querySelector('.in-comm').value);
    const nominale = Number(r.dataset.nominale);
    const cella = r.querySelector('[data-costo]');
    if (!(carico > 0) || ra === null || c === null) { cella.textContent = '—'; validi = false; return; }
    cella.textContent = fmtNum(nominale * carico / 100 + ra + c);
    costo += nominale * carico / 100;
    rateo += ra;
    comm += c;
  });
  if (!validi) { ['c-costo', 'c-rateo', 'c-comm', 'c-totale', 'c-comm-pct'].forEach(id => set(id, '—')); return; }
  set('c-costo', fmtNum(costo) + ' €');
  set('c-rateo', fmtNum(rateo) + ' €');
  set('c-comm', fmtNum(comm) + ' €');
  set('c-totale', fmtNum(costo + rateo + comm) + ' €');
  set('c-comm-pct', costo > 0 ? fmtNum(comm / costo * 100) + '%' : '—');
}

// Ricalcola il rateo di una riga dalla data di regolamento scritta (forza = anche se era stato scritto a mano)
function ricalcolaRateoRiga(riga, forza) {
  const campo = riga.querySelector('.in-rateo');
  if (campo.dataset.manuale && !forza) return;
  const titolo = stato.titoli.find(t => t.isin === riga.dataset.isin);
  const r = titolo && calcolaRateo(titolo, riga.querySelector('.in-reg').value);
  if (!r) return;
  campo.value = fmtNum(Number(riga.dataset.nominale) * r.per100 / 100);
  delete campo.dataset.manuale;
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
    const rateo = leggiNumero(r.querySelector('.in-rateo').value);
    const comm = leggiNumero(r.querySelector('.in-comm').value);
    const data = r.querySelector('.in-data').value;
    const reg = r.querySelector('.in-reg').value;
    if (!(carico > 0)) return mostraErrore('Controlla il prezzo di carico: deve essere un numero maggiore di zero.');
    if (rateo === null) return mostraErrore('Controlla il rateo: scrivi un numero (anche 0).');
    if (comm === null) return mostraErrore('Controlla le commissioni: scrivi un numero (anche 0).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return mostraErrore('Scegli la data di acquisto di ogni titolo.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reg)) return mostraErrore('Scegli la data di regolamento di ogni titolo.');
    lotti.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      isin: r.dataset.isin,
      nominale: Number(r.dataset.nominale),
      prezzoCarico: carico,
      data: data,
      dataRegolamento: reg,
      rateo: rateo,
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

  if (!t || t.valuta !== VALUTA_PORTAFOGLIO) {
    const motivo = !t ? 'Non più nel file (scaduto?)' : 'Valuta non EUR';
    return `<div class="riga riga-esclusa">
      <div class="cella-titolo"><strong title="${esc(nome)}">${esc(nome)}</strong><small>${sotto}</small></div>
      <div class="esclusa-motivo"><span class="pill pill-basso">${esc(motivo)}</span> <span class="testo-soft">Escluso dai calcoli</span></div>
      ${bottone}</div>`;
  }

  const variazione = l.prezzoCarico > 0 ? (t.prezzo - l.prezzoCarico) / l.prezzoCarico * 100 : null;
  const classe = variazione === null ? '' : variazione >= 0 ? 'pos' : 'neg';
  const rateoEuro = l.rateo || 0;
  return `<div class="riga" data-id="${esc(l.id)}">
    <div class="cella-titolo"><strong title="${esc(nome)}">${esc(nome)}</strong><small>${sotto}</small></div>
    <div><input class="input-conferma mod-data" type="date" value="${esc(l.data || '')}" aria-label="Data di acquisto"></div>
    <div class="num">${fmtNum(l.nominale, 0)}</div>
    <div class="num"><input class="input-conferma mod-carico" type="text" inputmode="decimal" value="${fmtNum(l.prezzoCarico)}" aria-label="Prezzo di carico"></div>
    <div class="num">${fmtNum(t.prezzo)}</div>
    <div class="num ${classe}" data-var>${variazione === null ? '—' : segno(variazione) + fmtNum(Math.abs(variazione)) + '%'}</div>
    <div class="num" data-valore>${fmtNum(l.nominale * t.prezzo / 100, 0)}</div>
    <div><input class="input-conferma mod-reg" type="date" value="${esc(l.dataRegolamento || '')}" aria-label="Data di regolamento"></div>
    <div class="num"><input class="input-conferma mod-rateo" type="text" inputmode="decimal" value="${fmtNum(rateoEuro)}" aria-label="Rateo lordo in euro"></div>
    <div class="num"><input class="input-conferma mod-comm" type="text" inputmode="decimal" value="${fmtNum(l.commissioni || 0)}" aria-label="Commissioni in euro"></div>
    <div class="azioni-riga">
      <button class="btn-x" data-azione="ricalcola-rateo-acquisto" data-id="${esc(l.id)}" title="Ricalcola il rateo dalla data di regolamento" aria-label="Ricalcola il rateo">↻</button>
      ${bottone}
    </div></div>`;
}

export function htmlCostruito() {
  const perIsin = new Map(stato.titoli.map(t => [t.isin, t]));
  return `
    <div id="avviso-costruito"></div>

    <div class="riepilogo riepilogo-acquisti">
      <div class="card"><div class="testo-soft">Capitale investito (valore regolato)</div><div class="valore" id="r-investito"></div><div class="testo-soft" id="r-investito-nota"></div></div>
      <div class="card"><div class="testo-soft">Valore oggi (prezzi del file)</div><div class="valore" id="r-valore"></div></div>
      <div class="card"><div class="testo-soft">Variazione latente dei prezzi</div><div class="valore" id="r-var"></div></div>
      <div class="card"><div class="testo-soft">Commissioni pagate</div><div class="valore" id="r-comm"></div><div class="testo-soft" id="r-comm-nota"></div></div>
      <div class="card"><div class="testo-soft">Rendimento netto dopo commissioni (stima)</div><div class="valore" id="r-rend-comm"></div><div class="testo-soft" id="r-rend-comm-nota"></div></div>
    </div>

    <section class="card tabella-card${classeChiusa('tab-costruito')}">
      ${testaComprimibile('tab-costruito', 'Acquisti', 'riassunto-costruito')}
      <div class="tabella-scroll"><div class="tabella tabella-costruito">
        <div class="riga-testa">
          <div>Titolo</div><div>Data acquisto</div><div class="num">Nominale</div><div class="num">Prezzo carico</div>
          <div class="num">Prezzo oggi</div><div class="num">Var. %</div><div class="num">Valore oggi</div><div>Data regolamento</div><div class="num">Rateo lordo (€)</div><div class="num">Commissioni (€)</div><div></div>
        </div>
        ${stato.costruito.map(l => rigaLotto(l, perIsin)).join('')}
      </div></div>
      <div class="tabella-piede nota-tabella">Ogni riga è un acquisto: puoi comprare più volte lo stesso titolo. Puoi correggere data di acquisto, prezzo di carico, data di regolamento, rateo e commissioni scrivendo direttamente nelle caselle (la modifica si salva quando esci dalla casella); il pulsante ↻ ricalcola il rateo dalla data di regolamento. Per cambiare il nominale togli l'acquisto con la ✕ e rifallo dalla bozza. Le analisi qui sotto sommano gli acquisti dello stesso titolo e usano i prezzi del file caricato. Il capitale investito è il valore regolato (titoli + rateo lordo + commissioni). La variazione riguarda solo i prezzi e non comprende le tasse sulla plusvalenza.</div>
    </section>

    ${htmlPannelloAnalisi()}`;
}

export function aggiornaCostruito() {
  const posizioni = risolviPosizioni(sommaPerIsin(stato.costruito), stato.titoli);
  const tot = calcolaTotali(posizioni);
  aggiornaPannelloAnalisi(posizioni, tot, dataRiferimento());

  const r = riepilogoAcquisti(stato.costruito, stato.titoli);
  const ind = calcolaIndicatori(posizioni, dataRiferimento());

  set('riassunto-costruito', stato.costruito.length + (stato.costruito.length === 1 ? ' acquisto' : ' acquisti') + ' · capitale investito ' + fmtNum(r.capitaleInvestito, 0) + ' €');
  set('r-investito', fmtNum(r.capitaleInvestito, 0) + ' €');
  set('r-investito-nota', 'titoli ' + fmtNum(r.costoTitoli, 0) + ' € + rateo ' + fmtNum(r.rateo, 0) + ' € + commissioni ' + fmtNum(r.commissioni, 0) + ' €');
  set('r-valore', fmtNum(r.valoreOggi, 0) + ' €');

  const elVar = document.getElementById('r-var');
  if (elVar) {
    elVar.textContent = segno(r.variazione) + fmtNum(Math.abs(r.variazione), 0) + ' €' +
      (r.variazionePct === null ? '' : ' (' + segno(r.variazionePct) + fmtNum(Math.abs(r.variazionePct)) + '%)');
    elVar.classList.toggle('pos', r.variazione >= 0);
    elVar.classList.toggle('neg', r.variazione < 0);
  }

  set('r-comm', fmtNum(r.commissioni) + ' €');
  set('r-comm-nota', r.commissioniPct === null ? '' : fmtNum(r.commissioniPct) + '% del costo dei titoli');

  const dopo = rendDopoCommissioni(tot.rendNetto, r.commissioniPct, ind.scadenzaAnni);
  set('r-rend-comm', dopo === null ? '—' : fmtNum(dopo) + '%');
  set('r-rend-comm-nota', dopo === null ? '' :
    'contro ' + fmtNum(tot.rendNetto) + '% senza commissioni (−' + fmtNum(tot.rendNetto - dopo) + ' punti l\'anno)');

  set('avviso-costruito', '');
  const avviso = document.getElementById('avviso-costruito');
  if (avviso) {
    avviso.className = r.esclusi > 0 ? 'messaggio messaggio-avviso' : '';
    avviso.textContent = r.esclusi === 0 ? '' : (r.esclusi === 1
      ? '1 acquisto è escluso dai calcoli (titolo non più nel file, ad esempio scaduto, oppure non in euro). Puoi toglierlo con la ✕.'
      : r.esclusi + ' acquisti sono esclusi dai calcoli (titoli non più nel file, ad esempio scaduti, oppure non in euro). Puoi toglierli con la ✕.');
  }
}

/* ---------- Impatto di nuovi acquisti (bozza) sul costruito ---------- */

const RIGHE_IMPATTO = [
  { nome: 'Nominale totale', val: (t) => t.nominale, fmt: n => fmtNum(n, 0) + ' €' },
  { nome: 'Capitale impiegato (stima)', val: (t) => t.controvalore, fmt: n => fmtNum(n, 0) + ' €' },
  { nome: 'Cedole annue nette', val: (t) => t.cedoleNette, fmt: n => fmtNum(n) + ' €' },
  { nome: 'Rendimento netto', val: (t) => t.rendNetto, fmt: n => fmtNum(n) + '%', diff: n => fmtNum(n) + ' pt' },
  { nome: 'Duration', val: (t) => t.duration, fmt: n => fmtNum(n, 1) + ' anni' },
  { nome: 'Scadenza media', val: (t, i) => i.scadenzaAnni, fmt: n => fmtNum(n, 1) + ' anni' },
  { nome: 'Cedola media netta', val: (t, i) => i.cedolaNetta, fmt: n => fmtNum(n) + '%', diff: n => fmtNum(n) + ' pt' },
  { nome: 'Rating medio', val: (t, i) => i.ratingOrdinale, fmt: n => etichettaDaOrdinale(n), diff: () => '' }
];

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
      const d = b - a;
      diff = m.diff && m.diff(0) === '' ? '' : (Math.abs(d) < 0.005 ? '=' : segno(d) + fmtDiff(Math.abs(d)));
    }
    return `<div class="riga">
      <div>${esc(m.nome)}</div>
      <div class="num">${a === null ? '—' : m.fmt(a)}</div>
      <div class="num forte">${b === null ? '—' : m.fmt(b)}</div>
      <div class="num">${diff}</div></div>`;
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
    case 'conferma-ricalcola':
      radice.querySelectorAll('.tabella-conferma .riga[data-isin]').forEach(riga => {
        const reg = riga.querySelector('.in-reg');
        delete reg.dataset.manuale;
        reg.value = dataRegolamento(riga.querySelector('.in-data').value) || reg.value;
        ricalcolaRateoRiga(riga, true);
      });
      aggiornaConferma();
      break;
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

radice.addEventListener('input', e => {
  const campo = e.target;
  if (!campo.closest('.tabella-conferma')) return;
  const riga = campo.closest('.riga[data-isin]');
  if (riga) {
    const reg = riga.querySelector('.in-reg');
    if (campo.classList.contains('in-data') && !reg.dataset.manuale) {
      reg.value = dataRegolamento(campo.value) || reg.value;
      ricalcolaRateoRiga(riga, false);
    } else if (campo.classList.contains('in-reg')) {
      reg.dataset.manuale = '1';
      ricalcolaRateoRiga(riga, false);
    } else if (campo.classList.contains('in-rateo')) {
      campo.dataset.manuale = '1';
    }
  }
  aggiornaConferma();
});

/* ---------- Correzione degli acquisti già confermati ---------- */

function aggiornaRigaAcquisto(riga, lotto) {
  const t = stato.titoli.find(x => x.isin === lotto.isin);
  if (!t) return;
  const v = lotto.prezzoCarico > 0 ? (t.prezzo - lotto.prezzoCarico) / lotto.prezzoCarico * 100 : null;
  const el = riga.querySelector('[data-var]');
  el.textContent = v === null ? '—' : segno(v) + fmtNum(Math.abs(v)) + '%';
  el.classList.toggle('pos', v !== null && v >= 0);
  el.classList.toggle('neg', v !== null && v < 0);
}

function applicaModifica(riga, lotto) {
  const carico = leggiNumero(riga.querySelector('.mod-carico').value);
  const rateo = leggiNumero(riga.querySelector('.mod-rateo').value);
  const comm = leggiNumero(riga.querySelector('.mod-comm').value);
  const data = riga.querySelector('.mod-data').value;
  const reg = riga.querySelector('.mod-reg').value;
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(data), regOk = /^\d{4}-\d{2}-\d{2}$/.test(reg);
  if (!(carico > 0) || rateo === null || comm === null || !dataOk || !regOk) {
    alert('Valore non valido: i numeri devono essere maggiori o uguali a zero (il prezzo di carico maggiore di zero) e le date complete. Rimetto il valore di prima.');
    ridisegna('costruito');
    return null;
  }
  const nuovo = { ...lotto, prezzoCarico: carico, rateo: rateo, commissioni: comm, data: data, dataRegolamento: reg };
  correggiCostruito(stato.costruito.map(l => (l.id === lotto.id ? nuovo : l)));
  aggiornaRigaAcquisto(riga, nuovo);
  aggiornaCostruito();
  return nuovo;
}

radice.addEventListener('change', e => {
  const campo = e.target;
  if (!campo.classList.contains('input-conferma') || !campo.closest('.tabella-costruito')) return;
  const riga = campo.closest('.riga[data-id]');
  const lotto = riga && stato.costruito.find(l => l.id === riga.dataset.id);
  if (lotto) applicaModifica(riga, lotto);
});

radice.addEventListener('click', e => {
  const el = e.target.closest('[data-azione="ricalcola-rateo-acquisto"]');
  if (!el) return;
  const riga = el.closest('.riga[data-id]');
  const lotto = stato.costruito.find(l => l.id === el.dataset.id);
  const titolo = lotto && stato.titoli.find(t => t.isin === lotto.isin);
  const r = titolo && calcolaRateo(titolo, riga.querySelector('.mod-reg').value);
  if (!r) { alert('Rateo non calcolabile: controlla la data di regolamento.'); return; }
  riga.querySelector('.mod-rateo').value = fmtNum(lotto.nominale * r.per100 / 100);
  applicaModifica(riga, lotto);
});
