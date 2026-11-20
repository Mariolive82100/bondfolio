// Data usata per tutto ciò che dipende dal calendario (flussi di cassa, scadenza media, titoli scaduti, duration che si accorcia).
// Prezzi e rendimenti restano quelli del file caricato; il calendario segue la data di oggi.
// Se la data di riferimento del file è futura (orologio del computer indietro) si usa quella del file.

import { stato } from './state.js';
import { oggiIso } from './formati.js';

const MS_GIORNO = 24 * 3600 * 1000;
const giorniTra = (da, a) => Math.round((new Date(a + 'T00:00:00') - new Date(da + 'T00:00:00')) / MS_GIORNO);

export const dataFile = () => (stato.meta && stato.meta.dataRiferimento) || null;

// Data di calcolo "aaaa-mm-gg": la più recente tra oggi e la data del file
export function dataCalcolo() {
  const f = dataFile(), oggi = oggiIso();
  return f && f > oggi ? f : oggi;
}

// Giorni passati dalla data del file a oggi (0 se il file è di oggi o non ha data)
export function giorniFileVecchio() {
  const f = dataFile();
  return f ? Math.max(0, giorniTra(f, oggiIso())) : 0;
}

// Anni passati dalla data del file alla data di calcolo (servono per accorciare la duration)
export function anniTrascorsi() {
  const f = dataFile();
  return f ? Math.max(0, giorniTra(f, dataCalcolo()) / 365.25) : 0;
}

// Il titolo è già scaduto alla data di calcolo?
export const scadutoOggi = t => !!(t && t.scadenza && t.scadenza <= dataCalcolo());
