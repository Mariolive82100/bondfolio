// Tiene allineati il browser e Firebase per bozza, portafoglio Costruito e relativo cashflow.
// Per capire chi è cambiato, ricorda nel browser il contenuto dell'ultimo allineamento riuscito:
// - è cambiato solo il browser  -> salva online
// - è cambiato solo l'online    -> aggiorna il browser
// - sono cambiati entrambi (o è il primo accesso e sono diversi) -> chiede quale tenere

import { stato, impostaBozza, impostaCostruito } from './state.js';
import { NOMI, impronta, leggiOnline, scriviOnline } from './cloud-portafogli.js';
import { allineaCashflow } from './cloud-cashflow.js';

const CHIAVE = 'bondfolio_sync_v1';
const ATTESA = 3000; // millisecondi dopo l'ultima modifica prima di salvare

const APPLICA = { bozza: impostaBozza, costruito: impostaCostruito };

let uid = null;
let sessione = 0;        // cambia a ogni accesso o uscita: ferma le operazioni iniziate prima
let timer = null;
let inCorso = null;      // allineamento in esecuzione
let conflitto = null;    // dati da mostrare quando bisogna scegliere
let avvisaVista = () => {};
let ultimoStato = { tipo: 'spento' };

function comunica(nuovo) { ultimoStato = nuovo; avvisaVista(nuovo); }

export function ascoltaSincronizzazione(funzione) { avvisaVista = funzione; funzione(ultimoStato); }

function leggiBase() {
  try { return JSON.parse(localStorage.getItem(CHIAVE)) || null; } catch (e) { return null; }
}

function salvaBase(base) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(base)); } catch (e) { /* al prossimo avvio chiederà di scegliere */ }
}

function haModifiche() {
  const base = leggiBase();
  return !base || base.uid !== uid || NOMI.some(n => impronta(n, stato[n]) !== base[n]);
}

// Chiamata quando si entra (con l'identificativo dell'utente) o si esce (null)
export function impostaUtente(nuovoUid) {
  if (nuovoUid === uid) return;
  uid = nuovoUid;
  sessione += 1;
  clearTimeout(timer);
  timer = null;
  inCorso = null;
  conflitto = null;
  if (uid) allinea(); else comunica({ tipo: 'spento' });
}

// scelta: undefined, 'locale' oppure 'online'
export function allinea(scelta) {
  if (!uid) return Promise.resolve();
  clearTimeout(timer);
  timer = null;
  if (inCorso) return inCorso.then(() => allinea(scelta));
  const mia = sessione;
  const lavoro = esegui(mia, scelta).catch(errore => {
    if (mia !== sessione) return;
    const codice = (errore && errore.code) || '';
    comunica({
      tipo: 'errore',
      testo: codice === 'permission-denied'
        ? 'Firebase ha rifiutato l\'accesso: controlla le regole di sicurezza.'
        : codice === 'cashflow-troppo-grande'
          ? 'Portafogli salvati, ma il cashflow è troppo grande per essere salvato online.'
          : 'Sincronizzazione non completata: i dati restano in questo browser.' + (codice ? ' (' + codice + ')' : '')
    });
  }).then(() => {
    if (inCorso === lavoro) inCorso = null;
    // modifiche fatte mentre si salvava
    if (mia === sessione && ultimoStato.tipo === 'salvato' && haModifiche()) programma();
  });
  inCorso = lavoro;
  return lavoro;
}

async function esegui(mia, scelta) {
  const utente = uid;
  comunica({ tipo: 'lavoro' });
  const online = await leggiOnline(utente);
  if (mia !== sessione) return;

  const salvata = leggiBase();
  const base = salvata && salvata.uid === utente ? salvata : { uid: utente };
  const altroAccount = Boolean(salvata && salvata.uid !== utente);

  // Per ogni elenco decide cosa fare: 'uguale', 'carica' (browser -> online), 'scarica', 'scegli'
  const piano = NOMI.map(nome => {
    const locale = impronta(nome, stato[nome]);
    const remoto = online[nome] ? impronta(nome, online[nome].lista) : null;
    const prima = base[nome];
    let azione;
    if (remoto === null) {
      if (locale === '[]') azione = 'uguale';
      else azione = altroAccount ? 'scegli' : 'carica';
    } else if (locale === remoto) azione = 'uguale';
    else if (prima !== undefined && locale === prima) azione = 'scarica';
    else if (prima !== undefined && remoto === prima) azione = 'carica';
    else if (prima === undefined && locale === '[]') azione = 'scarica';
    else azione = 'scegli';
    return { nome: nome, locale: locale, remoto: remoto, azione: azione };
  });

  if (piano.some(p => p.azione === 'scegli')) {
    if (!scelta) {
      conflitto = {
        locale: { bozza: stato.bozza.length, costruito: stato.costruito.length },
        online: {
          bozza: online.bozza ? online.bozza.lista.length : 0,
          costruito: online.costruito ? online.costruito.lista.length : 0,
          aggiornato: NOMI.map(n => online[n] && online[n].aggiornato).filter(Boolean).sort().pop() || null
        }
      };
      comunica({ tipo: 'scelta', conflitto: conflitto });
      return;
    }
    piano.forEach(p => {
      if (p.azione === 'scegli') p.azione = scelta === 'locale' ? 'carica' : 'scarica';
    });
  }
  conflitto = null;

  // Prima gli aggiornamenti del browser (immediati), poi i salvataggi online
  piano.forEach(p => {
    if (p.azione === 'uguale') base[p.nome] = p.locale;
    if (p.azione === 'scarica') base[p.nome] = p.remoto === null ? '[]' : p.remoto;
  });
  const daSalvare = piano.filter(p => p.azione === 'carica').map(p => ({ ...p, lista: stato[p.nome].slice() }));
  salvaBase(base);
  piano.forEach(p => {
    if (p.azione === 'scarica') APPLICA[p.nome](p.remoto === null ? [] : online[p.nome].lista);
  });

  for (const p of daSalvare) {
    const scritto = await scriviOnline(utente, p.nome, p.lista, p.remoto);
    if (mia !== sessione) return;
    if (!scritto) throw new Error('Dati online cambiati durante il salvataggio');
    base[p.nome] = impronta(p.nome, p.lista);
    salvaBase(base);
  }

  // Con i portafogli allineati, aggiorna il cashflow dei loro titoli
  await allineaCashflow(utente, stato.bozza.concat(stato.costruito).map(x => x.isin));
  if (mia !== sessione) return;

  comunica({ tipo: 'salvato', ora: new Date() });
}

function programma() {
  if (!uid || conflitto) return;
  if (!haModifiche()) return;
  clearTimeout(timer);
  comunica({ tipo: 'attesa' });
  timer = setTimeout(() => allinea(), ATTESA);
}

// Prima di uscire salva le modifiche ancora in attesa
export function salvaSubito() {
  if (!uid || conflitto) return Promise.resolve();
  return timer || inCorso ? allinea() : Promise.resolve();
}

['bozza-aggiornata', 'costruito-aggiornato', 'costruito-corretto'].forEach(evento =>
  document.addEventListener(evento, programma));

// Caricato un nuovo file cashflow: aggiorna le voci online
document.addEventListener('cashflow-file-caricato', () => { if (uid && !conflitto) allinea(); });

// Torna la connessione: riprova
window.addEventListener('online', () => { if (ultimoStato.tipo === 'errore') allinea(); });

// Si passa a un'altra scheda con modifiche in attesa: salva subito
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) allinea(); });
