// Riquadro "Se guardi il mercato oggi" di Costruito e Aggregato: vendere o ricomprare ai prezzi del file.
// Parte chiuso, perché i dati del portafoglio comprato sono quelli dell'acquisto, e non entra nel report.

import { stato } from './state.js';
import { riepilogoAcquisti } from './costruito-calcoli.js';
import { VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';
import { scadutoOggi, dataFile, dataCalcolo } from './data-calcolo.js';
import { confrontoRendimenti } from './rendimento.js';
import { htmlSchedaGain, aggiornaCapitalGain } from './capital-gain.js';
import { testaComprimibile, classeChiusa } from './comprimibile.js';
import { esc, fmtNum, fmtData } from './formati.js';

const ID = 'tab-mercato';
const segno = n => (n > 0 ? '+' : n < 0 ? '−' : '');
const conSegno = (n, decimali) => segno(n) + fmtNum(Math.abs(n), decimali);

export function htmlMercatoOggi() {
  return `
    <section class="card tabella-card mercato${classeChiusa(ID, true)}">
      ${testaComprimibile(ID, 'Se guardi il mercato oggi', 'riassunto-mercato', 'confronto con i prezzi di oggi · non entra nel report', true)}
      <div class="mercato-corpo">
        <div class="riepilogo riepilogo-confronto">
          <div class="card"><div class="testo-soft">Rendimento netto al tuo acquisto (stima)</div><div class="valore" id="m-rend-acq"></div><div class="testo-soft">con i tuoi prezzi di carico</div></div>
          <div class="card"><div class="testo-soft">Rendimento netto se comprassi oggi (stima)</div><div class="valore" id="m-rend-oggi"></div><div class="testo-soft" id="m-rend-oggi-nota"></div></div>
          <div class="card"><div class="testo-soft">Differenza (oggi − acquisto)</div><div class="valore" id="m-rend-diff"></div><div class="testo-soft" id="m-rend-diff-nota"></div></div>
        </div>
        <div class="testo-soft nota-confronto" id="m-rend-nota"></div>
        <div class="riepilogo riepilogo-mercato">
          <div class="card"><div class="testo-soft">Valore oggi</div><div class="valore" id="r-valore"></div></div>
          <div class="card"><div class="testo-soft">Variazione latente dei prezzi</div><div class="valore" id="r-var"></div></div>
          ${htmlSchedaGain('oggi')}
          <div class="card"><div class="testo-soft">Duration oggi (stima)</div><div class="valore" id="m-duration"></div></div>
        </div>
        <div class="tabella-scroll"><div class="tabella tabella-mercato" id="righe-mercato"></div></div>
        <div class="tabella-piede nota-tabella" id="nota-mercato"></div>
      </div>
    </section>`;
}

// Una riga per titolo, con il prezzo medio di carico di tutti i suoi acquisti
function righe(lotti) {
  const perIsin = new Map(stato.titoli.map(t => [t.isin, t]));
  const somme = new Map();
  lotti.forEach(l => {
    const t = perIsin.get(l.isin);
    if (!t || t.valuta !== VALUTA_PORTAFOGLIO || scadutoOggi(t)) return;
    const s = somme.get(l.isin) || { t: t, isin: l.isin, nominale: 0, capitale: 0 };
    s.nominale += l.nominale;
    s.capitale += l.nominale * l.prezzoCarico / 100;
    somme.set(l.isin, s);
  });
  const testa = `<div class="riga-testa"><div>Titolo</div><div class="num">Nominale</div><div class="num">Prezzo di carico</div>
    <div class="num">Prezzo oggi</div><div class="num">Var. %</div><div class="num">Valore oggi (€)</div></div>`;
  return testa + Array.from(somme.values()).sort((a, b) => b.nominale - a.nominale).map(s => {
    const carico = s.capitale / s.nominale * 100;
    const variazione = carico > 0 ? (s.t.prezzo - carico) / carico * 100 : null;
    const classe = variazione === null ? '' : variazione >= 0 ? 'pos' : 'neg';
    return `<div class="riga">
      <div class="cella-titolo"><strong title="${esc(s.t.nome)}">${esc(s.t.nome)}</strong><small>${esc(s.isin)}</small></div>
      <div class="num" data-eti="Nominale">${fmtNum(s.nominale, 0)}</div>
      <div class="num" data-eti="Prezzo di carico">${fmtNum(carico, 3)}</div>
      <div class="num" data-eti="Prezzo oggi">${fmtNum(s.t.prezzo)}</div>
      <div class="num ${classe}" data-eti="Var. %">${variazione === null ? '—' : conSegno(variazione) + '%'}</div>
      <div class="num" data-eti="Valore oggi (€)">${fmtNum(s.nominale * s.t.prezzo / 100, 0)}</div></div>`;
  }).join('');
}

// Rendimento di tutto il portafoglio: al tuo acquisto e ricomprando oggi
function aggiornaConfronto(lotti) {
  const c = confrontoRendimenti(lotti, stato.titoli, VALUTA_PORTAFOGLIO, scadutoOggi, dataCalcolo());
  const scrivi = (id, testo) => { document.getElementById(id).textContent = testo; };
  const pct = n => (n === null ? '—' : fmtNum(n) + '%');
  scrivi('m-rend-acq', pct(c.acquisto));
  scrivi('m-rend-oggi', pct(c.oggi));
  scrivi('m-rend-oggi-nota', c.oggi === null ? '' : 'costo di oggi ' + fmtNum(c.costoOggi, 0) + ' €'
    + (c.commissioni > 0 ? ', con ' + fmtNum(c.commissioni) + ' € di commissioni' : ', senza commissioni'));
  // La differenza si calcola sui numeri come si vedono, così torna sempre
  const due = n => Math.round(n * 100) / 100;
  const d = c.acquisto === null || c.oggi === null ? null : due(due(c.oggi) - due(c.acquisto));
  scrivi('m-rend-diff', d === null ? '—' : conSegno(d) + ' pt');
  scrivi('m-rend-diff-nota', d === null ? ''
    : d > 0 ? 'oggi compreresti a un rendimento più alto'
    : d < 0 ? 'oggi compreresti a un rendimento più basso' : 'stesso rendimento');
  const esclusi = c.totale - c.conteggio;
  scrivi('m-rend-nota', 'Stessi titoli e stessi nominali, tenuti fino a scadenza. Il tuo rendimento non cambia con i prezzi di oggi.'
    + (esclusi > 0 ? ' Confronto su ' + c.conteggio + ' di ' + c.totale + ' acquisti: gli altri sono esclusi da entrambi i valori, quindi il rendimento al tuo acquisto qui può differire da quello in alto.' : ''));
}

// gruppi = un elenco di acquisti per portafoglio; tot = totali delle posizioni ai prezzi del file
export function aggiornaMercatoOggi(gruppi, tot) {
  const elenco = document.getElementById('righe-mercato');
  if (!elenco) return;
  const lotti = gruppi.flat();
  aggiornaConfronto(lotti);
  const r = riepilogoAcquisti(lotti, stato.titoli);
  document.getElementById('r-valore').textContent = fmtNum(r.valoreOggi, 0) + ' €';
  const elVar = document.getElementById('r-var');
  elVar.textContent = conSegno(r.variazione, 0) + ' €' + (r.variazionePct === null ? '' : ' (' + conSegno(r.variazionePct) + '%)');
  elVar.classList.toggle('pos', r.variazione >= 0);
  elVar.classList.toggle('neg', r.variazione < 0);
  document.getElementById('m-duration').textContent = tot.duration === null ? '—' : fmtNum(tot.duration, 1) + ' anni';
  aggiornaCapitalGain(['oggi'], gruppi, stato.titoli);
  elenco.innerHTML = righe(lotti);
  document.getElementById('nota-mercato').textContent = (dataFile() ? 'Prezzi del file del ' + fmtData(dataFile()) + '. ' : 'Prezzi del file caricato. ')
    + '«Se comprassi oggi» usa questi prezzi più le commissioni scritte nei tuoi acquisti, con acquisto alla data di oggi. La variazione riguarda solo i prezzi e non comprende rateo né tasse. La plusvalenza netta è una stima, con aliquota 12,5% o 26%, senza commissioni di vendita, disaggio, rateo e zainetto fiscale.';
}
