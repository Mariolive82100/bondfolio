// Pannello di analisi (riepilogo + grafici), usato sia dalla bozza sia dal portafoglio costruito.

import { calcolaIndicatori, scalettaScadenze, pesoPerEmittente, pesoPerTitolo, pesoPerTipo, pesoPerRating, incassiMensili, flussoAnnuo } from './portafoglio-calcoli.js';
import { graficoBarre, graficoBarreImpilate, graficoTorta, graficoVuoto } from './grafici.js';
import { etichettaDaOrdinale } from './rating.js';
import { fmtNum, fmtData, esc, NOMI_MESI } from './formati.js';
import { cashflowAttuale } from './cashflow-dati.js';
import { capitalGainPerTitolo } from './capital-gain.js';
import { stato } from './state.js';
import { costruisciCalendario, prossimiDodiciMesi, unisciAnni, aggiungiStimaMensile } from './cashflow-calcoli.js';

// Se c'è il calendario reale (file cashflow o voci salvate online), i grafici lo usano e per i soli titoli
// senza dati reali aggiungono la stima, segnalandolo. Senza calendario reale è tutto stimato. Quando il file cambia, il pannello si ridisegna da solo.
let ultimaChiamata = null; // { posizioni, dataRif, acquisti }
document.addEventListener('cashflow-aggiornato', () => {
  if (ultimaChiamata) aggiornaGrafici(ultimaChiamata.posizioni, ultimaChiamata.dataRif, ultimaChiamata.acquisti);
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
// acquisti = [{ isin, nominale, prezzoCarico }]: da questi prezzi si calcola il capital gain del calendario
export function aggiornaPannelloAnalisi(posizioni, tot, dataRif, acquisti = []) {
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
  ultimaChiamata = { posizioni: posizioni, dataRif: dataRif, acquisti: acquisti };
  aggiornaGrafici(posizioni, dataRif, acquisti);
}

// Ridisegna i grafici (a ogni modifica dei nominali)
function aggiornaGrafici(posizioni, dataRif, acquisti) {
  const metti = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };

  const cal = calendarioReale(posizioni, dataRif);
  const esatto = cal !== null;
  const stimati = esatto ? cal.senzaDati : [];
  const nomiStimati = stimati.map(p => esc(p.titolo.nome)).join(', ');
  const quantiStimati = stimati.length === 1 ? '1 titolo' : stimati.length + ' titoli';
  const origine = stimati.length === 0 ? 'calendario reale'
    : 'calendario reale + <strong>stima per ' + quantiStimati + ' senza dati</strong> (' + nomiStimati + ')';
  const flusso = esatto ? unisciAnni(cal.perAnno, flussoAnnuo(stimati, dataRif)) : flussoAnnuo(posizioni, dataRif);
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
  metti('g-flusso-nota', flusso.length === 0 ? '' : esatto
    ? 'Fino alla scadenza: ' + fmtNum(totCedole, 0) + ' € di cedole nette + ' + fmtNum(totRimborsi, 0) + ' € di rimborsi = ' + fmtNum(totCedole + totRimborsi, 0) + ' € · ' + origine
      + ' · per i dati reali i rimborsi sono al netto delle tasse su capital gain e disaggio' + (stimati.length > 0 ? '; per la stima il rimborso è al 100%, senza quelle tasse' : '')
    : 'Fino alla scadenza: ' + fmtNum(totCedole, 0) + ' € di cedole nette + ' + fmtNum(totRimborsi, 0) + ' € di rimborsi = ' + fmtNum(totCedole + totRimborsi, 0) + ' € (stima: rimborso al 100%, cedole dai mesi ancora da pagare)');

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

  if (esatto) {
    const stima = aggiungiStimaMensile(prossimiDodiciMesi(cal, dataRif), stimati, dataRif);
    const dodici = stima.mesi;
    const notaSenzaMesi = stima.nonCollocati === 0 ? ''
      : ' · ' + (stima.nonCollocati === 1 ? '1 titolo senza mesi di pagamento non è conteggiato' : stima.nonCollocati + ' titoli senza mesi di pagamento non sono conteggiati') + ' in questo grafico';
    const totale12 = dodici.reduce((s, x) => s + x.cedole, 0);
    metti('g-cedole', totale12 === 0 ? graficoVuoto('Nessuna cedola nei prossimi 12 mesi') : graficoBarre(dodici.map(x => ({
      etichetta: NOMI_MESI[x.mese - 1] + ' ' + String(x.anno).slice(2),
      valore: x.cedole,
      titolo: NOMI_MESI[x.mese - 1] + ' ' + x.anno + ': ' + fmtNum(x.cedole) + ' € netti'
    }))));
    metti('g-cedole-nota', (totale12 === 0 ? 'Nessun importo nei 12 mesi' : 'Prossimi 12 mesi: ' + fmtNum(totale12, 0) + ' € · media ' + fmtNum(totale12 / 12, 0) + ' € al mese') + ' · ' + origine + notaSenzaMesi);
  } else {
    const incassi = incassiMensili(posizioni);
    const totaleCedole = incassi.mesi.reduce((s, x) => s + x, 0);
    metti('g-cedole', totaleCedole === 0 ? graficoVuoto('Nessuna cedola') : graficoBarre(incassi.mesi.map((v, i) => ({
      etichetta: NOMI_MESI[i],
      valore: v,
      titolo: NOMI_MESI[i] + ': ' + fmtNum(v) + ' € netti'
    }))));
    metti('g-cedole-nota', totaleCedole === 0 ? '' :
      'Media: ' + fmtNum(totaleCedole / 12, 0) + ' € al mese (stima)' +
      (incassi.nonCollocati > 0 ? ` · ${incassi.nonCollocati} ${incassi.nonCollocati === 1 ? 'titolo non ha' : 'titoli non hanno'} i mesi di pagamento nel file` : ''));
  }

  // Tabella del calendario
  const notaTabella = stimati.length === 0 ? ''
    : '<div class="messaggio messaggio-avviso">In questa tabella ci sono solo i dati reali: ' + (stimati.length === 1 ? 'manca ' : 'mancano ') + nomiStimati + '. La stima è inclusa nei grafici, quindi il totale qui sotto può essere più basso.</div>';
  metti('g-calendario', esatto ? notaTabella + htmlCalendario(cal, capitalGainPerTitolo(acquisti, stato.titoli, () => 100))
    : graficoVuoto(posizioni.some(p => p.valida)
      ? 'Per vedere date e importi reali carica il file dei cashflow nella schermata Dati (i grafici usano una stima).'
      : 'Nessun titolo nel portafoglio'));
}

// Tabella degli incassi: una riga per data e titolo (cedola e tassa sulla cedola sommate).
// guadagni = capital gain a scadenza per titolo (vedi capital-gain.js): compare solo sulle righe di rimborso.
function htmlCalendario(cal, guadagni) {
  const mappa = new Map();
  cal.righe.forEach(r => {
    const k = r.data + '|' + r.isin;
    const v = mappa.get(k) || { data: r.data, isin: r.isin, nome: r.nome, lordo: 0, tasse: 0, netto: 0, capitale: 0, cedola: false, rimborso: false };
    if (r.tipo === 'tassa') v.tasse += r.importo; else v.lordo += r.importo;
    if (r.tipo === 'cedola') v.cedola = true;
    if (r.tipo === 'rimborso') { v.rimborso = true; v.capitale += r.importo; }
    v.netto += r.importo;
    mappa.set(k, v);
  });
  const cella = 'padding:6px 10px;border-bottom:1px solid #EEF0F3;white-space:nowrap;font-variant-numeric:tabular-nums;';
  const testa = 'padding:8px 10px;position:sticky;top:0;background:#fff;text-align:left;font-weight:600;border-bottom:1px solid #D9DEE4;';
  // Se un titolo è rimborsato in più volte, il suo capital gain si divide in proporzione agli importi rimborsati
  const rimborsato = new Map();
  mappa.forEach(v => rimborsato.set(v.isin, (rimborsato.get(v.isin) || 0) + v.capitale));
  let totale = 0, totaleGain = 0, totaleMinus = 0;
  const righe = Array.from(mappa.values()).map(v => {
    totale += v.netto;
    const g = v.rimborso && rimborsato.get(v.isin) > 0 ? guadagni.get(v.isin) : undefined;
    let testoGain = '—';
    if (g) {
      const importo = g.netto * v.capitale / rimborsato.get(v.isin);
      if (importo < 0) { totaleMinus -= importo; testoGain = fmtNum(importo) + ' (minus)'; }
      else { totaleGain += importo; testoGain = fmtNum(importo); }
    }
    const evento = v.cedola && v.rimborso ? 'Cedola + rimborso' : v.cedola ? 'Cedola' : v.rimborso ? 'Rimborso' : 'Tasse';
    return '<tr><td class="cal-data" style="' + cella + '">' + fmtData(v.data) + '</td>'
      + '<td class="cal-titolo" style="' + cella + 'white-space:normal;">' + esc(v.nome) + '</td>'
      + '<td class="cal-evento" style="' + cella + '">' + evento + '</td>'
      + '<td class="cal-lordo" data-eti="Lordo" style="' + cella + 'text-align:right;">' + fmtNum(v.lordo) + '</td>'
      + '<td class="cal-tasse" data-eti="Tasse" style="' + cella + 'text-align:right;">' + fmtNum(v.tasse) + '</td>'
      + '<td class="cal-netto" data-eti="Netto €" style="' + cella + 'text-align:right;font-weight:600;">' + fmtNum(v.netto) + '</td>'
      + '<td class="cal-gain' + (g ? '' : ' cal-gain-vuoto') + '" data-eti="Capital gain netto €" style="' + cella + 'text-align:right;">' + testoGain + '</td></tr>';
  });
  return '<div style="max-height:420px;overflow:auto;"><table class="tabella-calendario" style="width:100%;border-collapse:collapse;font-size:12px;">'
    + '<thead><tr><th style="' + testa + '">Data</th><th style="' + testa + '">Titolo</th><th style="' + testa + '">Evento</th>'
    + '<th style="' + testa + 'text-align:right;">Lordo €</th><th style="' + testa + 'text-align:right;">Tasse €</th><th style="' + testa + 'text-align:right;">Netto €</th><th style="' + testa + 'text-align:right;">Capital gain netto €</th></tr></thead>'
    + '<tbody>' + righe.join('') + '</tbody></table></div>'
    + '<div class="nota-grafico">' + mappa.size + ' incassi · totale netto ' + fmtNum(totale, 0) + ' € · importi del calendario reale, riproporzionati ai tuoi nominali'
    + '<br>Capital gain netto in tabella: ' + fmtNum(totaleGain) + ' €' + (totaleMinus > 0 ? ' · minusvalenze a parte: ' + fmtNum(totaleMinus) + ' €' : '')
    + '. È una stima calcolata come nel riquadro del capital gain: è solo un dettaglio del rimborso, non va sommato alla colonna Netto e può non coincidere con la colonna Tasse.</div>';
}
