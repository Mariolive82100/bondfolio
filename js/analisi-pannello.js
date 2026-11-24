// Pannello di analisi (riepilogo + grafici), usato sia dalla bozza sia dal portafoglio costruito.

import { calcolaIndicatori, scalettaScadenze, pesoPerEmittente, pesoPerTitolo, pesoPerTipo, pesoPerRating, incassiMensili, flussoAnnuo } from './portafoglio-calcoli.js';
import { graficoBarre, graficoBarreImpilate, graficoTorta, graficoVuoto } from './grafici.js';
import { etichettaDaOrdinale } from './rating.js';
import { fmtNum, fmtData, esc, NOMI_MESI } from './formati.js';
import { cashflowAttuale } from './cashflow-dati.js';
import { costruisciCalendario, prossimiDodiciMesi } from './cashflow-calcoli.js';

// Se il calendario reale (file cashflow) è stato caricato nella schermata Dati, i grafici lo usano;
// altrimenti restano le stime di prima. Quando il file cambia, il pannello si ridisegna da solo.
let ultimaChiamata = null; // { posizioni, dataRif }
document.addEventListener('cashflow-aggiornato', () => {
  if (ultimaChiamata) aggiornaGrafici(ultimaChiamata.posizioni, ultimaChiamata.dataRif);
});

// Calendario reale per il portafoglio, oppure null (file non caricato o nessun titolo coperto).
// Gli incassi già avvenuti (prima della data di riferimento) vengono esclusi.
function calendarioReale(posizioni, dataRif) {
  const cf = cashflowAttuale();
  if (!cf) return null;
  const eventi = new Map();
  cf.perIsin.forEach((lista, isin) => {
    const futuri = lista.filter(e => e.data >= dataRif);
    if (futuri.length > 0) eventi.set(isin, futuri);
  });
  const cal = costruisciCalendario(posizioni, eventi);
  return cal.righe.length > 0 ? cal : null;
}

// Codice HTML del pannello (numeri e grafici si riempiono poi con aggiornaPannelloAnalisi)
export function htmlPannelloAnalisi() {
  return `
      <div class="riepilogo">
        <div class="card"><div class="testo-soft">Nominale totale</div><div class="valore" id="t-nominale"></div></div>
        <div class="card"><div class="testo-soft">Numero titoli</div><div class="valore" id="t-numero"></div></div>
        <div class="card"><div class="testo-soft">Cedole annue nette</div><div class="valore" id="t-cedole-nette"></div></div>
        <div class="card"><div class="testo-soft">Capitale impiegato (stima)</div><div class="valore" id="t-controvalore"></div></div>
        <div class="card"><div class="testo-soft">Rendimento lordo</div><div class="valore" id="t-rend-lordo"></div></div>
        <div class="card"><div class="testo-soft">Rendimento netto</div><div class="valore" id="t-rend-netto"></div></div>
        <div class="card"><div class="testo-soft">Duration</div><div class="valore" id="t-duration"></div></div>
        <div class="card"><div class="testo-soft">Scadenza media</div><div class="valore" id="t-scadenza"></div></div>
        <div class="card"><div class="testo-soft">Cedola media netta</div><div class="valore" id="t-cedola-media"></div></div>
        <div class="card"><div class="testo-soft">Rating medio</div><div class="valore" id="t-rating"></div><div class="testo-soft" id="t-rating-nota"></div></div>
      </div>

      <div class="grafici">
        <section class="card">
          <div class="card-titolo">Flusso di cassa per anno</div>
          <div class="testo-soft">Cedole nette + rimborsi (€)</div>
          <div id="g-flusso"></div>
          <div class="nota-grafico" id="g-flusso-nota"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Cedole nette per anno</div>
          <div class="testo-soft">Solo le cedole, senza i rimborsi (€)</div>
          <div id="g-cedole-anno"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Scaletta delle scadenze</div>
          <div class="testo-soft">Nominale per anno di scadenza (€)</div>
          <div id="g-scadenze"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Incassi cedolari netti per mese</div>
          <div class="testo-soft">Cedole nette incassate in ogni mese (€)</div>
          <div id="g-cedole"></div>
          <div class="nota-grafico" id="g-cedole-nota"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Diversificazione per emittente</div>
          <div class="testo-soft">Peso sul nominale totale</div>
          <div id="g-emittenti"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Peso dei singoli titoli</div>
          <div class="testo-soft">Peso sul nominale totale</div>
          <div id="g-titoli"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Tipo di emittente</div>
          <div class="testo-soft">Governativi, sovranazionali, societari</div>
          <div id="g-tipo"></div>
        </section>
        <section class="card">
          <div class="card-titolo">Distribuzione per rating</div>
          <div class="testo-soft">Peso sul nominale totale</div>
          <div id="g-rating"></div>
        </section>
        <section class="card" style="grid-column: 1 / -1;">
          <div class="card-titolo">Calendario incassi</div>
          <div class="testo-soft">Date e importi reali di cedole e rimborsi, al netto delle tasse (€)</div>
          <div id="g-calendario"></div>
        </section>
      </div>
  `;
}

// Riempie riepilogo e grafici. dataRif = data di riferimento del file ("aaaa-mm-gg")
export function aggiornaPannelloAnalisi(posizioni, tot, dataRif) {
  const set = (id, testo) => { const el = document.getElementById(id); if (el) el.textContent = testo; };
  set('t-nominale', fmtNum(tot.nominale, 0) + ' €');
  set('t-numero', String(tot.numero));
  set('t-cedole-nette', fmtNum(tot.cedoleNette) + ' €');
  set('t-controvalore', fmtNum(tot.controvalore, 0) + ' €');

  set('t-rend-lordo', tot.rendLordo === null ? '—' : fmtNum(tot.rendLordo) + '%');
  set('t-rend-netto', tot.rendNetto === null ? '—' : fmtNum(tot.rendNetto) + '%');
  set('t-duration', tot.duration === null ? '—' : fmtNum(tot.duration, 1) + ' anni');
  const ind = calcolaIndicatori(posizioni, dataRif);
  set('t-scadenza', ind.scadenzaAnni === null ? '—' : fmtNum(ind.scadenzaAnni, 1) + ' anni');
  set('t-cedola-media', ind.cedolaNetta === null ? '—' : fmtNum(ind.cedolaNetta) + '%');
  set('t-rating', etichettaDaOrdinale(ind.ratingOrdinale));
  set('t-rating-nota', ind.titoliValidi > 0 && ind.ratingConteggio < ind.titoliValidi
    ? 'su ' + ind.ratingConteggio + ' di ' + ind.titoliValidi + ' titoli con rating' : '');
  ultimaChiamata = { posizioni: posizioni, dataRif: dataRif };
  aggiornaGrafici(posizioni, dataRif);
}

// Ridisegna i grafici (a ogni modifica dei nominali)
function aggiornaGrafici(posizioni, dataRif) {
  const metti = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  const cal = calendarioReale(posizioni, dataRif);
  const esatto = cal !== null;
  const flusso = esatto ? cal.perAnno : flussoAnnuo(posizioni, dataRif);
  metti('g-flusso', flusso.length === 0 ? graficoVuoto('Nessun dato') : graficoBarreImpilate(flusso.map(x => ({
    etichetta: String(x.anno),
    parti: [x.cedole, x.rimborsi],
    titolo: x.anno + ': cedole nette ' + fmtNum(x.cedole) + ' € + rimborsi ' + fmtNum(x.rimborsi) + ' € = ' + fmtNum(x.cedole + x.rimborsi) + ' €'
  })), ['Cedole nette', 'Rimborsi a scadenza']));
  const cedoleAnno = flusso.some(x => x.cedole > 0);
  metti('g-cedole-anno', !cedoleAnno ? graficoVuoto('Nessuna cedola') : graficoBarre(flusso.map(x => ({
    etichetta: String(x.anno),
    valore: x.cedole,
    titolo: x.anno + ': ' + fmtNum(x.cedole) + ' € di cedole nette'
  }))));
  const
