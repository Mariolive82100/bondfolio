// Riquadro in alto a destra: pulsante di accesso, utente collegato ed eventuali errori

import { avviaAccesso, accedi, esci, messaggioErrore } from './auth.js';
import { esc } from './formati.js';

const box = document.getElementById('account');
let utente = null;
let errore = null;

function disegna() {
  const avviso = errore ? `<span class="account-errore">${esc(errore)}</span>` : '';
  if (utente) {
    box.innerHTML = `${avviso}
      <span class="account-utente">${esc(utente.email || utente.displayName || 'Utente collegato')}</span>
      <button class="btn btn-secondario" id="btn-esci">Esci</button>`;
    document.getElementById('btn-esci').addEventListener('click', () => esegui(esci));
  } else {
    box.innerHTML = `${avviso}
      <button class="btn btn-primario" id="btn-accedi">Accedi con Google</button>`;
    document.getElementById('btn-accedi').addEventListener('click', () => esegui(accedi));
  }
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

avviaAccesso(u => {
  utente = u;
  errore = null;
  disegna();
}).catch(() => {
  box.innerHTML = '<span class="account-errore">Accesso non disponibile: controlla la connessione e ricarica la pagina.</span>';
});
