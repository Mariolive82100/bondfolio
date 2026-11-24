// Scarica in automatico il file dei titoli preparato ogni giorno da GitHub (cartella data/)

import { leggiCsv } from './csv-loader.js';

export async function scaricaDatiAutomatici() {
  const risposta = await fetch('data/eod.csv', { cache: 'no-cache' });
  if (!risposta.ok) {
    throw new Error('file dati non raggiungibile (errore ' + risposta.status + ').');
  }
  const testo = await risposta.text();
  const risultato = leggiCsv(testo, 'eod.csv (aggiornamento automatico)');

  let aggiornatoIl = null;
  try {
    const info = await fetch('data/info.json', { cache: 'no-cache' });
    if (info.ok) aggiornatoIl = (await info.json()).aggiornato;
  } catch (e) { /* non è essenziale */ }

  risultato.meta.automatico = true;
  risultato.meta.aggiornatoIl = aggiornatoIl;
  return risultato;
}
