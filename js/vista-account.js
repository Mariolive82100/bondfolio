// Riquadro in alto a destra (accesso e stato del salvataggio online)
// e riquadro per scegliere quando i dati del browser e quelli online sono diversi.

import { PRINCIPALE, nomePortafoglio } from './portafogli.js';
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

function disegnaScelta() {
  riquadro.hidden = salvataggio.tipo !== 'scelta';
  if (riquadro.hidden) return;
  const c = salvataggio.conflitto;
  const conta = d => `${d.bozza} ${d.bozza === 1 ? 'titolo' : 'titoli'} in bozza · ${d.costruito} ${d.costruito === 1 ? 'acquisto' : 'acquisti'} nel Costruito`;
  const quando = c.online.aggiornato ? ' · modificati il ' + new Date(c.online.aggiornato).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '';
  riquadro.innerHTML = `
    <strong>Portafoglio «${esc(nomePortafoglio(PRINCIPALE))}»: i dati di questo browser e quelli online sono diversi. Quali vuoi tenere?</strong>
    <div>Questo browser: ${conta(c.locale)}</div>
    <div>Online: ${conta(c.online)}${quando}</div>
    <div class="scelta-nota">I dati diversi che non scegli vengono sostituiti. Se hai un dubbio, prima salvane una copia con «Esporta portafogli» nella schermata Dati.</div>
    <div class="scelta-bottoni">
      <button class="btn btn-secondario" id="btn-tieni-locale">Tieni quelli di questo browser</button>
      <button class="btn btn-secondario" id="btn-tieni-online">Usa quelli online</button>
    </div>`;
  document.getElementById('btn-tieni-locale').addEventListener('click', () => scegli('locale', 'Sostituire i dati online con quelli di questo browser?'));
  document.getElementById('btn-tieni-online').addEventListener('click', () => scegli('online', 'Sostituire i dati di questo browser con quelli online?'));
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
