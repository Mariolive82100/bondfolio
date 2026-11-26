// Schermata Aggregato (sola lettura): somma i portafogli Costruiti dei portafogli spuntati.
// Le Bozze non entrano. La scelta delle caselle resta salvata in questo dispositivo.
// Il disegno viene inserito da vista-portafoglio.js nella stessa area di Bozza e Costruito.

import { stato, listaDi } from './state.js';
import { leggiElenco } from './portafogli.js';
import { risolviPosizioni, calcolaTotali, peso } from './portafoglio-calcoli.js';
import { sommaPerIsin, riepilogoAcquisti } from './costruito-calcoli.js';
import { dataCalcolo } from './data-calcolo.js';
import { htmlRiepilogoAcquisti, aggiornaRiepilogoAcquisti } from './vista-costruito.js';
import { htmlPannelloAnalisi, aggiornaPannelloAnalisi } from './analisi-pannello.js';
import { htmlCapitalGain, aggiornaCapitalGain } from './capital-gain.js';
import { testaComprimibile, classeChiusa } from './comprimibile.js';
import { esc, fmtNum, fmtData } from './formati.js';

// Si salvano i portafogli tolti: così quelli nuovi entrano da soli nella somma
const CHIAVE = 'bondfolio_aggregato_v1';

function leggiEsclusi() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHIAVE) || '[]');
    return new Set(Array.isArray(lista) ? lista : []);
  } catch (e) {
    return new Set();
  }
}

function salvaEsclusi(esclusi) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(Array.from(esclusi))); } catch (e) { /* niente da fare */ }
}

// Portafogli spuntati: [{ id, nome, lotti }]
function scelti() {
  const esclusi = leggiEsclusi();
  return leggiElenco().elenco.filter(p => !esclusi.has(p.id))
    .map(p => ({ id: p.id, nome: p.nome, lotti: listaDi(p.id, 'costruito') }));
}

const quanti = (n, uno, molti) => n + ' ' + (n === 1 ? uno : molti);

function htmlScelta() {
  const esclusi = leggiEsclusi();
  const voci = leggiElenco().elenco.map(p => {
    const lotti = listaDi(p.id, 'costruito');
    const r = riepilogoAcquisti(lotti, stato.titoli);
    const sotto = lotti.length === 0 ? 'nessun acquisto'
      : quanti(lotti.length, 'acquisto', 'acquisti') + (stato.titoli.length === 0 ? '' : ' · capitale investito ' + fmtNum(r.capitaleInvestito, 0) + ' €');
    return `<label class="agg-voce"><input type="checkbox" data-agg="${esc(p.id)}"${esclusi.has(p.id) ? '' : ' checked'}>
      <span><strong>${esc(p.nome)}</strong><small>${sotto}</small></span></label>`;
  }).join('');
  return `<section class="card agg-scelta">
      <div class="card-titolo">Portafogli da sommare</div>
      <div class="testo-soft">Si sommano solo i Costruiti: le Bozze non entrano. Questa pagina è di sola lettura e la scelta resta salvata in questo dispositivo.</div>
      <div class="agg-voci">${voci}</div>
    </section>`;
}

const vuoto = testo => `<div class="card vuoto"><p>${testo}</p></div>`;

export function htmlAggregato() {
  const lista = scelti();
  const lotti = lista.flatMap(p => p.lotti);
  if (stato.titoli.length === 0) return htmlScelta() + vuoto('Carica prima il file delle obbligazioni nella schermata Dati.');
  if (lista.length === 0) return htmlScelta() + vuoto('Spunta almeno un portafoglio.');
  if (lotti.length === 0) return htmlScelta() + vuoto('I portafogli spuntati non hanno ancora acquisti nel Costruito.');
  return `${htmlScelta()}
    <div id="avviso-aggregato"></div>

    ${htmlRiepilogoAcquisti()}

    ${htmlCapitalGain(['scadenza', 'oggi'], 'prezzo medio di carico di ciascun portafoglio: il conto si fa portafoglio per portafoglio e poi si somma (i rimborsi netti nei grafici seguono invece il file cashflow, che non conosce quel prezzo)')}

    <section class="card tabella-card${classeChiusa('tab-aggregato')}">
      ${testaComprimibile('tab-aggregato', 'Titoli sommati', 'riassunto-aggregato')}
      <div class="tabella-scroll"><div class="tabella tabella-aggregato" id="righe-aggregato"></div></div>
      <div class="tabella-piede nota-tabella">Una riga per titolo: i nominali dello stesso titolo in più portafogli sono sommati. Il prezzo medio di carico è la media pesata di tutti gli acquisti. Per modificare gli acquisti vai in Costruito e scegli il portafoglio.</div>
    </section>

    ${htmlPannelloAnalisi()}`;
}

function righeTitoli(posizioni, tot, lista) {
  const testa = `<div class="riga-testa">
      <div>Titolo</div><div>Scadenza</div><div class="num">Nominale</div><div class="num">Peso</div><div class="num">Prezzo medio di carico</div>
      <div class="num">Capitale investito (€)</div><div class="num">Valore oggi (€)</div><div class="num">Cedola annua netta (€)</div><div>Portafogli</div>
    </div>`;
  const righe = posizioni.filter(p => p.valida).sort((a, b) => b.nominale - a.nominale).map(p => {
    let capitale = 0;
    const dove = [];
    lista.forEach(f => {
      const suoi = f.lotti.filter(l => l.isin === p.isin);
      if (suoi.length === 0) return;
      let nominale = 0;
      suoi.forEach(l => { nominale += l.nominale; capitale += l.nominale * l.prezzoCarico / 100; });
      dove.push({ nome: f.nome, nominale: nominale });
    });
    const testoDove = dove.length === 1 ? esc(dove[0].nome)
      : dove.map(d => esc(d.nome) + ' (' + fmtNum(d.nominale, 0) + ')').join(', ');
    return `<div class="riga">
      <div class="cella-titolo"><strong title="${esc(p.titolo.nome)}">${esc(p.titolo.nome)}</strong><small>${esc(p.isin)}</small></div>
      <div data-eti="Scadenza">${fmtData(p.titolo.scadenza)}</div>
      <div class="num forte" data-eti="Nominale">${fmtNum(p.nominale, 0)}</div>
      <div class="num" data-eti="Peso">${fmtNum(peso(p, tot), 1)}%</div>
      <div class="num" data-eti="Prezzo di carico">${fmtNum(capitale / p.nominale * 100, 3)}</div>
      <div class="num" data-eti="Capitale (€)">${fmtNum(capitale, 0)}</div>
      <div class="num" data-eti="Valore oggi (€)">${fmtNum(p.controvalore, 0)}</div>
      <div class="num" data-eti="Cedola annua (€)">${fmtNum(p.cedolaAnnuaNetta)}</div>
      <div class="agg-dove" data-eti="Portafogli">${testoDove}</div></div>`;
  }).join('');
  return testa + righe;
}

export function aggiornaAggregato() {
  const radice = document.getElementById('righe-aggregato');
  if (!radice) return; // si vede solo un messaggio
  const lista = scelti();
  const lotti = lista.flatMap(p => p.lotti);
  const gruppi = lista.map(p => p.lotti);
  const posizioni = risolviPosizioni(sommaPerIsin(lotti), stato.titoli);
  const tot = calcolaTotali(posizioni);

  const r = aggiornaRiepilogoAcquisti(lotti, tot);
  aggiornaPannelloAnalisi(posizioni, tot, dataCalcolo(), gruppi);
  aggiornaCapitalGain(['scadenza', 'oggi'], gruppi, stato.titoli);
  radice.innerHTML = righeTitoli(posizioni, tot, lista);
  document.getElementById('riassunto-aggregato').textContent =
    quanti(tot.numero, 'titolo', 'titoli') + ' · nominale ' + fmtNum(tot.nominale, 0) + ' €';

  const avviso = document.getElementById('avviso-aggregato');
  avviso.className = r.esclusi > 0 ? 'messaggio messaggio-avviso' : '';
  avviso.textContent = r.esclusi === 0 ? ''
    : quanti(r.esclusi, 'acquisto escluso', 'acquisti esclusi') + ' dai calcoli (titoli non più nel file, scaduti o non in euro).';
}

document.getElementById('view-portafoglio').addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.agg;
  if (!id) return;
  const esclusi = leggiEsclusi();
  if (e.target.checked) esclusi.delete(id); else esclusi.add(id);
  salvaEsclusi(esclusi);
  document.dispatchEvent(new CustomEvent('ridisegna-portafoglio'));
  const casella = document.querySelector('[data-agg="' + CSS.escape(id) + '"]');
  if (casella) casella.focus({ preventScroll: true });
});
