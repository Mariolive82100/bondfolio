// Calcoli sul portafoglio (nessuna grafica): usati dalla schermata Portafoglio
// e, più avanti, dalla schermata Analisi.

import { cedolaNetta, tipoEmittente } from './filtri.js';
import { ordinaleTitolo } from './rating.js';

// Il portafoglio accetta solo titoli in questa valuta
export const VALUTA_PORTAFOGLIO = 'EUR';

// Unisce la bozza [{ isin, nominale }] con i dati del file.
// Un titolo è "valido" se è nel file ed è in euro: solo quelli entrano nei calcoli.
export function risolviPosizioni(bozza, titoli) {
  const perIsin = new Map(titoli.map(t => [t.isin, t]));
  return bozza.map(b => {
    const titolo = perIsin.get(b.isin) || null;
    let motivo = '';
    if (!titolo) motivo = 'Non presente nel file';
    else if (titolo.valuta !== VALUTA_PORTAFOGLIO) motivo = 'Valuta non EUR';
    const valida = motivo === '';
    return {
      isin: b.isin,
      nominale: b.nominale,
      titolo: titolo,
      valida: valida,
      motivo: motivo,
      cedolaAnnua: valida ? b.nominale * (titolo.cedola || 0) / 100 : 0,
      cedolaAnnuaNetta: valida ? b.nominale * (cedolaNetta(titolo) || 0) / 100 : 0,
      // quanto costa comprarlo: nominale x prezzo / 100 (il prezzo è per 100 di nominale)
      controvalore: valida ? b.nominale * (titolo.prezzo || 0) / 100 : 0
    };
  });
}

// Media ponderata per controvalore (nominale x prezzo / 100) di un campo del titolo (es. 'rendNetto'); ignora i titoli senza quel dato
function mediaPonderata(posizioni, campo) {
  let somma = 0, pesi = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    const v = p.titolo[campo];
    if (v === null || v === undefined) return;
    somma += v * p.controvalore;
    pesi += p.controvalore;
  });
  return pesi > 0 ? somma / pesi : null;
}

export function calcolaTotali(posizioni) {
  let nominale = 0, cedoleAnnue = 0, cedoleNette = 0, numero = 0, controvalore = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    nominale += p.nominale;
    cedoleAnnue += p.cedolaAnnua;
    cedoleNette += p.cedolaAnnuaNetta;
    controvalore += p.controvalore;
    numero += 1;
  });
  return {
    rendLordo: mediaPonderata(posizioni, 'rendLordo'),
    rendNetto: mediaPonderata(posizioni, 'rendNetto'),
    duration: mediaPonderata(posizioni, 'durationLorda'),
    nominale: nominale, cedoleAnnue: cedoleAnnue, cedoleNette: cedoleNette, controvalore: controvalore, numero: numero, escluse: posizioni.length - numero };
}

// Altri indicatori del riepilogo. dataRif = data di riferimento del file ("aaaa-mm-gg"), se manca si usa oggi.
// - scadenzaAnni, cedolaNetta, ratingOrdinale: medie ponderate per controvalore
// - quote: peso sul nominale di governativi, sovranazionali, societari (in %)
// - ratingConteggio: quanti titoli hanno un rating (gli altri non entrano nella media)
export function calcolaIndicatori(posizioni, dataRif) {
  const riferimento = dataRif ? new Date(dataRif + 'T00:00:00') : new Date();
  let sScad = 0, pScad = 0, sCed = 0, pCed = 0, sRat = 0, pRat = 0, nRat = 0, nominale = 0, validi = 0;
  const perTipo = { gov: 0, sov: 0, corp: 0 };

  posizioni.forEach(p => {
    if (!p.valida) return;
    const t = p.titolo;
    validi += 1;
    nominale += p.nominale;
    perTipo[tipoEmittente(t)] += p.nominale;

    if (t.scadenza) {
      const anni = (new Date(t.scadenza + 'T00:00:00') - riferimento) / (365.25 * 24 * 3600 * 1000);
      sScad += anni * p.controvalore;
      pScad += p.controvalore;
    }
    sCed += (cedolaNetta(t) || 0) * p.controvalore;
    pCed += p.controvalore;

    const r = ordinaleTitolo(t);
    if (r !== null) { sRat += r * p.controvalore; pRat += p.controvalore; nRat += 1; }
  });

  const pct = x => (nominale > 0 ? x / nominale * 100 : null);
  return {
    scadenzaAnni: pScad > 0 ? sScad / pScad : null,
    cedolaNetta: pCed > 0 ? sCed / pCed : null,
    ratingOrdinale: pRat > 0 ? sRat / pRat : null,
    ratingConteggio: nRat,
    titoliValidi: validi,
    quote: { gov: pct(perTipo.gov), sov: pct(perTipo.sov), corp: pct(perTipo.corp) }
  };
}

// Peso percentuale sul nominale totale dei titoli validi
export function peso(posizione, totali) {
  if (!posizione.valida || totali.nominale === 0) return null;
  return posizione.nominale / totali.nominale * 100;
}

// Taglio minimo del titolo (se manca nel file si assume 1.000)
export function lottoMinimo(titolo) {
  return (titolo && titolo.lottoMinimo) || 1000;
}

// Nominale necessario per incassare almeno la cedola annua netta desiderata (in euro).
// Si arrotonda per eccesso a un multiplo del taglio minimo, e non scende mai sotto il taglio minimo.
// Se il titolo non ha cedola restituisce null.
export function nominaleDaCedolaNetta(titolo, cedolaDesiderata) {
  const tasso = (cedolaNetta(titolo) || 0) / 100;
  if (!(tasso > 0) || !(cedolaDesiderata > 0)) return null;
  const lotto = lottoMinimo(titolo);
  const lotti = Math.max(1, Math.ceil(cedolaDesiderata / tasso / lotto - 1e-9));
  return lotti * lotto;
}

/* ---------- Dati per i grafici ---------- */

// Nominale per anno di scadenza, con anche gli anni intermedi a zero: [{ anno, nominale }]
export function scalettaScadenze(posizioni) {
  const perAnno = new Map();
  posizioni.forEach(p => {
    if (!p.valida || !p.titolo.scadenza) return;
    const anno = Number(p.titolo.scadenza.slice(0, 4));
    perAnno.set(anno, (perAnno.get(anno) || 0) + p.nominale);
  });
  if (perAnno.size === 0) return [];
  const anni = Array.from(perAnno.keys());
  const primo = Math.min(...anni), ultimo = Math.max(...anni);
  const lista = [];
  for (let a = primo; a <= ultimo; a++) lista.push({ anno: a, nominale: perAnno.get(a) || 0 });
  return lista;
}

// Raggruppa i titoli validi per una chiave (es. emittente) e calcola il peso sul nominale di ciascun gruppo,
// dal più pesante; oltre i primi 'massimo' il resto va in "Altri". Restituisce [{ nome, nominale, pct, altri }]
function distribuzione(posizioni, chiave, massimo) {
  const gruppi = new Map();
  let totale = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    const nome = chiave(p);
    gruppi.set(nome, (gruppi.get(nome) || 0) + p.nominale);
    totale += p.nominale;
  });
  if (totale === 0) return [];
  const ordinati = Array.from(gruppi, ([nome, nominale]) => ({ nome: nome, nominale: nominale }))
    .sort((a, b) => b.nominale - a.nominale);
  let lista = ordinati;
  if (ordinati.length > massimo) {
    const resto = ordinati.slice(massimo).reduce((s, x) => s + x.nominale, 0);
    lista = ordinati.slice(0, massimo).concat([{ nome: 'Altri (' + (ordinati.length - massimo) + ')', nominale: resto, altri: true }]);
  }
  return lista.map(x => Object.assign({ pct: x.nominale / totale * 100 }, x));
}

export function pesoPerEmittente(posizioni, massimo = 6) {
  return distribuzione(posizioni, p => p.titolo.emittente || p.titolo.emittenteCodice || p.isin, massimo);
}

export function pesoPerTitolo(posizioni, massimo = 6) {
  return distribuzione(posizioni, p => p.titolo.nome || p.isin, massimo);
}

const NOMI_TIPO = { gov: 'Governativi', sov: 'Sovranazionali', corp: 'Societari' };
export function pesoPerTipo(posizioni) {
  return distribuzione(posizioni, p => NOMI_TIPO[tipoEmittente(p.titolo)], 10);
}

// Peso per fascia di rating (S&P, o Moody's se manca), dalla migliore alla peggiore. Zero titoli in una fascia = fascia omessa.
const FASCE_RATING = [
  { nome: 'AAA', da: 1, a: 1 }, { nome: 'AA', da: 2, a: 4 }, { nome: 'A', da: 5, a: 7 },
  { nome: 'BBB', da: 8, a: 10 }, { nome: 'BB e inferiori', da: 11, a: 99 }
];
export function pesoPerRating(posizioni) {
  const somme = new Array(FASCE_RATING.length + 1).fill(0);
  let totale = 0;
  posizioni.forEach(p => {
    if (!p.valida) return;
    const r = ordinaleTitolo(p.titolo);
    const i = r === null ? FASCE_RATING.length : FASCE_RATING.findIndex(f => r >= f.da && r <= f.a);
    somme[i] += p.nominale;
    totale += p.nominale;
  });
  if (totale === 0) return [];
  const lista = FASCE_RATING.map((f, i) => ({ nome: f.nome, nominale: somme[i] }));
  lista.push({ nome: 'Senza rating', nominale: somme[FASCE_RATING.length], altri: true });
  return lista.filter(x => x.nominale > 0).map(x => Object.assign({ pct: x.nominale / totale * 100 }, x));
}

// Cedole nette incassate in ciascun mese (12 numeri, gennaio..dicembre).
// Il netto di ogni titolo si divide in parti uguali sui suoi mesi di pagamento.
// nonCollocati = titoli con cedola ma senza mesi di pagamento nel file.
export function incassiMensili(posizioni) {
  const mesi = new Array(12).fill(0);
  let nonCollocati = 0;
  posizioni.forEach(p => {
    if (!p.valida || !(p.cedolaAnnuaNetta > 0)) return;
    const m = p.titolo.mesiCedola || [];
    if (m.length === 0) { nonCollocati += 1; return; }
    m.forEach(mese => { mesi[mese - 1] += p.cedolaAnnuaNetta / m.length; });
  });
  return { mesi: mesi, nonCollocati: nonCollocati };
}
