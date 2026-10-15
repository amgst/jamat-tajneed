// Older imports may contain missing dates or Firestore timestamp objects.
export function paymentDateMillis(value: unknown): number | null {
  let millis: number;
  if (typeof value === 'string' && value.trim()) millis = Date.parse(value);
  else if (typeof value === 'number') millis = value;
  else if (value instanceof Date) millis = value.getTime();
  else if (value && typeof value === 'object') {
    const timestamp = value as { seconds?: unknown; _seconds?: unknown };
    const seconds = timestamp.seconds ?? timestamp._seconds;
    if (typeof seconds !== 'number') return null;
    millis = seconds * 1000;
  } else return null;
  return Number.isFinite(millis) && Math.abs(millis) <= 8640000000000000 ? millis : null;
}

export function comparePaymentDates(a: { date?: unknown }, b: { date?: unknown }): number {
  const first = paymentDateMillis(a.date);
  const second = paymentDateMillis(b.date);
  if (first === null) return second === null ? 0 : 1;
  if (second === null) return -1;
  return second - first;
}
