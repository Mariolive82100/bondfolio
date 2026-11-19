// Schermata 3: portafoglio (bozza e portafoglio costruito)

import { stato, impostaBozza } from './state.js';
import { risolviPosizioni, calcolaTotali, peso, lottoMinimo, nominaleDaCedolaNetta } from './portafoglio-calcoli.js';
import { htmlPannelloAnalisi, aggiornaPannelloAnalisi } from './analisi-pannello.js';
import { htmlCostruito, aggiornaCostruito, htmlConferma, aggiornaConferma, aggiornaImpatto, inConferma, annullaConferma } from './vista-costruito.js';
import { cedolaNetta } from './filtri.js';
import { esc, fmtNum, fmtData, leggiDecimale } from './formati.js';

const radice = document.getElementById('view-portafoglio');

let modo = 'bozza'; // 'bozza' oppure 'costruito'
let aggiornandoDaQui = false; // true quando la modifica arriva da questa schermata

function riga(p) {
  const t = p.titolo;
  const nome = t ? t.nome : p.isin;
  const sotto = t ? `${esc(p.isin)} · ${esc(t.valuta)}` : esc(p.isin);

  if (!p.valida) {
    return `
      <div class="riga riga-esclusa">
        <div class="cella-titolo"><strong title="${esc(nome)}">${esc(nome)}</strong><small>${sotto}</small></div>
        <div class="esclusa-motivo"><span class="pill pill-basso">${esc(p.motivo)}</span> <span class="testo-soft">Escluso dai calcoli</span></div>
        <button class="btn-x" data-azione="rimuovi" data-isin="${esc(p.isin)}" aria-label="Togli dal portafoglio">✕</button>
      </div>`;
  }

  return `
    <div class="riga">
      <div class="cella-titolo"><strong title="${esc(nome)}">${esc(nome)}</strong><small>${sotto}</small></div>
      <div>${fmtData(t.scadenza)}</div>
      <div class="num">${fmtNum(cedolaNetta(t))}%</div>
      <div class="num">${fmtNum(t.prezzo)}</div>
      <div class="num">${fmtNum(t.rendLordo)}%</div>
      <div class="num forte">${fmtNum(t.rendNetto)}%</div>
      <div class="num">${fmtNum(t.durationLorda, 1)}</div>
      <div class="num">${fmtNum(t.lottoMinimo, 0)}</div>
      <div class="num"><input class="input-nominale" type="text" inputmode="numeric"
        data-isin="${esc(p.isin)}" value="${fmtNum(p.nominale, 0)}" aria-label="Nominale"></div>
      <div class="num" data-peso="${esc(p.isin)}"></div>
      <div class="num">${cedolaNetta(t) > 0
        ? `<input class="input-nominale input-cedola" type="text" inputmode="decimal"
            data-isin="${esc(p.isin)}" value="${fmtNum(p.cedolaAnnuaNetta)}" aria-label="Cedola annua netta in euro">`
        : '<span class="testo-soft">—</span>'}</div>
      <button class="btn-x" data-azione="rimuovi" data-isin="${esc(p.isin)}" aria-label="Togli dal portafoglio">✕</button>
    </div>`;
}

function disegna() {
  const intestazioneModo = `
    <div class="card portafoglio-testa">
      <div class="interruttore">
        <button class="${modo === 'bozza' ? 'is-attivo' : ''}" data-azione="modo-bozza">Bozza</button>
        <button class="${modo === 'costruito' ? 'is-attivo' : ''}" data-azione="modo-costruito">Costruito</button>
      </div>
      <div class="gruppo-bottoni">
        ${modo === 'bozza' && stato.bozza.length > 0 && !inConferma() ? `
          <button class="btn btn-primario" data-azione="conferma-apri">Conferma acquisto</button>
          <button class="btn btn-secondario" data-azione="svuota">Svuota bozza</button>` : ''}
        ${modo === 'costruito' && stato.costruito.length > 0 ? `
          <button class="btn btn-secondario" data-azione="vai-selezione">Aggiungi altri acquisti</button>
          <button class="btn btn-secondario" data-azione="svuota-costruito">Svuota portafoglio</button>` : ''}
      </div>
    </div>`;

  if (modo === 'costruito') {
    if (stato.costruito.length === 0) {
      radice.innerHTML = `<div class="portafoglio">${intestazioneModo}
        <div class="card vuoto">
          <p>Non c'è ancora nessun portafoglio costruito.</p>
          <p>Prepara una bozza nella schermata Selezione e premi «Conferma acquisto».</p>
          <button class="btn btn-primario" data-azione="modo-bozza">Vai alla bozza</button>
        </div></div>`;
      return;
    }
    radice.innerHTML = `<div class="portafoglio">${intestazioneModo}${htmlCostruito()}</div>`;
    aggiornaCostruito();
    return;
  }

  if (stato.titoli.length === 0) {
    radice.innerHTML = `<div class="card vuoto">
      <p>Non ci sono ancora obbligazioni.</p>
      <p>Carica prima il file nella schermata Dati.</p>
      <button class="btn btn-primario" data-azione="vai-dati">Vai a Dati</button></div>`;
    return;
  }

  if (stato.bozza.length === 0) {
    radice.innerHTML = `<div class="portafoglio">${intestazioneModo}
      <div class="card vuoto">
        <p>La bozza è vuota.</p>
        <p>Scegli le obbligazioni nella schermata Selezione con il pulsante «+».</p>
        <button class="btn btn-primario" data-azione="vai-selezione">Vai a Selezione</button>
      </div></div>`;
    return;
  }

  if (inConferma()) {
    radice.innerHTML = `<div class="portafoglio">${intestazioneModo}${htmlConferma()}</div>`;
    aggiornaConferma();
    return;
  }

  const posizioni = risolviPosizioni(stato.bozza, stato.titoli);
  const tot = calcolaTotali(posizioni);

  radice.innerHTML = `
    <div class="portafoglio">
      ${intestazioneModo}

      ${tot.escluse > 0 ? `<div class="messaggio messaggio-avviso" id="avviso-escluse"></div>` : ''}

      <section class="card tabella-card">
        <div class="tabella-scroll"><div class="tabella tabella-portafoglio">
          <div class="riga-testa">
            <div>Titolo</div><div>Scadenza</div><div class="num">Cedola netta</div><div class="num">Prezzo</div>
            <div class="num">Rend. lordo</div><div class="num">Rend. netto</div><div class="num">Duration</div>
            <div class="num">Lotto min.</div><div class="num">Nominale</div><div class="num">Peso</div>
            <div class="num">Cedola annua netta</div><div></div>
          </div>
          ${posizioni.map(riga).join('')}
        </div></div>
        <div class="tabella-piede nota-tabella">Puoi scrivere il <strong>nominale</strong> oppure la <strong>cedola annua netta</strong> che vuoi incassare (in euro): l'altro valore si calcola da solo. Dalla cedola il nominale è arrotondato per eccesso a un multiplo del taglio minimo, quindi la cedola può risultare un po' più alta di quella scritta.</div>
      </section>

      <div id="impatto-box"></div>

      ${htmlPannelloAnalisi()}
    </div>`;

  aggiornaNumeri();
}

// Aggiorna pesi, cedole e totali senza ridisegnare le righe (così il cursore non si perde)
function aggiornaNumeri() {
  const posizioni = risolviPosizioni(stato.bozza, stato.titoli);
  const tot = calcolaTotali(posizioni);

  posizioni.forEach(p => {
    const cellaPeso = radice.querySelector(`[data-peso="${p.isin}"]`);
    if (cellaPeso) { const w = peso(p, tot); cellaPeso.textContent = w === null ? '—' : fmtNum(w, 1) + '%'; }

    // Le due caselle modificabili si allineano, tranne quella in cui stai scrivendo
    const inNominale = radice.querySelector(`input.input-nominale:not(.input-cedola)[data-isin="${p.isin}"]`);
    const inCedola = radice.querySelector(`input.input-cedola[data-isin="${p.isin}"]`);
    if (inNominale && document.activeElement !== inNominale) inNominale.value = fmtNum(p.nominale, 0);
    if (inCedola && document.activeElement !== inCedola) inCedola.value = fmtNum(p.cedolaAnnuaNetta);
  });

  const set = (id, testo) => { const el = document.getElementById(id); if (el) el.textContent = testo; };
  aggiornaPannelloAnalisi(posizioni, tot, stato.meta && stato.meta.dataRiferimento);
  aggiornaImpatto();

  set('avviso-escluse', tot.escluse === 1
    ? '1 titolo è escluso dai calcoli (non presente nel file o non in euro). Puoi toglierlo con la ✕.'
    : tot.escluse + ' titoli sono esclusi dai calcoli (non presenti nel file o non in euro). Puoi toglierli con la ✕.');
}

/* ---------- Azioni dell'utente ---------- */

// Cambio del nominale: si applica quando esci dalla casella o premi Invio
radice.addEventListener('change', e => {
  const campo = e.target;

  if (!campo.classList.contains('input-nominale')) return;

  const isin = campo.dataset.isin;
  const titolo = stato.titoli.find(t => t.isin === isin);
  if (!titolo) return;
  const minimo = lottoMinimo(titolo);

  let valore;
  if (campo.classList.contains('input-cedola')) {
    // Scritta la cedola annua netta: calcolo il nominale che la soddisfa
    const desiderata = leggiDecimale(campo.value);
    valore = desiderata === null ? null : nominaleDaCedolaNetta(titolo, desiderata);
    if (valore === null) valore = (stato.bozza.find(b => b.isin === isin) || {}).nominale;
  } else {
    valore = parseInt(campo.value.replace(/\D/g, ''), 10);
    if (Number.isNaN(valore) || valore < minimo) valore = minimo;
  }

  aggiornandoDaQui = true;
  impostaBozza(stato.bozza.map(b => b.isin === isin ? { isin: b.isin, nominale: valore } : b));
  aggiornandoDaQui = false;
  aggiornaNumeri();

  // La casella in cui hai scritto mostra il valore effettivo (la cedola può uscire un po' più alta)
  const p = risolviPosizioni(stato.bozza, stato.titoli).find(x => x.isin === isin);
  campo.value = campo.classList.contains('input-cedola') ? fmtNum(p.cedolaAnnuaNetta) : fmtNum(valore, 0);
});

radice.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList.contains('input-nominale')) e.target.blur();
});

// Selezionando tutto il testo al click si riscrive più in fretta
radice.addEventListener('focusin', e => {
  if (e.target.classList.contains('input-nominale')) e.target.select();
});

radice.addEventListener('click', e => {
  const el = e.target.closest('[data-azione]');
  if (!el) return;
  const vai = nome => document.dispatchEvent(new CustomEvent('vai-a', { detail: nome }));

  switch (el.dataset.azione) {
    case 'modo-bozza': modo = 'bozza'; disegna(); break;
    case 'modo-costruito': modo = 'costruito'; annullaConferma(); disegna(); break;
    case 'svuota':
      if (stato.bozza.length > 0 && confirm('Togliere tutti i ' + stato.bozza.length + ' titoli dalla bozza?')) {
        impostaBozza([]);
      }
      break;
    case 'rimuovi': impostaBozza(stato.bozza.filter(b => b.isin !== el.dataset.isin)); break;
    case 'vai-selezione': vai('selezione'); break;
    case 'vai-dati': vai('dati'); break;
  }
});

document.addEventListener('dati-aggiornati', disegna);
document.addEventListener('costruito-aggiornato', disegna);
document.addEventListener('ridisegna-portafoglio', e => {
  if (e.detail && e.detail.modo) modo = e.detail.modo;
  disegna();
});
document.addEventListener('bozza-aggiornata', () => { if (!aggiornandoDaQui) disegna(); });

disegna();
