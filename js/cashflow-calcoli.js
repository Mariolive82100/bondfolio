// Calendario degli incassi del portafoglio con i dati esatti del file cashflow.csv (o delle voci salvate online).
// Per i titoli che non hanno dati reali, qui ci sono anche le funzioni che aggiungono la stima.
// Gli importi del file sono per 10.000 € di nominale: qui si riproporzionano al nominale scelto per ogni titolo.

import { NOMINALE_BASE } from './cashflow-dati.js';

// posizioni = risultato di risolviPosizioni; eventi = Map isin -> eventi per 10.000 € (da eventiPerIsin)
// Restituisce:
//  - righe: tutti gli eventi in ordine di data [{ data, isin, nome, tipo, voce, importo }] (importi in €, già riproporzionati)
//  - perAnno: [{ anno, cedole, rimborsi }]  cedole = cedole nette (lorda meno tassa sulla cedola);
//             rimborsi = nominale rimborsato meno tasse sul capital gain e sul disaggio
//  - perMese: [{ anno, mese, cedole }]  cedole nette di ogni mese, dal primo all'ultimo mese con eventi
//  - senzaDati: le posizioni valide che non hanno eventi reali (per quelle serve la stima)
export function costruisciCalendario(posizioni, eventi) {
  const righe = [];
  const senzaDati = [];

  posizioni.forEach(p => {
    if (!p.valida) return;
    const lista = eventi.get(p.isin);
    if (!lista || lista.length === 0) { senzaDati.push(p); return; }
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

  return { righe: righe, perAnno: perAnno, perMese: perMese, senzaDati: senzaDati };
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

// Somma due flussi annui [{ anno, cedole, rimborsi }] (reale e stimato), riempiendo a zero gli anni in mezzo
export function unisciAnni(reali, stimati) {
  const somme = new Map();
  reali.concat(stimati).forEach(x => {
    const a = somme.get(x.anno) || { anno: x.anno, cedole: 0, rimborsi: 0 };
    a.cedole += x.cedole;
    a.rimborsi += x.rimborsi;
    somme.set(x.anno, a);
  });
  if (somme.size === 0) return [];
  const anni = Array.from(somme.keys());
  const lista = [];
  for (let a = Math.min(...anni); a <= Math.max(...anni); a++) lista.push(somme.get(a) || { anno: a, cedole: 0, rimborsi: 0 });
  return lista;
}

// Aggiunge ai 12 mesi (risultato di prossimiDodiciMesi) le cedole nette stimate di alcune posizioni.
// La cedola annua netta si divide sui mesi di pagamento del file, fino al mese di scadenza compreso;
// nel mese di partenza conta solo se il giorno di pagamento (quello della scadenza) deve ancora arrivare.
// nonCollocati = titoli con cedola ma senza mesi di pagamento: non si possono mettere in un mese.
export function aggiungiStimaMensile(dodici, posizioni, dataRif) {
  const mesi = dodici.map(m => ({ ...m }));
  const giornoRif = Number(dataRif.slice(8, 10));
  let nonCollocati = 0;
  posizioni.forEach(p => {
    if (!p.valida || !p.titolo.scadenza || !(p.cedolaAnnuaNetta > 0)) return;
    const pagamenti = p.titolo.mesiCedola || [];
    if (pagamenti.length === 0) { nonCollocati += 1; return; }
    const ultimo = Number(p.titolo.scadenza.slice(0, 4)) * 100 + Number(p.titolo.scadenza.slice(5, 7));
    const giorno = Number(p.titolo.scadenza.slice(8, 10));
    mesi.forEach((m, i) => {
      if (!pagamenti.includes(m.mese) || m.anno * 100 + m.mese > ultimo) return;
      if (i === 0 && giorno <= giornoRif) return;
      m.cedole += p.cedolaAnnuaNetta / pagamenti.length;
    });
  });
  return { mesi: mesi, nonCollocati: nonCollocati };
}
