// Capital gain netto: stima di guadagni e tasse dovuti alla differenza di prezzo (le cedole non c'entrano).
// - a scadenza: rimborso a 100 meno prezzo di acquisto
// - se vendi oggi: prezzo del file meno prezzo di acquisto
// Il conto si fa per titolo (più acquisti dello stesso titolo = prezzo medio). Guadagni e minusvalenze restano
// separati: le minusvalenze non vengono sottratte dai guadagni e non si calcolano crediti d'imposta.
// Non si considerano disaggio di emissione, rateo e zainetto fiscale.

import { aliquota } from './filtri.js';
import { VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';
import { scadutoOggi } from './data-calcolo.js';
import { fmtNum } from './formati.js';

// acquisti = [{ isin, nominale, prezzoCarico }]; prezzoFinale(titolo) = prezzo di uscita per 100 di nominale
// Restituisce isin -> { differenza, tasse, netto } (se differenza è negativa è una minusvalenza: niente tasse)
export function capitalGainPerTitolo(acquisti, titoli, prezzoFinale) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  const somme = new Map(); // isin -> { t, nominale, costo }
  acquisti.forEach(a => {
    const t = perIsin.get(a.isin);
    if (!t || t.valuta !== VALUTA_PORTAFOGLIO || scadutoOggi(t) || !(a.prezzoCarico > 0) || !(a.nominale > 0)) return;
    const s = somme.get(a.isin) || { t: t, nominale: 0, costo: 0 };
    s.nominale += a.nominale;
    s.costo += a.nominale * a.prezzoCarico / 100;
    somme.set(a.isin, s);
  });
  const risultato = new Map();
  somme.forEach((s, isin) => {
    const prezzo = prezzoFinale(s.t);
    if (!(prezzo > 0)) return;
    let differenza = s.nominale * prezzo / 100 - s.costo;
    if (Math.abs(differenza) <= 0.005) differenza = 0;
    const tasse = differenza > 0 ? differenza * aliquota(s.t) / 100 : 0;
    risultato.set(isin, { differenza: differenza, tasse: tasse, netto: differenza - tasse });
  });
  return risultato;
}

// gruppi = [acquisti di un portafoglio, acquisti di un altro, ...]. Il conto si fa dentro ogni portafoglio
// (ognuno con il suo prezzo di carico) e poi si somma: un guadagno in uno non cancella la minusvalenza di un altro.
// Restituisce isin -> { netto (guadagni al netto delle tasse), minus (minusvalenze, numero positivo) }
export function guadagniPerTitolo(gruppi, titoli, prezzoFinale) {
  const somme = new Map();
  gruppi.forEach(acquisti => capitalGainPerTitolo(acquisti, titoli, prezzoFinale).forEach((v, isin) => {
    const s = somme.get(isin) || { netto: 0, minus: 0 };
    if (v.differenza > 0) s.netto += v.netto; else s.minus -= v.differenza;
    somme.set(isin, s);
  }));
  return somme;
}

// Totali di uno o più portafogli
export function capitalGain(gruppi, titoli, prezzoFinale) {
  const r = { titoli: 0, guadagni: 0, tasse: 0, netto: 0, minus: 0, titoliInPerdita: 0 };
  const inPerdita = new Set();
  gruppi.forEach(acquisti => capitalGainPerTitolo(acquisti, titoli, prezzoFinale).forEach((v, isin) => {
    r.titoli += 1;
    if (v.differenza > 0) {
      r.guadagni += v.differenza;
      r.tasse += v.tasse;
    } else if (v.differenza < 0) {
      r.minus += -v.differenza;
      inPerdita.add(isin);
    }
  }));
  r.titoliInPerdita = inPerdita.size;
  r.netto = r.guadagni - r.tasse;
  return r;
}

const RIQUADRI = {
  scadenza: { id: 'cg-scadenza', nome: 'Capital gain netto a scadenza (stima)', prezzo: () => 100 },
  oggi: { id: 'cg-oggi', nome: 'Plusvalenza netta se vendi oggi (stima)', prezzo: t => t.prezzo }
};

// Una singola scheda: q = 'scadenza' oppure 'oggi'
export function htmlSchedaGain(q) {
  return `<div class="card"><div class="testo-soft">${RIQUADRI[q].nome}</div>
      <div class="valore" id="${RIQUADRI[q].id}"></div>
      <div class="testo-soft" id="${RIQUADRI[q].id}-nota"></div>
      <div class="testo-soft" id="${RIQUADRI[q].id}-minus"></div></div>`;
}

// quali = elenco delle schede da mostrare; base = da quale prezzo di acquisto si parte
export function htmlCapitalGain(quali, base) {
  return `<div class="riepilogo-blocco">
      <div class="riepilogo riepilogo-gain">${quali.map(htmlSchedaGain).join('')}</div>
      <div class="testo-soft nota-gain">Calcolato dal ${base}, titolo per titolo, con aliquota 12,5% o 26%. Non comprende cedole, disaggio di emissione, rateo e zainetto fiscale.</div>
    </div>`;
}

export function aggiornaCapitalGain(quali, gruppi, titoli) {
  quali.forEach(q => {
    const riquadro = RIQUADRI[q];
    const valore = document.getElementById(riquadro.id);
    if (!valore) return;
    const r = capitalGain(gruppi, titoli, riquadro.prezzo);
    valore.textContent = r.titoli === 0 ? '—' : fmtNum(r.netto) + ' €';
    document.getElementById(riquadro.id + '-nota').textContent = r.titoli === 0 ? ''
      : r.guadagni > 0 ? 'guadagni ' + fmtNum(r.guadagni) + ' € − tasse ' + fmtNum(r.tasse) + ' €' : 'nessun titolo in guadagno';
    document.getElementById(riquadro.id + '-minus').textContent = r.titoliInPerdita === 0 ? ''
      : 'Minusvalenze a parte, non sottratte: ' + fmtNum(r.minus) + ' € (' + (r.titoliInPerdita === 1 ? '1 titolo' : r.titoliInPerdita + ' titoli') + ')';
  });
}
