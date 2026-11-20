// Piccoli grafici disegnati con HTML e CSS (nessuna libreria esterna).
// Ogni funzione restituisce il codice HTML da mettere nella pagina.

import { esc, fmtNum } from './formati.js';

// 1234 -> "1,2k", 850 -> "850"
function compatto(v) {
  return v >= 1000 ? fmtNum(v / 1000, 1) + 'k' : fmtNum(v, 0);
}

// Barre orizzontali, una riga per voce (etichetta a sinistra, barra, valore a destra).
// voci = [{ etichetta, valore, titolo }]
export function graficoBarre(voci) {
  const max = Math.max(0, ...voci.map(v => v.valore));
  const righe = voci.map(v => {
    const larghezza = max > 0 && v.valore > 0 ? Math.max(1.5, v.valore / max * 100) : 0;
    return `<div class="barra-riga" title="${esc(v.titolo)}">
      <span class="barra-etichetta">${esc(v.etichetta)}</span>
      <div class="barra-area"><div class="barra-pieno" style="width:${larghezza.toFixed(1)}%"></div></div>
      <span class="barra-valore">${v.valore > 0 ? compatto(v.valore) : ''}</span>
    </div>`;
  }).join('');
  return `<div class="barre">${righe}</div>`;
}

// Barre orizzontali impilate (due parti nella stessa barra), con la legenda sotto.
// voci = [{ etichetta, parti: [a, b], titolo }]; nomiParti = ['Cedole', 'Rimborsi']
export function graficoBarreImpilate(voci, nomiParti) {
  const totale = v => v.parti.reduce((s, x) => s + x, 0);
  const max = Math.max(0, ...voci.map(totale));
  const righe = voci.map(v => {
    const segmenti = v.parti.map((x, k) => {
      const w = max > 0 && x > 0 ? Math.max(1, x / max * 100) : 0;
      return `<div class="seg seg-${k}" style="width:${w.toFixed(1)}%"></div>`;
    }).join('');
    return `<div class="barra-riga" title="${esc(v.titolo)}">
      <span class="barra-etichetta">${esc(v.etichetta)}</span>
      <div class="barra-area">${segmenti}</div>
      <span class="barra-valore">${totale(v) > 0 ? compatto(totale(v)) : ''}</span>
    </div>`;
  }).join('');
  const legenda = nomiParti.map((n, k) => `<span class="leg-voce"><span class="torta-colore seg-${k}"></span>${esc(n)}</span>`).join('');
  return `<div class="barre">${righe}</div><div class="leg-righe">${legenda}</div>`;
}

// Grafico a torta (ad anello), interattivo: passando il mouse su una fetta o su una voce della legenda
// la fetta si evidenzia e al centro compaiono nome, percentuale e importo.
// fette = [{ nome, pct, valoreTesto, altri }]; centro = { titolo, sotto } (testo mostrato quando non c'è nulla di evidenziato)
const COLORI_TORTA = ['#0B6E5A', '#3B82C4', '#E0A21B', '#B8548A', '#6C7BD9', '#4FA38B', '#D9772B'];
const COLORE_ALTRI = '#98A2B3';
const RAGGIO = 70;
const CIRCONFERENZA = 2 * Math.PI * RAGGIO;

export function graficoTorta(fette, centro) {
  let inizio = 0;
  let k = 0;
  const colori = fette.map(f => (f.altri ? COLORE_ALTRI : COLORI_TORTA[k++ % COLORI_TORTA.length]));
  const dati = (f, i) => `data-fetta="${i}" data-nome="${esc(f.nome)}" data-pct="${esc(fmtNum(f.pct, 1))}%" data-valore="${esc(f.valoreTesto || '')}"`;

  const cerchi = fette.map((f, i) => {
    const lunghezza = Math.max(0, f.pct / 100 * CIRCONFERENZA);
    const c = `<circle class="fetta" ${dati(f, i)} r="${RAGGIO}" cx="0" cy="0" fill="none" stroke="${colori[i]}"
      stroke-dasharray="${lunghezza.toFixed(2)} ${(CIRCONFERENZA - lunghezza).toFixed(2)}" stroke-dashoffset="${(-inizio).toFixed(2)}" transform="rotate(-90)" tabindex="0"
      aria-label="${esc(f.nome)}: ${esc(fmtNum(f.pct, 1))}%"></circle>`;
    inizio += lunghezza;
    return c;
  }).join('');

  const legenda = fette.map((f, i) => `
    <li ${dati(f, i)}>
      <span class="torta-colore" style="background:${colori[i]}"></span>
      <span class="torta-nome">${esc(f.nome)}</span>
      <span class="torta-pct">${fmtNum(f.pct, 1)}%</span>
    </li>`).join('');

  return `<div class="torta" data-centro-titolo="${esc(centro.titolo)}" data-centro-sotto="${esc(centro.sotto)}">
    <div class="torta-disegno">
      <svg viewBox="-100 -100 200 200" role="img">${cerchi}</svg>
      <div class="torta-centro"><strong>${esc(centro.titolo)}</strong><span>${esc(centro.sotto)}</span></div>
    </div>
    <ul class="torta-legenda">${legenda}</ul>
  </div>`;
}

function attivaFetta(torta, el) {
  torta.classList.add('ha-attiva');
  torta.querySelectorAll('[data-fetta]').forEach(x => x.classList.toggle('is-attiva', x.dataset.fetta === el.dataset.fetta));
  const centro = torta.querySelector('.torta-centro');
  centro.innerHTML = `<strong>${el.dataset.pct}</strong><span>${el.dataset.nome}</span><span>${el.dataset.valore}</span>`;
}

function ripristinaTorta(torta) {
  torta.classList.remove('ha-attiva');
  torta.querySelectorAll('.is-attiva').forEach(x => x.classList.remove('is-attiva'));
  const centro = torta.querySelector('.torta-centro');
  centro.innerHTML = `<strong>${torta.dataset.centroTitolo}</strong><span>${torta.dataset.centroSotto}</span>`;
}

// Un solo ascolto per tutte le torte (funziona anche dopo che i grafici vengono ridisegnati)
['mouseover', 'focusin'].forEach(evento => document.addEventListener(evento, e => {
  const torta = e.target.closest && e.target.closest('.torta');
  if (!torta) return;
  const el = e.target.closest('[data-fetta]');
  if (el) attivaFetta(torta, el); else ripristinaTorta(torta);
}));
['mouseout', 'focusout'].forEach(evento => document.addEventListener(evento, e => {
  const torta = e.target.closest && e.target.closest('.torta');
  if (torta && !(e.relatedTarget && torta.contains(e.relatedTarget))) ripristinaTorta(torta);
}));

export function graficoVuoto(testo) {
  return `<div class="grafico-vuoto">${esc(testo)}</div>`;
}
