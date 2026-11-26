// Decide, per un portafoglio, cosa fare confrontando tre cose:
// il browser, l'online e l'ultimo allineamento riuscito (base). Qui non si legge e non si scrive nulla.

import { NOMI, impronta } from './cloud-portafogli.js';

// locale:  { nome, bozza, costruito } oppure null se in questo browser non c'è
// remoto:  documento online oppure null
// base:    { nome, bozza, costruito } (testi) oppure undefined
// eliminatoQui: true se il portafoglio è stato eliminato in questo browser
// scelta:  undefined, 'locale' (vale il browser) oppure 'online'
//
// Restituisce uno di questi:
//   { azione: 'chiedi', tipo: 'diversi' | 'eliminatoQui' | 'eliminatoOnline' }
//   { azione: 'dimentica' }          non c'è più da nessuna parte
//   { azione: 'eliminaOnline' }
//   { azione: 'eliminaLocale' }
//   { azione: 'crea' }               c'è solo online: va aggiunto al browser
//   { azione: 'unisci', scarica: [campi], carica: bool, nome, base }
export function decidi({ locale, remoto, base, eliminatoQui, scelta }) {
  const vivo = Boolean(remoto && !remoto.eliminato);
  const comePrima = (nome, lista) => Boolean(base) && lista !== null && impronta(nome, lista) === base[nome];

  if (!locale) {
    if (!vivo) return { azione: 'dimentica' };
    if (!eliminatoQui) return { azione: 'crea' };
    if (NOMI.every(n => comePrima(n, remoto[n]))) return { azione: 'eliminaOnline' };
    if (!scelta) return { azione: 'chiedi', tipo: 'eliminatoQui' };
    return { azione: scelta === 'locale' ? 'eliminaOnline' : 'crea' };
  }

  if (remoto && remoto.eliminato) {
    if (NOMI.every(n => comePrima(n, locale[n]))) return { azione: 'eliminaLocale' };
    if (!scelta) return { azione: 'chiedi', tipo: 'eliminatoOnline' };
    if (scelta === 'online') return { azione: 'eliminaLocale' };
    return { azione: 'unisci', scarica: [], carica: true, nome: locale.nome, base: {} };
  }

  const nuovaBase = Object.assign({}, base); // quello che risulta allineato prima di salvare online
  const scarica = [];
  let carica = !remoto || Boolean(remoto.vecchio);
  let daChiedere = false;

  NOMI.forEach(campo => {
    const qui = impronta(campo, locale[campo]);
    const la = remoto && remoto[campo] !== null ? impronta(campo, remoto[campo]) : null;
    const prima = base ? base[campo] : undefined;
    let azione;
    if (la === null) azione = 'carica';
    else if (qui === la) azione = 'uguale';
    else if (prima !== undefined && qui === prima) azione = 'scarica';
    else if (prima !== undefined && la === prima) azione = 'carica';
    else if (prima === undefined && qui === '[]') azione = 'scarica';
    else if (scelta) azione = scelta === 'locale' ? 'carica' : 'scarica';
    else daChiedere = true;

    if (azione === 'uguale') nuovaBase[campo] = qui;
    if (azione === 'scarica') { nuovaBase[campo] = la; scarica.push(campo); }
    if (azione === 'carica') carica = true;
  });
  if (daChiedere) return { azione: 'chiedi', tipo: 'diversi' };

  // Il nome: se è cambiato solo qui vale quello di qui, altrimenti quello online (senza domande)
  let nome = locale.nome;
  if (remoto && remoto.nome !== null) {
    if (remoto.nome === locale.nome) nuovaBase.nome = locale.nome;
    else if (base && base.nome === remoto.nome) carica = true;
    else { nome = remoto.nome; nuovaBase.nome = remoto.nome; }
  }

  return { azione: 'unisci', scarica: scarica, carica: carica, nome: nome, base: nuovaBase };
}
