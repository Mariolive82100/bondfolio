// Costruzione automatica della bozza dato il capitale (nessun accesso alla pagina: solo calcoli).
// Regola semplice e trasparente, non un'ottimizzazione matematica:
// 1. si tengono i titoli in euro con rendimento netto positivo e un lotto che costa al massimo capitale/N
// 2. si ordinano per il criterio scelto (rendimento netto oppure rendimento efficiente)
// 3. si prendono i primi N rispettando il limite di titoli per emittente
// 4. si decide il peso di ciascuno (uguale oppure proporzionale al rendimento)
// 5. si compra un lotto alla volta, sempre dal titolo più lontano dal suo obiettivo,
//    finché il capitale lo consente. Quello che avanza è la liquidità residua.

import { efficienza } from './preset.js';
import { VALUTA_PORTAFOGLIO } from './portafoglio-calcoli.js';

export const IMPOSTAZIONI_INIZIALI = {
  capitale: null,        // euro disponibili
  numero: 10,            // quanti titoli
  maxEmittente: 20,      // peso massimo per emittente (%)
  scelta: 'rendimento',  // 'rendimento' oppure 'efficiente'
  pesi: 'uguali',        // 'uguali' oppure 'rendimento'
  flusso: 'normale'      // 'normale' oppure 'regolare' (cedole mensili il più possibile simili)
};

const lotto = t => t.lottoMinimo || 1000;
const costoLotto = t => lotto(t) * t.prezzo / 100;
const chiaveEmittente = t => t.emittenteCodice || t.emittente;

export function costruisci(lista, imp) {
  const N = Math.max(1, Math.floor(imp.numero));
  const capitale = imp.capitale;
  const quota = capitale / N;
  const punteggio = t => (imp.scelta === 'efficiente' ? efficienza(t) : t.rendNetto);

  const candidati = lista
    .filter(t => t.valuta === VALUTA_PORTAFOGLIO && t.prezzo > 0 && t.rendNetto > 0 &&
                 punteggio(t) !== null && costoLotto(t) <= quota)
    .sort((a, b) => punteggio(b) - punteggio(a));

  // Scelta dei titoli, con limite per emittente
  const maxPerEmittente = Math.max(1, Math.floor(N * imp.maxEmittente / 100));
  const scelti = imp.flusso === 'regolare'
    ? scegliRegolare(candidati, N, maxPerEmittente, quota)
    : scegliPerPunteggio(candidati, N, maxPerEmittente);

  if (scelti.length === 0) {
    return { bozza: [], impiegato: 0, residuo: capitale, trovati: 0, richiesti: N, pesoMaxEmittente: 0, candidati: 0, mensili: new Array(12).fill(0) };
  }

  // Pesi obiettivo
  const somma = scelti.reduce((s, t) => s + t.rendNetto, 0);
  const pesi = scelti.map(t => (imp.pesi === 'rendimento' ? t.rendNetto / somma : 1 / scelti.length));

  // Parto da un lotto per titolo (il costo di ciascuno è <= capitale/N, quindi ci stanno tutti)
  const lotti = scelti.map(() => 1);
  let residuo = capitale - scelti.reduce((s, t) => s + costoLotto(t), 0);
  const valore = i => lotti[i] * costoLotto(scelti[i]);

  // Compro un lotto alla volta dal titolo più sotto il suo obiettivo
  for (let passi = 0; passi < 1000000; passi++) {
    let migliore = -1, deficitMax = 0;
    for (let i = 0; i < scelti.length; i++) {
      if (costoLotto(scelti[i]) > residuo) continue;
      const deficit = pesi[i] * capitale - valore(i);
      if (deficit > deficitMax) { deficitMax = deficit; migliore = i; }
    }
    if (migliore === -1) break;
    lotti[migliore] += 1;
    residuo -= costoLotto(scelti[migliore]);
  }

  const impiegato = capitale - residuo;
  const perEmittente = new Map();
  scelti.forEach((t, i) => perEmittente.set(chiaveEmittente(t), (perEmittente.get(chiaveEmittente(t)) || 0) + valore(i)));
  const pesoMaxEmittente = Math.max(...perEmittente.values()) / impiegato * 100;

  const bozza = scelti.map((t, i) => ({ isin: t.isin, nominale: lotti[i] * lotto(t) }));

  return {
    bozza: bozza,
    impiegato: impiegato,
    residuo: residuo,
    trovati: scelti.length,
    richiesti: N,
    pesoMaxEmittente: pesoMaxEmittente,
    candidati: candidati.length,
    mensili: cedoleMensili(bozza, new Map(scelti.map(t => [t.isin, t])))
  };
}

/* ---------- Scelta dei titoli ---------- */

function scegliPerPunteggio(candidati, N, maxPerEmittente) {
  const conta = new Map();
  const scelti = [];
  for (const t of candidati) {
    if (scelti.length >= N) break;
    const k = chiaveEmittente(t);
    if ((conta.get(k) || 0) >= maxPerEmittente) continue;
    conta.set(k, (conta.get(k) || 0) + 1);
    scelti.push(t);
  }
  return scelti;
}

// Cedole lorde incassate in ciascun mese (12 numeri, gennaio..dicembre) per una lista di posizioni
export function cedoleMensili(bozza, perIsin) {
  const mesi = new Array(12).fill(0);
  bozza.forEach(b => {
    const t = perIsin.get(b.isin);
    if (!t || !t.mesiCedola || t.mesiCedola.length === 0) return;
    const perCedola = b.nominale * (t.cedola || 0) / 100 / t.mesiCedola.length;
    t.mesiCedola.forEach(m => { mesi[m - 1] += perCedola; });
  });
  return mesi;
}

// Scarto relativo tra i mesi: 0 = tutti i mesi uguali
function irregolarita(mesi) {
  const media = mesi.reduce((s, x) => s + x, 0) / 12;
  if (media === 0) return Infinity;
  const varianza = mesi.reduce((s, x) => s + (x - media) * (x - media), 0) / 12;
  return Math.sqrt(varianza) / media;
}

// Sceglie, tra i titoli meglio piazzati, quelli che messi insieme rendono più uniformi
// le cedole dei 12 mesi (si assume lo stesso importo su ogni titolo).
function scegliRegolare(candidati, N, maxPerEmittente, quota) {
  const pool = candidati
    .filter(t => t.mesiCedola && t.mesiCedola.length > 0 && t.cedola > 0)
    .slice(0, Math.max(5 * N, 50));
  const somma = new Array(12).fill(0);
  const conta = new Map();
  const scelti = [];

  while (scelti.length < N) {
    let migliore = null, migliorValore = Infinity;
    for (const t of pool) {
      if (scelti.includes(t)) continue;
      if ((conta.get(chiaveEmittente(t)) || 0) >= maxPerEmittente) continue;
      const prova = somma.slice();
      const perCedola = quota * t.cedola / t.prezzo / t.mesiCedola.length;
      t.mesiCedola.forEach(m => { prova[m - 1] += perCedola; });
      const valore = irregolarita(prova);
      // a parità di regolarità vince il titolo meglio piazzato (viene prima nella lista)
      if (valore < migliorValore - 1e-9) { migliorValore = valore; migliore = t; }
    }
    if (!migliore) break;
    scelti.push(migliore);
    const k = chiaveEmittente(migliore);
    conta.set(k, (conta.get(k) || 0) + 1);
    const perCedola = quota * migliore.cedola / migliore.prezzo / migliore.mesiCedola.length;
    migliore.mesiCedola.forEach(m => { somma[m - 1] += perCedola; });
  }
  return scelti;
}
