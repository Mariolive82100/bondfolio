// Tiene allineati il browser e Firebase per tutti i portafogli (bozza e Costruito) e per il relativo cashflow.
// Per capire chi è cambiato, ricorda nel browser il contenuto dell'ultimo allineamento riuscito:
// - è cambiato solo il browser  -> salva online
// - è cambiato solo l'online    -> aggiorna il browser
// - sono cambiati entrambi (o è il primo accesso e sono diversi) -> chiede quale tenere
// La decisione per ogni portafoglio è in sync-piano.js.

import { stato, listaDi, impostaListaDi, cambiaPortafoglio } from './state.js';
import { PRINCIPALE, leggiElenco, nomePortafoglio, tuttiGliIsin, creaPortafoglio, rinominaPortafoglio, eliminaPortafoglio, leggiEliminati, dimenticaEliminato } from './portafogli.js';
import { NOMI, impronta, leggiOnline, scriviOnline } from './cloud-portafogli.js';
import { decidi } from './sync-piano.js';
import { allineaCashflow } from './cloud-cashflow.js';

const CHIAVE = 'bondfolio_sync_v2';
const CHIAVE_VECCHIA = 'bondfolio_sync_v1'; // quando il portafoglio sincronizzato era uno solo
const ATTESA = 3000; // millisecondi dopo l'ultima modifica prima di salvare
const MAX_RIPRESE = 3; // freno: evita che un errore faccia ripetere letture all'infinito

let uid = null;
let sessione = 0;        // cambia a ogni accesso o uscita: ferma le operazioni iniziate prima
let timer = null;
let inCorso = null;      // allineamento in esecuzione
let conflitto = null;    // dati da mostrare quando bisogna scegliere
let scelte = new Map();  // risposte già date: id -> { firma, quale }
let applicando = false;  // true mentre si scrivono nel browser i dati arrivati da online
let riprese = 0;
let avvisaVista = () => {};
let ultimoStato = { tipo: 'spento' };

function comunica(nuovo) { ultimoStato = nuovo; avvisaVista(nuovo); }

export function ascoltaSincronizzazione(funzione) { avvisaVista = funzione; funzione(ultimoStato); }

// { uid, portafogli: { id: { nome, bozza, costruito } } } oppure null
function leggiBase() {
  try {
    const nuova = JSON.parse(localStorage.getItem(CHIAVE));
    if (nuova && nuova.portafogli) return nuova;
    const vecchia = JSON.parse(localStorage.getItem(CHIAVE_VECCHIA));
    if (vecchia && vecchia.uid) {
      return { uid: vecchia.uid, portafogli: { [PRINCIPALE]: { bozza: vecchia.bozza, costruito: vecchia.costruito } } };
    }
  } catch (e) { /* senza base, se i dati sono diversi chiede */ }
  return null;
}

function salvaBase(base) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(base)); } catch (e) { /* al prossimo avvio chiederà di scegliere */ }
}

function haModifiche() {
  const base = leggiBase();
  if (!base || base.uid !== uid || leggiEliminati().length > 0) return true;
  return leggiElenco().elenco.some(p => {
    const b = base.portafogli[p.id];
    return !b || b.nome !== p.nome || NOMI.some(n => impronta(n, listaDi(p.id, n)) !== b[n]);
  });
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
  scelte = new Map();
  riprese = 0;
  if (uid) allinea(); else comunica({ tipo: 'spento' });
}

// scelta: undefined, 'locale' oppure 'online', riferita al portafoglio di cui si sta chiedendo
export function allinea(scelta) {
  if (!uid) return Promise.resolve();
  if (scelta && conflitto) {
    scelte.set(conflitto.id, { firma: conflitto.firma, quale: scelta });
    scelta = undefined;
  }
  clearTimeout(timer);
  timer = null;
  if (inCorso) return inCorso.then(() => allinea());
  const mia = sessione;
  const lavoro = esegui(mia).catch(errore => {
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
    if (mia !== sessione || ultimoStato.tipo !== 'salvato') return;
    if (!haModifiche()) riprese = 0;
    else if (riprese < MAX_RIPRESE) { riprese += 1; programma(); }
  });
  inCorso = lavoro;
  return lavoro;
}

function datiLocali(id) {
  return { nome: nomePortafoglio(id), bozza: listaDi(id, 'bozza').slice(), costruito: listaDi(id, 'costruito').slice() };
}

const conta = d => ({ bozza: d && d.bozza ? d.bozza.length : 0, costruito: d && d.costruito ? d.costruito.length : 0 });

// Una voce per ogni portafoglio presente qui, online o appena eliminato qui
function prepara(online, base) {
  const qui = new Set(leggiElenco().elenco.map(p => p.id));
  const eliminati = new Set(leggiEliminati());
  const tutti = new Set([...qui, ...online.keys(), ...eliminati, ...Object.keys(base.portafogli)]);
  return Array.from(tutti, id => {
    const voce = {
      id: id,
      locale: qui.has(id) ? datiLocali(id) : null,
      remoto: online.get(id) || null,
      base: base.portafogli[id],
      eliminatoQui: eliminati.has(id)
    };
    // la firma cambia se cambiano i dati: una risposta vale solo per quello che era stato mostrato
    voce.firma = JSON.stringify([voce.locale, voce.remoto]);
    const risposta = scelte.get(id);
    voce.scelta = risposta && risposta.firma === voce.firma ? risposta.quale : undefined;
    voce.decisione = decidi(voce);
    return voce;
  });
}

function domanda(voce, quante) {
  return {
    id: voce.id,
    firma: voce.firma,
    tipo: voce.decisione.tipo,
    nome: voce.locale ? voce.locale.nome : voce.remoto.nome || nomePortafoglio(voce.id),
    quante: quante,
    locale: conta(voce.locale),
    online: Object.assign(conta(voce.remoto), { aggiornato: voce.remoto ? voce.remoto.aggiornato : null })
  };
}

// Scrive nel browser quello che arriva da online
function aggiornaBrowser(voci) {
  applicando = true;
  let cambiato = false;
  try {
    // prima le eliminazioni e i nomi, poi i portafogli nuovi: così i nomi liberati si possono riusare
    voci.filter(v => v.decisione.azione === 'eliminaLocale').forEach(v => {
      const selezionato = stato.portafoglio === v.id;
      eliminaPortafoglio(v.id);
      dimenticaEliminato(v.id);
      if (selezionato) cambiaPortafoglio(PRINCIPALE);
      cambiato = true;
    });
    voci.filter(v => v.decisione.azione === 'unisci').forEach(v => {
      if (v.decisione.nome !== v.locale.nome) { rinominaPortafoglio(v.id, v.decisione.nome); cambiato = true; }
      v.decisione.scarica.forEach(campo => { impostaListaDi(v.id, campo, v.remoto[campo]); cambiato = true; });
    });
    voci.filter(v => v.decisione.azione === 'crea').forEach(v => {
      creaPortafoglio(v.remoto.nome || 'Portafoglio', v.id);
      NOMI.forEach(campo => impostaListaDi(v.id, campo, v.remoto[campo] || []));
      cambiato = true;
    });
    if (cambiato) document.dispatchEvent(new CustomEvent('elenco-portafogli-aggiornato'));
  } finally {
    applicando = false;
  }
}

async function esegui(mia) {
  const utente = uid;
  comunica({ tipo: 'lavoro' });
  const online = await leggiOnline(utente);
  if (mia !== sessione) return;

  const salvata = leggiBase();
  const base = salvata && salvata.uid === utente ? salvata : { uid: utente, portafogli: {} };
  const voci = prepara(online, base);

  // Finché c'è anche una sola domanda senza risposta non si tocca nulla
  const aperte = voci.filter(v => v.decisione.azione === 'chiedi');
  if (aperte.length > 0) {
    conflitto = domanda(aperte[0], aperte.length);
    comunica({ tipo: 'scelta', conflitto: conflitto });
    return;
  }
  conflitto = null;
  scelte = new Map();

  // Prima gli aggiornamenti del browser (immediati), poi i salvataggi online
  aggiornaBrowser(voci);

  const daSalvare = [];
  voci.forEach(v => {
    const azione = v.decisione.azione;
    if (azione === 'dimentica' || azione === 'eliminaLocale') {
      delete base.portafogli[v.id];
      dimenticaEliminato(v.id);
    } else if (azione === 'crea') {
      dimenticaEliminato(v.id);
      base.portafogli[v.id] = {
        nome: v.remoto.nome,
        bozza: impronta('bozza', v.remoto.bozza || []),
        costruito: impronta('costruito', v.remoto.costruito || [])
      };
    } else if (azione === 'eliminaOnline') {
      daSalvare.push({ voce: v, dati: Object.assign({}, v.remoto, { nome: v.remoto.nome || 'Portafoglio', eliminato: true, bozza: v.remoto.bozza || [], costruito: v.remoto.costruito || [] }) });
    } else {
      dimenticaEliminato(v.id);
      base.portafogli[v.id] = v.decisione.base;
      if (v.decisione.carica) daSalvare.push({ voce: v, dati: Object.assign(datiLocali(v.id), { eliminato: false }) });
    }
  });
  salvaBase(base);

  for (const lavoro of daSalvare) {
    const id = lavoro.voce.id;
    const scritto = await scriviOnline(utente, id, lavoro.dati, lavoro.voce.remoto);
    if (mia !== sessione) return;
    if (!scritto) throw new Error('Dati online cambiati durante il salvataggio');
    if (lavoro.dati.eliminato) {
      delete base.portafogli[id];
      dimenticaEliminato(id);
    } else {
      base.portafogli[id] = {
        nome: lavoro.dati.nome,
        bozza: impronta('bozza', lavoro.dati.bozza),
        costruito: impronta('costruito', lavoro.dati.costruito)
      };
    }
    salvaBase(base);
  }

  // Con i portafogli allineati, aggiorna il cashflow dei loro titoli
  await allineaCashflow(utente, tuttiGliIsin());
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

['bozza-aggiornata', 'costruito-aggiornato', 'costruito-corretto', 'elenco-portafogli-cambiato'].forEach(evento =>
  document.addEventListener(evento, () => {
    if (applicando) return;
    riprese = 0;
    programma();
  }));

// Caricato un nuovo file cashflow: aggiorna le voci online
document.addEventListener('cashflow-file-caricato', () => { if (uid && !conflitto) allinea(); });

// Torna la connessione: riprova
window.addEventListener('online', () => { if (ultimoStato.tipo === 'errore') allinea(); });

// Si passa a un'altra scheda con modifiche in attesa: salva subito
document.addEventListener('visibilitychange', () => { if (document.hidden && timer) allinea(); });
