// Calendario degli incassi del portafoglio costruito con i dati esatti del file cashflow.csv.
// Gli importi del file sono per 10.000 € di nominale: qui si riproporzionano al nominale scelto per ogni titolo.

import { NOMINALE_BASE } from './cashflow-dati.js';

// posizioni = risultato di risolviPosizioni; eventi = Map isin -> eventi per 10.000 € (da eventiPerIsin)
// Restituisce:
//  - righe: tutti gli eventi in ordine di data [{ data, isin, nome, tipo, voce, importo }] (importi in €, già riproporzionati)
//  - perAnno: [{ anno, cedole, rimborsi }]  cedole = cedole nette (lorda meno tassa sulla cedola);
//             rimborsi = nominale rimborsato meno tasse sul capital gain e sul disaggio
//  - perMese: [{ anno, mese, cedole }]  cedole nette di ogni mese, dal primo all'ultimo mese con eventi
//  - titoliSenzaDati: quanti titoli validi non hanno eventi nel file (per quelli serve la stima)
export function costruisciCalendario(posizioni, eventi) {
  const righe = [];
  let titoliSenzaDati = 0;

  posizioni.forEach(p => {
    if (!p.valida) return;
    const lista = eventi.get(p.isin);
    if (!lista || lista.length === 0) { titoliSenzaDati += 1; return; }
    const fattore = p.nominale / NOMINALE_BASE;
    lista.forEach(e => {
      righe.push({
        data: e.data, isin: p.isin, nome: p.titolo.nome,
        tipo: e.tipo, voce: e.voce, importo: e.importo * fattore
      });
    });
  });

  righe.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.nome < b.nome ? -1 : 1)));

  const anni = new Map(), mesi = new Map();
  righe.forEach(r => {
    const anno = Number(r.data.slice(0, 4)), mese = Number(r.data.slice(5, 7));
    // cedola e relativa tassa sono "cedole nette"; rimborso e altre tasse (capital gain, disaggio) sono "rimborsi"
    const eCedola = r.tipo === 'cedola' || r.voce === 'Tassazione cedola';
    const a = anni.get(anno) || { anno: anno, cedole: 0, rimborsi: 0 };
    if (eCedola) a.cedole += r.importo; else a.rimborsi += r.importo;
    anni.set(anno, a);
    if (eCedola) {
      const chiave = anno * 100 + mese;
      const m = mesi.get(chiave) || { anno: anno, mese: mese, cedole: 0 };
      m.cedole += r.importo;
      mesi.set(chiave, m);
    }
  });

  // anni senza eventi in mezzo: riempiti a zero, come nel grafico attuale
  const perAnno = [];
  if (anni.size > 0) {
    const elenco = Array.from(anni.keys());
    for (let a = Math.min(...elenco); a <= Math.max(...elenco); a++) perAnno.push(anni.get(a) || { anno: a, cedole: 0, rimborsi: 0 });
  }
  const perMese = Array.from(mesi.keys()).sort((x, y) => x - y).map(k => mesi.get(k));

  return { righe: righe, perAnno: perAnno, perMese: perMese, titoliSenzaDati: titoliSenzaDati };
}

// I 12 mesi di calendario a partire dal mese della data indicata ("aaaa-mm-gg"):
// [{ anno, mese, cedole }] sempre 12 voci, con zero dove non ci sono cedole
export function prossimiDodiciMesi(calendario, dataInizio) {
  let anno = Number(dataInizio.slice(0, 4)), mese = Number(dataInizio.slice(5, 7));
  const perChiave = new Map(calendario.perMese.map(m => [m.anno * 100 + m.mese, m.cedole]));
  const lista = [];
  for (let i = 0; i < 12; i++) {
    lista.push({ anno: anno, mese: mese, cedole: perChiave.get(anno * 100 + mese) || 0 });
    mese += 1;
    if (mese > 12) { mese = 1; anno += 1; }
  }
  return lista;
}
