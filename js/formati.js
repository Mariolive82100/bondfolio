// Piccole funzioni per mostrare numeri, date e testi nel formato italiano

export function esc(testo) {
  return String(testo).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// 3,456 -> "3,46"   (null -> "—")
export function fmtNum(n, decimali = 2) {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali
  });
}

// "2027-07-15" -> "15/07/2027"
export function fmtData(iso) {
  if (!iso) return '—';
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

export const NOMI_MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

// "26,25" o "1.250,5" -> numero con decimali; vuoto o non valido -> null
export function leggiDecimale(testo) {
  const n = parseFloat(String(testo).trim().replace(/[\s.]/g, '').replace(',', '.'));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

// "0", "92,97", "1.250,5" o "92.97" -> numero (zero ammesso); vuoto, negativo o non valido -> null
// Con la virgola, i punti sono separatori delle migliaia; senza virgola, il punto è il separatore dei decimali.
export function leggiNumero(testo) {
  let t = String(testo).trim().replace(/\s/g, '');
  if (t === '') return null;
  t = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = parseFloat(t);
  return Number.isNaN(n) || n < 0 ? null : n;
}

// Data di oggi nel formato "aaaa-mm-gg" (ora locale)
export function oggiIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
