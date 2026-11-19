// Dati condivisi tra le schermate (restano in memoria finché la pagina è aperta)

export const stato = {
  titoli: [],   // elenco obbligazioni letto dal file
  meta: null    // informazioni sul file (nome, data, numero titoli...)
};

export function impostaDati(titoli, meta) {
  stato.titoli = titoli;
  stato.meta = meta;
  document.dispatchEvent(new CustomEvent('dati-aggiornati'));
}
