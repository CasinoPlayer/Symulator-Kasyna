/**
 * format.js — formatowanie liczb, kwot, czasu i odmiana słowa „cebulion”.
 *
 * Po co osobny moduł: te same reguły obowiązują w lobby, w grze i w historii, więc trzymamy je w jednym miejscu.
 * Dlaczego własne grupowanie zamiast Intl.NumberFormat('pl-PL'): polskie reguły CLDR NIE grupują liczb
 * czterocyfrowych (1000, ale 10 000), przez co saldo „skakało” wizualnie przy 9999 → 10 000 (01 §2.1).
 */

const NBSP = ' ';
const MINUS = '−'; // typograficzny minus (szerszy niż dywiz)

/** 10000 → "10 000" (spacja niełamliwa co 3 cyfry, od 1000 w górę). */
export function formatAmount(value) {
  const n = Math.round(Number(value) || 0);
  const digits = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return n < 0 ? MINUS + digits : digits;
}

/** Kwota ze znakiem: +10 000 / −500 (zysk zawsze ze znakiem „+”, nie tylko kolorem — 01 §3.7). */
export function formatSigned(value) {
  const n = Math.round(Number(value) || 0);
  if (n > 0) return '+' + formatAmount(n);
  return formatAmount(n);
}

/** Odmiana: 1 cebulion, 2–4 cebuliony (oprócz 12–14), 5+ cebulionów. */
export function pluralCebulion(value) {
  const n = Math.abs(Math.round(Number(value) || 0));
  if (n === 1) return 'cebulion';
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'cebuliony';
  return 'cebulionów';
}

/** "10 000 cebulionów" */
export function formatCebuliony(value) {
  return `${formatAmount(value)} ${pluralCebulion(value)}`;
}

/** Mnożnik: 120 → "×120", 1.5 → "×1,5" (polski przecinek dziesiętny). */
export function formatMultiplier(value) {
  const n = Number(value) || 0;
  const text = Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '');
  return '×' + text.replace('.', ',');
}

/** Sekundy → "09:41" (odliczanie bonusu ratunkowego). */
export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Czas względny po polsku: „przed chwilą”, „5 min temu”, „2 godz. temu”, „wczoraj”, „3 dni temu”, data. */
export function formatRelative(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 45) return 'przed chwilą';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  if (d === 1) return 'wczoraj';
  if (d < 7) return `${d} dni temu`;
  return new Date(t).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Data i godzina do historii: „11.10.2026, 14:05”. */
export function formatDateTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
