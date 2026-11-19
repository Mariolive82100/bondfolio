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
  mesi: [],              // mesi di incasso scelti (1 = gennaio ... 12); vuoto = indifferente
  importi: 'qualsiasi'   // 'qualsiasi' oppure 'regolari' (cedole simili tra i mesi di incasso)
};

export const NOMI_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const TUTTI_I_MESI = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const lotto = t => t.lottoMinimo || 1000;
const costoLotto = t => lotto(t) * t.prezzo / 100;
const chiaveEmittente = t => t.emittenteCodice || t.emittente;

export function costruisci(lista, imp) {
  const N = Math.max(1, Math.floor(imp.numero));
  const capitale = imp.capitale;
  const quota = capitale / N;
  const punteggio = t => (imp.scelta === 'efficiente' ? efficienza(t) : t.rendNetto);

  // Mesi di incasso scelti: restano solo i titoli che pagano cedole soltanto in quei mesi
  const target = (imp.mesi && imp.mesi.length) ? imp.mesi : null;
  const candidati = lista
    .filter(t => t.valuta === VALUTA_PORTAFOGLIO && t.prezzo > 0 && t.rendNetto > 0 &&
                 punteggio(t) !== null && costoLotto(t) <= quota)
    .filter(t => !target || (t.mesiCedola && t.mesiCedola.length > 0 && t.mesiCedola.every(m => target.includes(m))))
    .sort((a, b) => punteggio(b) - punteggio(a));

  // Scelta dei titoli, con limite per emittente
  const maxPerEmittente = Math.max(1, Math.floor(N * imp.maxEmittente / 100));
  const regolari = imp.importi === 'regolari';
  const scelti = (target || regolari)
    ? scegliPerMesi(candidati, N, maxPerEmittente, quota, target || TUTTI_I_MESI, regolari)
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

// Scarto relativo tra gli importi dei mesi indicati: 0 = tutti uguali, un mese senza cedole pesa molto
function irregolarita(mesi, target) {
  const valori = target.map(m => mesi[m - 1]);
  const media = valori.reduce((s, x) => s + x, 0) / valori.length;
  if (media === 0) return Infinity;
  const varianza = valori.reduce((s, x) => s + (x - media) * (x - media), 0) / valori.length;
  return Math.sqrt(varianza) / media;
}

// Sceglie i titoli in base ai mesi in cui pagano le cedole (si assume lo stesso importo su ogni titolo):
// - importi "qualsiasi": prima si coprono i mesi di incasso, poi si prendono i titoli meglio piazzati
// - importi "regolari": si sceglie ogni volta il titolo che rende più uniformi i mesi di incasso
function scegliPerMesi(candidati, N, maxPerEmittente, quota, target, regolari) {
  const valide = candidati.filter(t => t.mesiCedola && t.mesiCedola.length > 0 && t.cedola > 0);
  const pool = regolari ? valide.slice(0, Math.max(8 * N, 80)) : valide;
  const somma = new Array(12).fill(0);
  const coperti = new Set();
  const conta = new Map();
  const scelti = [];

  while (scelti.length < N) {
    let migliore = null, migliorValore = Infinity;
    for (const t of pool) {
      if (scelti.includes(t)) continue;
      if ((conta.get(chiaveEmittente(t)) || 0) >= maxPerEmittente) continue;

      let valore;
      if (regolari) {
        const prova = somma.slice();
        const perCedola = quota * t.cedola / t.prezzo / t.mesiCedola.length;
        t.mesiCedola.forEach(m => { prova[m - 1] += perCedola; });
        valore = irregolarita(prova, target);
      } else {
        valore = -t.mesiCedola.filter(m => target.includes(m) && !coperti.has(m)).length;
      }
      // a parità vince il titolo meglio piazzato (viene prima nella lista)
      if (valore < migliorValore - 1e-9) { migliorValore = valore; migliore = t; }
    }
    if (!migliore) break;
    scelti.push(migliore);
    const k = chiaveEmittente(migliore);
    conta.set(k, (conta.get(k) || 0) + 1);
    const perCedola = quota * migliore.cedola / migliore.prezzo / migliore.mesiCedola.length;
    migliore.mesiCedola.forEach(m => { somma[m - 1] += perCedola; coperti.add(m); });
  }
  return scelti;
}
