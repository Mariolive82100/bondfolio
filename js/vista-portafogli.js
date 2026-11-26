// Barra in alto per scegliere, creare, rinominare, duplicare ed eliminare i portafogli

import { stato, listaDi, cambiaPortafoglio } from './state.js';
import { PRINCIPALE, NOME_MAX, leggiElenco, nomePortafoglio, nomeLibero, nuovoId, leggiLista, scriviLista, creaPortafoglio, rinominaPortafoglio, eliminaPortafoglio } from './portafogli.js';
import { esc } from './formati.js';

const barra = document.getElementById('barra-portafogli');

function disegna() {
  const { elenco } = leggiElenco();
  const principale = stato.portafoglio === PRINCIPALE;
  barra.innerHTML = `
    <label class="pf-scelta"><span>Portafoglio</span>
      <select id="pf-select">${elenco.map(p =>
        `<option value="${esc(p.id)}"${p.id === stato.portafoglio ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
    </label>
    <div class="pf-bottoni">
      <button type="button" class="btn btn-secondario btn-piccolo" data-pf="nuovo">Nuovo</button>
      <button type="button" class="btn btn-secondario btn-piccolo" data-pf="rinomina">Rinomina</button>
      <button type="button" class="btn btn-secondario btn-piccolo" data-pf="duplica">Duplica</button>
      <button type="button" class="btn btn-secondario btn-piccolo" data-pf="elimina"${principale
        ? ' disabled title="Il primo portafoglio non si può eliminare"' : ''}>Elimina</button>
    </div>
    <div class="pf-nota${principale ? '' : ' pf-nota-locale'}">${principale
      ? 'Se hai fatto l\'accesso, viene salvato anche online.'
      : 'Solo su questo dispositivo: per ora online si salva soltanto «' + esc(nomePortafoglio(PRINCIPALE)) + '».'}</div>`;
}

// Chiede un nome; null se si annulla o si lascia vuoto
function chiediNome(domanda, proposta) {
  const risposta = prompt(domanda + ' (massimo ' + NOME_MAX + ' caratteri)', proposta);
  return risposta === null || risposta.trim() === '' ? null : risposta;
}

barra.addEventListener('change', e => {
  if (e.target.id !== 'pf-select') return;
  cambiaPortafoglio(e.target.value);
});

barra.addEventListener('click', e => {
  const bottone = e.target.closest('[data-pf]');
  if (!bottone) return;
  const id = stato.portafoglio;
  const attuale = nomePortafoglio(id);

  if (bottone.dataset.pf === 'nuovo') {
    const nome = chiediNome('Nome del nuovo portafoglio', nomeLibero('Nuovo portafoglio'));
    if (nome !== null) cambiaPortafoglio(creaPortafoglio(nome));
  } else if (bottone.dataset.pf === 'rinomina') {
    const nome = chiediNome('Nuovo nome del portafoglio', attuale);
    if (nome !== null) { rinominaPortafoglio(id, nome); disegna(); }
  } else if (bottone.dataset.pf === 'duplica') {
    const nome = chiediNome('Nome della copia di «' + attuale + '»', nomeLibero(attuale + ' - copia'));
    if (nome === null) return;
    const copia = creaPortafoglio(nome);
    scriviLista(copia, 'bozza', listaDi(id, 'bozza').map(b => ({ ...b })));
    scriviLista(copia, 'costruito', listaDi(id, 'costruito').map(l => ({ ...l, id: nuovoId() })));
    cambiaPortafoglio(copia);
  } else if (bottone.dataset.pf === 'elimina' && id !== PRINCIPALE) {
    const quanti = leggiLista(id, 'bozza').length + ' titoli in bozza e ' + leggiLista(id, 'costruito').length + ' acquisti nel Costruito';
    if (!confirm('Eliminare il portafoglio «' + attuale + '» (' + quanti + ')? Non si può annullare.')) return;
    eliminaPortafoglio(id);
    cambiaPortafoglio(PRINCIPALE);
  }
});

document.addEventListener('portafoglio-cambiato', disegna);
// Un'altra scheda del browser ha cambiato l'elenco
window.addEventListener('storage', e => { if (e.key === 'bondfolio_portafogli_v1') disegna(); });

disegna();
