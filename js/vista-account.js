// Riquadro in alto a destra (accesso e stato del salvataggio online)
// e riquadro per scegliere quando i dati del browser e quelli online sono diversi.

import { avviaAccesso, accedi, esci, messaggioErrore } from './auth.js';
import { ascoltaSincronizzazione, impostaUtente, allinea, salvaSubito } from './sincronizzazione.js';
import { esc } from './formati.js';

const box = document.getElementById('account');
const riquadro = document.createElement('div');
riquadro.className = 'scelta-dati';
riquadro.hidden = true;
document.querySelector('.topbar').after(riquadro);

let pronto = false;
let utente = null;
let errore = null;
let salvataggio = { tipo: 'spento' };

function htmlStato() {
  const s = salvataggio;
  if (s.tipo === 'attesa') return '<span class="account-stato">Modifiche da salvare…</span>';
  if (s.tipo === 'lavoro') return '<span class="account-stato">Sincronizzazione…</span>';
  if (s.tipo === 'salvato') {
    const ora = s.ora.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    return `<span class="account-stato account-ok">✓ Allineato online alle ${ora}</span>`;
  }
  if (s.tipo === 'scelta') return '<span class="account-stato account-errore">Scegli quali dati tenere</span>';
  if (s.tipo === 'errore') {
    return `<span class="account-errore">${esc(s.testo)}</span>
      <button class="btn btn-secondario" id="btn-riprova">Riprova</button>`;
  }
  return '';
}

function disegna() {
  if (!pronto) return;
  const avviso = errore ? `<span class="account-errore">${esc(errore)}</span>` : '';
  if (utente) {
    box.innerHTML = `${avviso}${htmlStato()}
      <span class="account-utente">${esc(utente.email || utente.displayName || 'Utente collegato')}</span>
      <button class="btn btn-secondario" id="btn-esci">Esci</button>`;
    document.getElementById('btn-esci').addEventListener('click', () => esegui(async () => {
      await salvaSubito();
      await esci();
    }));
    const riprova = document.getElementById('btn-riprova');
    if (riprova) riprova.addEventListener('click', () => allinea());
  } else {
    box.innerHTML = `${avviso}
      <button class="btn btn-primario" id="btn-accedi">Accedi con Google</button>`;
    document.getElementById('btn-accedi').addEventListener('click', () => esegui(accedi));
  }
}

// Testi del riquadro per ciascun tipo di scelta
function testiScelta(c) {
  const nome = '«' + c.nome + '»';
  const elenca = d => `${d.bozza} ${d.bozza === 1 ? 'titolo' : 'titoli'} in bozza · ${d.costruito} ${d.costruito === 1 ? 'acquisto' : 'acquisti'} nel Costruito`;
  const quando = c.online.aggiornato ? ' · modificati il ' + new Date(c.online.aggiornato).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '';
  if (c.tipo === 'eliminatoQui') {
    return {
      titolo: `Hai eliminato qui il portafoglio ${nome}, ma online risulta diverso (forse modificato su un altro dispositivo). Cosa faccio?`,
      righe: ['Online: ' + elenca(c.online) + quando],
      locale: ['Eliminalo anche online', `Eliminare ${nome} anche online e dagli altri dispositivi?`],
      online: ['Recuperalo qui', `Recuperare ${nome} in questo browser?`]
    };
  }
  if (c.tipo === 'eliminatoOnline') {
    return {
      titolo: `Il portafoglio ${nome} risulta eliminato online, ma qui ha modifiche non salvate. Cosa faccio?`,
      righe: ['Questo browser: ' + elenca(c.locale)],
      locale: ['Tienilo e salvalo online', `Tenere ${nome} e salvarlo di nuovo online?`],
      online: ['Eliminalo anche qui', `Eliminare ${nome} da questo browser? Non si può annullare.`]
    };
  }
  return {
    titolo: `Portafoglio ${nome}: i dati di questo browser e quelli online sono diversi. Quali vuoi tenere?`,
    righe: ['Questo browser: ' + elenca(c.locale), 'Online: ' + elenca(c.online) + quando],
    locale: ['Tieni quelli di questo browser', `${nome}: sostituire i dati online con quelli di questo browser?`],
    online: ['Usa quelli online', `${nome}: sostituire i dati di questo browser con quelli online?`]
  };
}

function disegnaScelta() {
  riquadro.hidden = salvataggio.tipo !== 'scelta';
  if (riquadro.hidden) return;
  const c = salvataggio.conflitto;
  const t = testiScelta(c);
  riquadro.innerHTML = `
    <strong>${esc(t.titolo)}</strong>
    ${t.righe.map(r => `<div>${esc(r)}</div>`).join('')}
    <div class="scelta-nota">${c.quante > 1 ? 'Scelte da fare: ' + c.quante + ' (una per portafoglio). ' : ''}Quello che non scegli va perso. Se hai un dubbio, prima salva una copia con «Esporta portafogli» nella schermata Dati.</div>
    <div class="scelta-bottoni">
      <button class="btn btn-secondario" id="btn-tieni-locale">${esc(t.locale[0])}</button>
      <button class="btn btn-secondario" id="btn-tieni-online">${esc(t.online[0])}</button>
    </div>`;
  document.getElementById('btn-tieni-locale').addEventListener('click', () => scegli('locale', t.locale[1]));
  document.getElementById('btn-tieni-online').addEventListener('click', () => scegli('online', t.online[1]));
}

function scegli(quale, domanda) {
  if (confirm(domanda)) allinea(quale);
}

async function esegui(azione) {
  errore = null;
  disegna();
  try {
    await azione();
  } catch (e) {
    errore = messaggioErrore(e);
    disegna();
  }
}

box.innerHTML = '<span class="account-utente">Collegamento…</span>';

ascoltaSincronizzazione(s => {
  salvataggio = s;
  disegna();
  disegnaScelta();
});

avviaAccesso(u => {
  pronto = true;
  utente = u;
  errore = null;
  disegna();
  impostaUtente(u ? u.uid : null);
}).catch(() => {
  box.innerHTML = '<span class="account-errore">Accesso non disponibile: controlla la connessione e ricarica la pagina.</span>';
});
