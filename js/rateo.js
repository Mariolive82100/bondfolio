// Rateo di cedola maturata (interessi dall'ultimo stacco fino al regolamento) e data di regolamento.
// Il rateo è lordo: alla cedola successiva la ritenuta si applica solo al periodo in cui hai detenuto il titolo.
// Convenzione usata: giorni effettivi sul periodo cedolare (ACT/ACT). È una stima: si ricava dai mesi di pagamento del file
// e dal giorno della scadenza, quindi può sbagliare per cedole a gradini, variabili, legate all'inflazione o con periodi irregolari.
// Per questo nella conferma d'acquisto il rateo si può correggire con quello della lettera di conferma.

const GIORNO = 86400000;

function data(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function iso(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

// Data di regolamento: 2 giorni lavorativi dopo l'acquisto (si saltano sabato e domenica, non le festività). Data non valida -> null
export function dataRegolamento(dataAcquisto) {
  let ms = data(dataAcquisto);
  if (ms === null) return null;
  let giorni = 0;
  while (giorni < 2) {
    ms += GIORNO;
    const g = new Date(ms).getUTCDay();
    if (g !== 0 && g !== 6) giorni += 1;
  }
  return iso(ms);
}

const SOSPETTI = /STEP|FLOAT|FRN|INFLAZ|INFLATION|CALLABLE|VALORE|CUMULATIVE/i;

// Rateo per 100 di nominale (lordo) alla data di regolamento.
// Restituisce { per100, giorni, periodo, stima, nota } oppure null se non calcolabile (data non valida o titolo scaduto).
// stima = true quando il risultato è dubbio (nota dice perché).
export function calcolaRateo(titolo, dataReg) {
  const reg = data(dataReg);
  const scadenza = titolo && data(titolo.scadenza);
  if (reg === null || scadenza === null || reg >= scadenza) return null;

  const cedola = titolo.cedola || 0;
  if (!(cedola > 0)) return { per100: 0, giorni: 0, periodo: 0, stima: false, nota: 'Titolo senza cedola' };

  const mesi = (titolo.mesiCedola || []).slice().sort((a, b) => a - b);
  if (mesi.length === 0) {
    return { per100: 0, giorni: 0, periodo: 0, stima: true, nota: 'Mesi di pagamento non presenti nel file: rateo non calcolato, scrivilo a mano' };
  }

  // Date di stacco: giorno della scadenza, nei mesi di pagamento, dall'anno prima all'anno dopo
  const giornoScadenza = Number(titolo.scadenza.slice(8, 10));
  const annoReg = new Date(reg).getUTCFullYear();
  const stacchi = [];
  for (let anno = annoReg - 1; anno <= annoReg + 1; anno++) {
    mesi.forEach(m => {
      const ultimoDelMese = new Date(Date.UTC(anno, m, 0)).getUTCDate();
      const ms = Date.UTC(anno, m - 1, Math.min(giornoScadenza, ultimoDelMese));
      if (ms <= scadenza) stacchi.push(ms);
    });
  }
  const precedenti = stacchi.filter(ms => ms <= reg);
  const successivi = stacchi.filter(ms => ms > reg);
  if (precedenti.length === 0 || successivi.length === 0) return null;
  const ultimo = Math.max(...precedenti), prossimo = Math.min(...successivi);

  const giorni = Math.round((reg - ultimo) / GIORNO);
  const periodo = Math.round((prossimo - ultimo) / GIORNO);
  const per100 = cedola / mesi.length * giorni / periodo;

  // Segnali di stima dubbia
  let nota = '';
  const passo = 12 / mesi.length;
  const regolari = mesi.every((m, i) => i === 0 || m - mesi[i - 1] === passo) && (mesi.length === 1 || 12 - mesi[mesi.length - 1] + mesi[0] === passo);
  if (!regolari) nota = 'Pagamenti non a intervalli regolari';
  else if (SOSPETTI.test(titolo.nome || '')) nota = 'Titolo con cedola particolare (a gradini, variabile, callable o legata all\'inflazione)';
  return { per100: per100, giorni: giorni, periodo: periodo, stima: nota !== '', nota: nota };
}
