// Pannello di analisi (riepilogo + grafici), usato sia dalla bozza sia dal portafoglio costruito.

import { calcolaIndicatori, scalettaScadenze, pesoPerEmittente, pesoPerTitolo, pesoPerTipo, pesoPerRating, incassiMensili, flussoAnnuo } from './portafoglio-calcoli.js';
import { graficoBarre, graficoBarreImpilate, graficoTorta, graficoVuoto } from './grafici.js';
import { etichettaDaOrdinale } from './rating.js';
import { fmtNum, NOMI_MESI } from './formati.js';

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
  aggiornaGrafici(posizioni, dataRif);
}

// Ridisegna i grafici (a ogni modifica dei nominali)
function aggiornaGrafici(posizioni, dataRif) {
  const metti = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  const flusso = flussoAnnuo(posizioni, dataRif);
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
  const totCedole = flusso.reduce((s, x) => s + x.cedole, 0), totRimborsi = flusso.reduce((s, x) => s + x.rimborsi, 0);
  metti('g-flusso-nota', flusso.length === 0 ? '' :
    'Fino alla scadenza: ' + fmtNum(totCedole, 0) + ' € di cedole nette + ' + fmtNum(totRimborsi, 0) + ' € di rimborsi = ' + fmtNum(totCedole + totRimborsi, 0) + ' € (rimborso al 100%, cedole dai mesi ancora da pagare)');

  const scadenze = scalettaScadenze(posizioni);
  metti('g-scadenze', scadenze.length === 0 ? graficoVuoto('Nessun dato') : graficoBarre(scadenze.map(x => ({
    etichetta: String(x.anno),
    valore: x.nominale,
    titolo: x.anno + ': ' + fmtNum(x.nominale, 0) + ' € di nominale'
  }))));

  // Torte: i pesi sono sul nominale; al centro, a riposo, il nominale totale
  const totaleNominale = posizioni.reduce((s, p) => s + (p.valida ? p.nominale : 0), 0);
  const centro = { titolo: fmtNum(totaleNominale, 0) + ' €', sotto: 'nominale totale' };
  const torta = voci => voci.length === 0 ? graficoVuoto('Nessun dato') : graficoTorta(voci.map(x => ({
    nome: x.nome, pct: x.pct, altri: x.altri, valoreTesto: fmtNum(x.nominale, 0) + ' € di nominale'
  })), centro);
  metti('g-emittenti', torta(pesoPerEmittente(posizioni)));
  metti('g-titoli', torta(pesoPerTitolo(posizioni)));
  metti('g-tipo', torta(pesoPerTipo(posizioni)));
  metti('g-rating', torta(pesoPerRating(posizioni)));

  const incassi = incassiMensili(posizioni);
  const totaleCedole = incassi.mesi.reduce((s, x) => s + x, 0);
  metti('g-cedole', totaleCedole === 0 ? graficoVuoto('Nessuna cedola') : graficoBarre(incassi.mesi.map((v, i) => ({
    etichetta: NOMI_MESI[i],
    valore: v,
    titolo: NOMI_MESI[i] + ': ' + fmtNum(v) + ' € netti'
  }))));
  metti('g-cedole-nota', totaleCedole === 0 ? '' :
    'Media: ' + fmtNum(totaleCedole / 12, 0) + ' € al mese' +
    (incassi.nonCollocati > 0 ? ` · ${incassi.nonCollocati} ${incassi.nonCollocati === 1 ? 'titolo non ha' : 'titoli non hanno'} i mesi di pagamento nel file` : ''));
}
