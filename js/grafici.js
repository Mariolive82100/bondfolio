// Piccoli grafici disegnati con HTML e CSS (nessuna libreria esterna).
// Ogni funzione restituisce il codice HTML da mettere nella pagina.

import { esc, fmtNum } from './formati.js';

// 1234 -> "1,2k", 850 -> "850"
function compatto(v) {
  return v >= 1000 ? fmtNum(v / 1000, 1) + 'k' : fmtNum(v, 0);
}

// Colonne verticali. voci = [{ etichetta, valore, titolo }]
export function graficoColonne(voci) {
  const max = Math.max(0, ...voci.map(v => v.valore));
  const colonne = voci.map(v => {
    const altezza = max > 0 && v.valore > 0 ? Math.max(3, v.valore / max * 100) : 0;
    return `<div class="colonna" title="${esc(v.titolo)}">
      <span class="col-valore">${v.valore > 0 ? compatto(v.valore) : ''}</span>
      <div class="col-area"><div class="col-barra" style="height:${altezza.toFixed(1)}%"></div></div>
      <span class="col-etichetta">${esc(v.etichetta)}</span>
    </div>`;
  }).join('');
  return `<div class="colonne">${colonne}</div>`;
}

// Barre orizzontali. voci = [{ nome, pct, titolo, altri }]
export function graficoBarre(voci) {
  return `<div class="barre">` + voci.map(v => `
    <div class="barra-riga" title="${esc(v.titolo)}">
      <span class="barra-nome">${esc(v.nome)}</span>
      <div class="barra-pista"><div class="barra-riempi ${v.altri ? 'barra-altri' : ''}" style="width:${Math.min(100, v.pct).toFixed(1)}%"></div></div>
      <span class="barra-pct">${fmtNum(v.pct, 1)}%</span>
    </div>`).join('') + `</div>`;
}

export function graficoVuoto(testo) {
  return `<div class="grafico-vuoto">${esc(testo)}</div>`;
}
