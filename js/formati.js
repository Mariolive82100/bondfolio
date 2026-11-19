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

// "50.000" o "50000,5" -> 50000 (euro interi); vuoto o non valido -> null
export function leggiEuro(testo) {
  const pulito = String(testo).trim().replace(/[\s.]/g, '').replace(',', '.');
  const n = parseFloat(pulito);
  return Number.isNaN(n) || n <= 0 ? null : Math.round(n);
}
