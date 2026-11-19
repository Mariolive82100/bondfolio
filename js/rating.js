// Converte i rating (S&P, Moody's e stile DBRS presenti nel file) in un numero:
// 1 = AAA (migliore) ... 16 = B-. Serve per ordinare e filtrare.

const MAPPA = {};

['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-',
 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-'
].forEach((r, i) => { MAPPA[r] = i + 1; });

['Aaa', 'Aa1', 'Aa2', 'Aa3', 'A1', 'A2', 'A3', 'Baa1', 'Baa2', 'Baa3',
 'Ba1', 'Ba2', 'Ba3', 'B1', 'B2', 'B3', 'Caa1', 'Caa2', 'Caa3'
].forEach((r, i) => { MAPPA[r] = i + 1; });

// Scrittura "a parole" usata nella colonna Moody's del file
Object.assign(MAPPA, {
  'AA (high)': 2, 'AA (low)': 4,
  'A (high)': 5, 'A (low)': 7,
  'BBB (high)': 8, 'BBB (low)': 10,
  'BB (high)': 11, 'BB (low)': 13,
  'B (high)': 14, 'B (low)': 16
});

// Usa il rating S&P; se manca, quello Moody's. Nessun rating -> null
export function ordinaleTitolo(t) {
  const candidati = [t.ratingSP, t.ratingMoodys];
  for (const c of candidati) {
    if (c && MAPPA[c]) return MAPPA[c];
  }
  return null;
}

export function etichettaRating(t) {
  if (t.ratingSP && MAPPA[t.ratingSP]) return t.ratingSP;
  if (t.ratingMoodys && MAPPA[t.ratingMoodys]) return t.ratingMoodys;
  return '—';
}
