export const MAX_MINOR = 1_000_000_000_000;
export function moneyToMinor(value: string): number {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,2})?$/.test(value))
    throw new Error('invalid_amount');
  const [whole = '0', fraction = ''] = value.split('.');
  return safeMinor(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0')));
}
export function safeMinor(value: bigint): number {
  if (value < 0n || value > BigInt(MAX_MINOR))
    throw new Error('invalid_amount');
  return Number(value);
}
export function minorToMoney(value: number | string): string {
  if (
    (typeof value === 'number' && !Number.isSafeInteger(value)) ||
    (typeof value === 'string' && !/^-?\d+$/.test(value))
  )
    throw new Error('invalid_amount');
  const integer = BigInt(value);
  const sign = integer < 0n ? '-' : '';
  const amount = integer < 0n ? -integer : integer;
  return `${sign}${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}
export function transactionTotal(
  base: number,
  items: { priceMinor: number; quantity: number }[],
): number {
  return safeMinor(
    items.reduce(
      (sum, item) => sum + BigInt(item.priceMinor) * BigInt(item.quantity),
      BigInt(base),
    ),
  );
}
export function settlement(total: number, paid: number) {
  return paid === 0 ? 'unpaid' : paid >= total ? 'fullyPaid' : 'partiallyPaid';
}

export function finalTotal(
  base: number,
  items: { priceMinor: number; quantity: number }[],
  discount = 0,
  charges = 0,
): number {
  return safeMinor(
    BigInt(transactionTotal(base, items)) - BigInt(discount) + BigInt(charges),
  );
}
