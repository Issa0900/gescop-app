// Shared period helpers.
// Critical rule: the current calendar month is almost always incomplete
// (e.g. on the 11th only 11 days of data exist). Comparing it against a full
// previous month produces false "collapse" trends on every metric.
// Every month-over-month comparison must therefore run on COMPLETE months only.

export function currentMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

/** Aggregate records into ascending monthly buckets. */
export function monthlyAgg(items, dateField, valueField, mode = "sum") {
  const map = {};
  (items || []).forEach((it) => {
    const m = (it[dateField] || "").slice(0, 7);
    if (!m) return;
    if (!map[m]) map[m] = 0;
    const v = Number(it[valueField]) || 0;
    if (mode === "sum") map[m] += v;
    else if (mode === "count") map[m] += 1;
    else if (mode === "last") map[m] = v;
  });
  return Object.entries(map)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, val]) => ({ month, val }));
}

/** Same as monthlyAgg but drops the in-progress current month. */
export function monthlyAggComplete(items, dateField, valueField, mode = "sum") {
  const cm = currentMonthKey();
  return monthlyAgg(items, dateField, valueField, mode).filter((x) => x.month !== cm);
}

export function dropCurrentMonth(series) {
  const cm = currentMonthKey();
  return (series || []).filter((x) => x.month !== cm);
}

export function lastVal(arr) {
  return arr && arr.length > 0 ? arr[arr.length - 1].val : 0;
}
export function prevVal(arr) {
  return arr && arr.length > 1 ? arr[arr.length - 2].val : 0;
}
export function trendPct(curr, prev) {
  return prev > 0 ? ((curr - prev) / prev) * 100 : 0;
}
export function trendDir(curr, prev, tolerance = 2) {
  const pct = trendPct(curr, prev);
  if (pct > tolerance) return "up";
  if (pct < -tolerance) return "down";
  return "stable";
}

/** Sum the last n buckets of a series. */
export function sumLast(series, n) {
  return (series || []).slice(-n).reduce((s, x) => s + x.val, 0);
}
/** Sum the n buckets immediately before the last n. */
export function sumPrev(series, n) {
  const arr = series || [];
  return arr.slice(Math.max(0, arr.length - 2 * n), Math.max(0, arr.length - n)).reduce((s, x) => s + x.val, 0);
}

/** Mean of the last n values of a raw numeric array. */
export function meanOf(values) {
  const arr = (values || []).filter((v) => Number.isFinite(v));
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Latest snapshot per key from a dated, repeating series (e.g. daily inventory rows).
 * Counting every historical row instead of the latest state per product
 * massively over-counts problems.
 */
export function latestByKey(items, keyField, dateField = "date") {
  const map = {};
  (items || []).forEach((it) => {
    const k = it[keyField];
    if (!k) return;
    if (!map[k] || (it[dateField] || "") > (map[k][dateField] || "")) map[k] = it;
  });
  return Object.values(map);
}