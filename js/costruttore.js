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
  pesi: 'uguali'         // 'uguali' oppure 'rendimento'
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
  const conta = new Map();
  const scelti = [];
  for (const t of candidati) {
    if (scelti.length >= N) break;
    const k = chiaveEmittente(t);
    if ((conta.get(k) || 0) >= maxPerEmittente) continue;
    conta.set(k, (conta.get(k) || 0) + 1);
    scelti.push(t);
  }

  if (scelti.length === 0) {
    return { bozza: [], impiegato: 0, residuo: capitale, trovati: 0, richiesti: N, pesoMaxEmittente: 0, candidati: 0 };
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

  return {
    bozza: scelti.map((t, i) => ({ isin: t.isin, nominale: lotti[i] * lotto(t) })),
    impiegato: impiegato,
    residuo: residuo,
    trovati: scelti.length,
    richiesti: N,
    pesoMaxEmittente: pesoMaxEmittente,
    candidati: candidati.length
  };
}
