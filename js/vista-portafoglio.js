// Schermata 3: portafoglio (bozza e, più avanti, portafoglio costruito)

import { stato, impostaBozza } from './state.js';
import { risolviPosizioni, calcolaTotali, peso } from './portafoglio-calcoli.js';
import { esc, fmtNum, fmtData } from './formati.js';

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
      <div class="num">${fmtNum(t.cedola)}%</div>
      <div class="num">${fmtNum(t.prezzo)}</div>
      <div class="num">${fmtNum(t.lottoMinimo, 0)}</div>
      <div class="num"><input class="input-nominale" type="text" inputmode="numeric"
        data-isin="${esc(p.isin)}" value="${fmtNum(p.nominale, 0)}" aria-label="Nominale"></div>
      <div class="num" data-peso="${esc(p.isin)}"></div>
      <div class="num" data-cedole="${esc(p.isin)}"></div>
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
      <button class="btn btn-primario" data-azione="vai-analisi">Vai all'analisi</button>
    </div>`;

  if (modo === 'costruito') {
    radice.innerHTML = `<div class="portafoglio">${intestazioneModo}
      <div class="card vuoto">
        <p>Non c'è ancora nessun portafoglio costruito.</p>
        <p>Arriverà con il pulsante «Conferma acquisto» (prossimo passo).</p>
      </div></div>`;
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

  const posizioni = risolviPosizioni(stato.bozza, stato.titoli);
  const tot = calcolaTotali(posizioni);

  radice.innerHTML = `
    <div class="portafoglio">
      ${intestazioneModo}

      <div class="riepilogo">
        <div class="card"><div class="testo-soft">Nominale totale</div><div class="valore" id="t-nominale"></div></div>
        <div class="card"><div class="testo-soft">Numero titoli</div><div class="valore" id="t-numero"></div></div>
        <div class="card"><div class="testo-soft">Cedole annue lorde</div><div class="valore" id="t-cedole"></div></div>
      </div>

      ${tot.escluse > 0 ? `<div class="messaggio messaggio-avviso" id="avviso-escluse"></div>` : ''}

      <section class="card tabella-card">
        <div class="tabella-scroll"><div class="tabella tabella-portafoglio">
          <div class="riga-testa">
            <div>Titolo</div><div>Scadenza</div><div class="num">Cedola</div><div class="num">Prezzo</div>
            <div class="num">Lotto min.</div><div class="num">Nominale</div><div class="num">Peso</div>
            <div class="num">Cedole annue</div><div></div>
          </div>
          ${posizioni.map(riga).join('')}
        </div></div>
      </section>
    </div>`;

  aggiornaNumeri();
}

// Aggiorna pesi, cedole e totali senza ridisegnare le righe (così il cursore non si perde)
function aggiornaNumeri() {
  const posizioni = risolviPosizioni(stato.bozza, stato.titoli);
  const tot = calcolaTotali(posizioni);

  posizioni.forEach(p => {
    const cellaPeso = radice.querySelector(`[data-peso="${p.isin}"]`);
    const cellaCedole = radice.querySelector(`[data-cedole="${p.isin}"]`);
    if (cellaPeso) { const w = peso(p, tot); cellaPeso.textContent = w === null ? '—' : fmtNum(w, 1) + '%'; }
    if (cellaCedole) cellaCedole.textContent = fmtNum(p.cedolaAnnua) + ' €';
  });

  const set = (id, testo) => { const el = document.getElementById(id); if (el) el.textContent = testo; };
  set('t-nominale', fmtNum(tot.nominale, 0) + ' €');
  set('t-numero', String(tot.numero));
  set('t-cedole', fmtNum(tot.cedoleAnnue) + ' €');
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
  const minimo = (titolo && titolo.lottoMinimo) || 1;

  let valore = parseInt(campo.value.replace(/\D/g, ''), 10);
  if (Number.isNaN(valore) || valore < minimo) valore = minimo;
  campo.value = fmtNum(valore, 0);

  aggiornandoDaQui = true;
  impostaBozza(stato.bozza.map(b => b.isin === isin ? { isin: b.isin, nominale: valore } : b));
  aggiornandoDaQui = false;
  aggiornaNumeri();
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
    case 'modo-costruito': modo = 'costruito'; disegna(); break;
    case 'rimuovi': impostaBozza(stato.bozza.filter(b => b.isin !== el.dataset.isin)); break;
    case 'vai-analisi': vai('analisi'); break;
    case 'vai-selezione': vai('selezione'); break;
    case 'vai-dati': vai('dati'); break;
  }
});

document.addEventListener('dati-aggiornati', disegna);
document.addEventListener('bozza-aggiornata', () => { if (!aggiornandoDaQui) disegna(); });

disegna();
